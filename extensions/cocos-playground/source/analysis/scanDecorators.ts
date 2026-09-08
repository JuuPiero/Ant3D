import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { DecoratedClass, DecoratedField, PlayGroundEnumOption, PlayGroundFieldKind } from './types';

/**
 * Static-analysis field extraction: we never load/execute project scripts (no live Cocos
 * Editor/scene is available to a build-hook process), so instead we parse the TypeScript source
 * directly to find which classes/properties are marked with `@playGroundField`, then separately
 * read the actual values out of the .scene/.prefab JSON files (see scanScenes.ts).
 */

const BUILTIN_KIND_BY_TYPE_NAME: Record<string, PlayGroundFieldKind> = {
    String: 'string',
    CCString: 'string',
    Number: 'number',
    CCFloat: 'number',
    CCInteger: 'number',
    Boolean: 'boolean',
    CCBoolean: 'boolean',
    Color: 'color',
    Vec2: 'vec2',
    Vec3: 'vec3',
    Vec4: 'vec4',
};

function findTsFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findTsFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
            results.push(fullPath);
        }
    }
    return results;
}

function getDecoratorCall(node: ts.HasDecorators, name: string): ts.CallExpression | undefined {
    for (const decorator of ts.getDecorators(node) ?? []) {
        const expr = decorator.expression;
        if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === name) {
            return expr;
        }
    }
    return undefined;
}

function hasBareOrCalledDecorator(node: ts.HasDecorators, name: string): boolean {
    for (const decorator of ts.getDecorators(node) ?? []) {
        const expr = decorator.expression;
        if (ts.isIdentifier(expr) && expr.text === name) return true;
        if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === name) return true;
    }
    return false;
}

function getStringLiteralArg(call: ts.CallExpression, index: number): string | undefined {
    const arg = call.arguments[index];
    return arg && ts.isStringLiteral(arg) ? arg.text : undefined;
}

function getObjectLiteralArg(call: ts.CallExpression, index: number): ts.ObjectLiteralExpression | undefined {
    const arg = call.arguments[index];
    return arg && ts.isObjectLiteralExpression(arg) ? arg : undefined;
}

function findProperty(obj: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment | undefined {
    for (const prop of obj.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === name) {
            return prop;
        }
    }
    return undefined;
}

function getStringProp(obj: ts.ObjectLiteralExpression, name: string): string | undefined {
    const prop = findProperty(obj, name);
    return prop && ts.isStringLiteral(prop.initializer) ? prop.initializer.text : undefined;
}

/** Resolves the identifier text of a `type: X` / `type: Foo.Bar` / `type: Enum(X)` expression. */
function resolveTypeExpressionName(expr: ts.Expression): string | undefined {
    if (ts.isIdentifier(expr)) return expr.text;
    if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) return expr.name.text;
    // Cocos's real enum-typed @property syntax wraps the enum in Enum(...) so the Inspector can
    // render a dropdown (a plain `type: SomeEnum` won't show one) — unwrap it to the enum name.
    if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'Enum') {
        const arg = expr.arguments[0];
        return arg ? resolveTypeExpressionName(arg) : undefined;
    }
    return undefined;
}

/** Resolves `type: X` to `{typeName: 'X', isList: false}`, or Cocos's array-property syntax
 *  `type: [X]` to `{typeName: 'X', isList: true}`. */
function getTypeInfoProp(obj: ts.ObjectLiteralExpression): { typeName?: string; isList: boolean } {
    const prop = findProperty(obj, 'type');
    if (!prop) return { isList: false };

    if (ts.isArrayLiteralExpression(prop.initializer)) {
        const element = prop.initializer.elements[0];
        return { typeName: element ? resolveTypeExpressionName(element) : undefined, isList: true };
    }

    return { typeName: resolveTypeExpressionName(prop.initializer), isList: false };
}

interface EnumInfo {
    options: PlayGroundEnumOption[];
}

function collectEnums(sourceFiles: ts.SourceFile[]): Map<string, EnumInfo> {
    const enums = new Map<string, EnumInfo>();

    for (const sourceFile of sourceFiles) {
        const visit = (node: ts.Node) => {
            if (ts.isEnumDeclaration(node)) {
                const options: PlayGroundEnumOption[] = [];
                let nextValue = 0;
                for (const member of node.members) {
                    const label = ts.isIdentifier(member.name) ? member.name.text : member.name.getText(sourceFile);
                    let value = nextValue;
                    if (member.initializer && ts.isNumericLiteral(member.initializer)) {
                        value = Number(member.initializer.text);
                    }
                    options.push({ label, value });
                    nextValue = value + 1;
                }
                enums.set(node.name.text, { options });
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
    }

    return enums;
}

/**
 * Scans every .ts file under `assetsDir` for `@ccclass(...)` classes containing
 * `@playGroundField(...)`-decorated properties, returning a map keyed by the ccclass name
 * (matching the `__type__` string used in serialized .scene/.prefab files).
 */
export function scanDecorators(assetsDir: string): Map<string, DecoratedClass> {
    const files = findTsFiles(assetsDir);
    const sourceFiles = files.map((file) =>
        ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ES2020, true)
    );

    const enums = collectEnums(sourceFiles);
    const classes = new Map<string, DecoratedClass>();

    for (const sourceFile of sourceFiles) {
        const visit = (node: ts.Node) => {
            if (ts.isClassDeclaration(node) && node.name) {
                const ccclassCall = getDecoratorCall(node, 'ccclass');
                if (ccclassCall || hasBareOrCalledDecorator(node, 'ccclass')) {
                    const className = (ccclassCall && getStringLiteralArg(ccclassCall, 0)) ?? node.name.text;
                    const fields: DecoratedField[] = [];

                    for (const member of node.members) {
                        if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) continue;

                        const fieldCall = getDecoratorCall(member, 'playGroundField');
                        if (!fieldCall) continue;

                        const propertyKey = member.name.text;
                        const optionsObj = getObjectLiteralArg(fieldCall, 0);
                        if (!optionsObj) {
                            console.warn(
                                `[cocos-playground] @playGroundField on ${className}.${propertyKey} is missing an options object, skipping.`
                            );
                            continue;
                        }

                        const { typeName, isList } = getTypeInfoProp(optionsObj);
                        const label = getStringProp(optionsObj, 'label') ?? propertyKey;
                        const group = getStringProp(optionsObj, 'group');

                        if (!typeName) {
                            console.warn(
                                `[cocos-playground] @playGroundField on ${className}.${propertyKey} has no resolvable "type", skipping.`
                            );
                            continue;
                        }

                        const builtinKind = BUILTIN_KIND_BY_TYPE_NAME[typeName];
                        if (builtinKind) {
                            fields.push({ className, propertyKey, kind: builtinKind, label, group, isList });
                            continue;
                        }

                        const enumInfo = enums.get(typeName);
                        if (enumInfo) {
                            fields.push({
                                className,
                                propertyKey,
                                kind: 'enum',
                                label,
                                group,
                                enumOptions: enumInfo.options,
                                isList,
                            });
                            continue;
                        }

                        console.warn(
                            `[cocos-playground] @playGroundField on ${className}.${propertyKey} references unknown type "${typeName}", skipping.`
                        );
                    }

                    if (fields.length > 0) {
                        classes.set(className, { className, fields });
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
    }

    return classes;
}

/**
 * Flattens the per-class map into `propertyKey -> candidate fields`. Cocos Creator's scene/prefab
 * files identify custom component instances by an internal (often compressed) class id, not the
 * plain `@ccclass` name — that internal encoding is undocumented and not safely reproducible
 * outside a running Cocos Creator process, so scanScenes.ts deliberately does NOT try to resolve
 * `__type__` back to a class name. Instead it matches components structurally, by which
 * `@playGroundField`-decorated property keys are present on a serialized object. This flattened,
 * property-key-keyed index is what makes that possible; a `console.warn` is emitted at export
 * time (see export.ts) if the same property key is decorated on more than one class, since that's
 * the one case this approach can't disambiguate.
 */
export function buildPropertyKeyIndex(classes: Map<string, DecoratedClass>): Map<string, DecoratedField[]> {
    const index = new Map<string, DecoratedField[]>();
    for (const decoratedClass of classes.values()) {
        for (const field of decoratedClass.fields) {
            const candidates = index.get(field.propertyKey) ?? [];
            candidates.push(field);
            index.set(field.propertyKey, candidates);
        }
    }
    return index;
}
