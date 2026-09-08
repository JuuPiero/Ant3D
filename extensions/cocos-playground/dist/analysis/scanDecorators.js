"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanDecorators = scanDecorators;
exports.buildPropertyKeyIndex = buildPropertyKeyIndex;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ts = __importStar(require("typescript"));
/**
 * Static-analysis field extraction: we never load/execute project scripts (no live Cocos
 * Editor/scene is available to a build-hook process), so instead we parse the TypeScript source
 * directly to find which classes/properties are marked with `@playGroundField`, then separately
 * read the actual values out of the .scene/.prefab JSON files (see scanScenes.ts).
 */
const BUILTIN_KIND_BY_TYPE_NAME = {
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
function findTsFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir))
        return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findTsFiles(fullPath));
        }
        else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
            results.push(fullPath);
        }
    }
    return results;
}
function getDecoratorCall(node, name) {
    var _a;
    for (const decorator of (_a = ts.getDecorators(node)) !== null && _a !== void 0 ? _a : []) {
        const expr = decorator.expression;
        if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === name) {
            return expr;
        }
    }
    return undefined;
}
function hasBareOrCalledDecorator(node, name) {
    var _a;
    for (const decorator of (_a = ts.getDecorators(node)) !== null && _a !== void 0 ? _a : []) {
        const expr = decorator.expression;
        if (ts.isIdentifier(expr) && expr.text === name)
            return true;
        if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === name)
            return true;
    }
    return false;
}
function getStringLiteralArg(call, index) {
    const arg = call.arguments[index];
    return arg && ts.isStringLiteral(arg) ? arg.text : undefined;
}
function getObjectLiteralArg(call, index) {
    const arg = call.arguments[index];
    return arg && ts.isObjectLiteralExpression(arg) ? arg : undefined;
}
function findProperty(obj, name) {
    for (const prop of obj.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === name) {
            return prop;
        }
    }
    return undefined;
}
function getStringProp(obj, name) {
    const prop = findProperty(obj, name);
    return prop && ts.isStringLiteral(prop.initializer) ? prop.initializer.text : undefined;
}
/** Resolves the identifier text of a `type: X` / `type: Foo.Bar` / `type: Enum(X)` expression. */
function resolveTypeExpressionName(expr) {
    if (ts.isIdentifier(expr))
        return expr.text;
    if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name))
        return expr.name.text;
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
function getTypeInfoProp(obj) {
    const prop = findProperty(obj, 'type');
    if (!prop)
        return { isList: false };
    if (ts.isArrayLiteralExpression(prop.initializer)) {
        const element = prop.initializer.elements[0];
        return { typeName: element ? resolveTypeExpressionName(element) : undefined, isList: true };
    }
    return { typeName: resolveTypeExpressionName(prop.initializer), isList: false };
}
function collectEnums(sourceFiles) {
    const enums = new Map();
    for (const sourceFile of sourceFiles) {
        const visit = (node) => {
            if (ts.isEnumDeclaration(node)) {
                const options = [];
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
function scanDecorators(assetsDir) {
    const files = findTsFiles(assetsDir);
    const sourceFiles = files.map((file) => ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ES2020, true));
    const enums = collectEnums(sourceFiles);
    const classes = new Map();
    for (const sourceFile of sourceFiles) {
        const visit = (node) => {
            var _a, _b;
            if (ts.isClassDeclaration(node) && node.name) {
                const ccclassCall = getDecoratorCall(node, 'ccclass');
                if (ccclassCall || hasBareOrCalledDecorator(node, 'ccclass')) {
                    const className = (_a = (ccclassCall && getStringLiteralArg(ccclassCall, 0))) !== null && _a !== void 0 ? _a : node.name.text;
                    const fields = [];
                    for (const member of node.members) {
                        if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name))
                            continue;
                        const fieldCall = getDecoratorCall(member, 'playGroundField');
                        if (!fieldCall)
                            continue;
                        const propertyKey = member.name.text;
                        const optionsObj = getObjectLiteralArg(fieldCall, 0);
                        if (!optionsObj) {
                            console.warn(`[cocos-playground] @playGroundField on ${className}.${propertyKey} is missing an options object, skipping.`);
                            continue;
                        }
                        const { typeName, isList } = getTypeInfoProp(optionsObj);
                        const label = (_b = getStringProp(optionsObj, 'label')) !== null && _b !== void 0 ? _b : propertyKey;
                        const group = getStringProp(optionsObj, 'group');
                        if (!typeName) {
                            console.warn(`[cocos-playground] @playGroundField on ${className}.${propertyKey} has no resolvable "type", skipping.`);
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
                        console.warn(`[cocos-playground] @playGroundField on ${className}.${propertyKey} references unknown type "${typeName}", skipping.`);
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
function buildPropertyKeyIndex(classes) {
    var _a;
    const index = new Map();
    for (const decoratedClass of classes.values()) {
        for (const field of decoratedClass.fields) {
            const candidates = (_a = index.get(field.propertyKey)) !== null && _a !== void 0 ? _a : [];
            candidates.push(field);
            index.set(field.propertyKey, candidates);
        }
    }
    return index;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NhbkRlY29yYXRvcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvYW5hbHlzaXMvc2NhbkRlY29yYXRvcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFtSkEsd0NBK0VDO0FBYUQsc0RBVUM7QUF6UEQsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUM3QiwrQ0FBaUM7QUFHakM7Ozs7O0dBS0c7QUFFSCxNQUFNLHlCQUF5QixHQUF3QztJQUNuRSxNQUFNLEVBQUUsUUFBUTtJQUNoQixRQUFRLEVBQUUsUUFBUTtJQUNsQixNQUFNLEVBQUUsUUFBUTtJQUNoQixPQUFPLEVBQUUsUUFBUTtJQUNqQixTQUFTLEVBQUUsUUFBUTtJQUNuQixPQUFPLEVBQUUsU0FBUztJQUNsQixTQUFTLEVBQUUsU0FBUztJQUNwQixLQUFLLEVBQUUsT0FBTztJQUNkLElBQUksRUFBRSxNQUFNO0lBQ1osSUFBSSxFQUFFLE1BQU07SUFDWixJQUFJLEVBQUUsTUFBTTtDQUNmLENBQUM7QUFFRixTQUFTLFdBQVcsQ0FBQyxHQUFXO0lBQzVCLE1BQU0sT0FBTyxHQUFhLEVBQUUsQ0FBQztJQUM3QixJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUM7UUFBRSxPQUFPLE9BQU8sQ0FBQztJQUV4QyxLQUFLLE1BQU0sS0FBSyxJQUFJLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxFQUFFLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQztRQUMvRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDNUMsSUFBSSxLQUFLLENBQUMsV0FBVyxFQUFFLEVBQUUsQ0FBQztZQUN0QixPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENB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QUNwQixPQUFPLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxFQUFFLFNBQVMsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO29CQUNsRCxDQUFDO2dCQUNMLENBQUM7WUFDTCxDQUFDO1lBQ0QsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDakMsQ0FBQyxDQUFDO1FBQ0YsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ3RCLENBQUM7SUFFRCxPQUFPLE9BQU8sQ0FBQztBQUNuQixDQUFDO0FBRUQ7Ozs7Ozs7Ozs7R0FVRztBQUNILFNBQWdCLHFCQUFxQixDQUFDLE9BQW9DOztJQUN0RSxNQUFNLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBNEIsQ0FBQztJQUNsRCxLQUFLLE1BQU0sY0FBYyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO1FBQzVDLEtBQUssTUFBTSxLQUFLLElBQUksY0FBYyxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3hDLE1BQU0sVUFBVSxHQUFHLE1BQUEsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLG1DQUFJLEVBQUUsQ0FBQztZQUN0RCxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3ZCLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUM3QyxDQUFDO0lBQ0wsQ0FBQztJQUNELE9BQU8sS0FBSyxDQUFDO0FBQ2pCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5pbXBvcnQgeyBEZWNvcmF0ZWRDbGFzcywgRGVjb3JhdGVkRmllbGQsIFBsYXlHcm91bmRFbnVtT3B0aW9uLCBQbGF5R3JvdW5kRmllbGRLaW5kIH0gZnJvbSAnLi90eXBlcyc7XG5cbi8qKlxuICogU3RhdGljLWFuYWx5c2lzIGZpZWxkIGV4dHJhY3Rpb246IHdlIG5ldmVyIGxvYWQvZXhlY3V0ZSBwcm9qZWN0IHNjcmlwdHMgKG5vIGxpdmUgQ29jb3NcbiAqIEVkaXRvci9zY2VuZSBpcyBhdmFpbGFibGUgdG8gYSBidWlsZC1ob29rIHByb2Nlc3MpLCBzbyBpbnN0ZWFkIHdlIHBhcnNlIHRoZSBUeXBlU2NyaXB0IHNvdXJjZVxuICogZGlyZWN0bHkgdG8gZmluZCB3aGljaCBjbGFzc2VzL3Byb3BlcnRpZXMgYXJlIG1hcmtlZCB3aXRoIGBAcGxheUdyb3VuZEZpZWxkYCwgdGhlbiBzZXBhcmF0ZWx5XG4gKiByZWFkIHRoZSBhY3R1YWwgdmFsdWVzIG91dCBvZiB0aGUgLnNjZW5lLy5wcmVmYWIgSlNPTiBmaWxlcyAoc2VlIHNjYW5TY2VuZXMudHMpLlxuICovXG5cbmNvbnN0IEJVSUxUSU5fS0lORF9CWV9UWVBFX05BTUU6IFJlY29yZDxzdHJpbmcsIFBsYXlHcm91bmRGaWVsZEtpbmQ+ID0ge1xuICAgIFN0cmluZzogJ3N0cmluZycsXG4gICAgQ0NTdHJpbmc6ICdzdHJpbmcnLFxuICAgIE51bWJlcjogJ251bWJlcicsXG4gICAgQ0NGbG9hdDogJ251bWJlcicsXG4gICAgQ0NJbnRlZ2VyOiAnbnVtYmVyJyxcbiAgICBCb29sZWFuOiAnYm9vbGVhbicsXG4gICAgQ0NCb29sZWFuOiAnYm9vbGVhbicsXG4gICAgQ29sb3I6ICdjb2xvcicsXG4gICAgVmVjMjogJ3ZlYzInLFxuICAgIFZlYzM6ICd2ZWMzJyxcbiAgICBWZWM0OiAndmVjNCcsXG59O1xuXG5mdW5jdGlvbiBmaW5kVHNGaWxlcyhkaXI6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICBjb25zdCByZXN1bHRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGlmICghZnMuZXhpc3RzU3luYyhkaXIpKSByZXR1cm4gcmVzdWx0cztcblxuICAgIGZvciAoY29uc3QgZW50cnkgb2YgZnMucmVhZGRpclN5bmMoZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSkpIHtcbiAgICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4oZGlyLCBlbnRyeS5uYW1lKTtcbiAgICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgIHJlc3VsdHMucHVzaCguLi5maW5kVHNGaWxlcyhmdWxsUGF0aCkpO1xuICAgICAgICB9IGVsc2UgaWYgKGVudHJ5LmlzRmlsZSgpICYmIGVudHJ5Lm5hbWUuZW5kc1dpdGgoJy50cycpICYmICFlbnRyeS5uYW1lLmVuZHNXaXRoKCcuZC50cycpKSB7XG4gICAgICAgICAgICByZXN1bHRzLnB1c2goZnVsbFBhdGgpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHRzO1xufVxuXG5mdW5jdGlvbiBnZXREZWNvcmF0b3JDYWxsKG5vZGU6IHRzLkhhc0RlY29yYXRvcnMsIG5hbWU6IHN0cmluZyk6IHRzLkNhbGxFeHByZXNzaW9uIHwgdW5kZWZpbmVkIHtcbiAgICBmb3IgKGNvbnN0IGRlY29yYXRvciBvZiB0cy5nZXREZWNvcmF0b3JzKG5vZGUpID8/IFtdKSB7XG4gICAgICAgIGNvbnN0IGV4cHIgPSBkZWNvcmF0b3IuZXhwcmVzc2lvbjtcbiAgICAgICAgaWYgKHRzLmlzQ2FsbEV4cHJlc3Npb24oZXhwcikgJiYgdHMuaXNJZGVudGlmaWVyKGV4cHIuZXhwcmVzc2lvbikgJiYgZXhwci5leHByZXNzaW9uLnRleHQgPT09IG5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBleHByO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGhhc0JhcmVPckNhbGxlZERlY29yYXRvcihub2RlOiB0cy5IYXNEZWNvcmF0b3JzLCBuYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBmb3IgKGNvbnN0IGRlY29yYXRvciBvZiB0cy5nZXREZWNvcmF0b3JzKG5vZGUpID8/IFtdKSB7XG4gICAgICAgIGNvbnN0IGV4cHIgPSBkZWNvcmF0b3IuZXhwcmVzc2lvbjtcbiAgICAgICAgaWYgKHRzLmlzSWRlbnRpZmllcihleHByKSAmJiBleHByLnRleHQgPT09IG5hbWUpIHJldHVybiB0cnVlO1xuICAgICAgICBpZiAodHMuaXNDYWxsRXhwcmVzc2lvbihleHByKSAmJiB0cy5pc0lkZW50aWZpZXIoZXhwci5leHByZXNzaW9uKSAmJiBleHByLmV4cHJlc3Npb24udGV4dCA9PT0gbmFtZSkgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZ2V0U3RyaW5nTGl0ZXJhbEFyZyhjYWxsOiB0cy5DYWxsRXhwcmVzc2lvbiwgaW5kZXg6IG51bWJlcik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgYXJnID0gY2FsbC5hcmd1bWVudHNbaW5kZXhdO1xuICAgIHJldHVybiBhcmcgJiYgdHMuaXNTdHJpbmdMaXRlcmFsKGFyZykgPyBhcmcudGV4dCA6IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gZ2V0T2JqZWN0TGl0ZXJhbEFyZyhjYWxsOiB0cy5DYWxsRXhwcmVzc2lvbiwgaW5kZXg6IG51bWJlcik6IHRzLk9iamVjdExpdGVyYWxFeHByZXNzaW9uIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBhcmcgPSBjYWxsLmFyZ3VtZW50c1tpbmRleF07XG4gICAgcmV0dXJuIGFyZyAmJiB0cy5pc09iamVjdExpdGVyYWxFeHByZXNzaW9uKGFyZykgPyBhcmcgOiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGZpbmRQcm9wZXJ0eShvYmo6IHRzLk9iamVjdExpdGVyYWxFeHByZXNzaW9uLCBuYW1lOiBzdHJpbmcpOiB0cy5Qcm9wZXJ0eUFzc2lnbm1lbnQgfCB1bmRlZmluZWQge1xuICAgIGZvciAoY29uc3QgcHJvcCBvZiBvYmoucHJvcGVydGllcykge1xuICAgICAgICBpZiAodHMuaXNQcm9wZXJ0eUFzc2lnbm1lbnQocHJvcCkgJiYgdHMuaXNJZGVudGlmaWVyKHByb3AubmFtZSkgJiYgcHJvcC5uYW1lLnRleHQgPT09IG5hbWUpIHtcbiAgICAgICAgICAgIHJldHVybiBwcm9wO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGdldFN0cmluZ1Byb3Aob2JqOiB0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvbiwgbmFtZTogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBwcm9wID0gZmluZFByb3BlcnR5KG9iaiwgbmFtZSk7XG4gICAgcmV0dXJuIHByb3AgJiYgdHMuaXNTdHJpbmdMaXRlcmFsKHByb3AuaW5pdGlhbGl6ZXIpID8gcHJvcC5pbml0aWFsaXplci50ZXh0IDogdW5kZWZpbmVkO1xufVxuXG4vKiogUmVzb2x2ZXMgdGhlIGlkZW50aWZpZXIgdGV4dCBvZiBhIGB0eXBlOiBYYCAvIGB0eXBlOiBGb28uQmFyYCAvIGB0eXBlOiBFbnVtKFgpYCBleHByZXNzaW9uLiAqL1xuZnVuY3Rpb24gcmVzb2x2ZVR5cGVFeHByZXNzaW9uTmFtZShleHByOiB0cy5FeHByZXNzaW9uKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgICBpZiAodHMuaXNJZGVudGlmaWVyKGV4cHIpKSByZXR1cm4gZXhwci50ZXh0O1xuICAgIGlmICh0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihleHByKSAmJiB0cy5pc0lkZW50aWZpZXIoZXhwci5uYW1lKSkgcmV0dXJuIGV4cHIubmFtZS50ZXh0O1xuICAgIC8vIENvY29zJ3MgcmVhbCBlbnVtLXR5cGVkIEBwcm9wZXJ0eSBzeW50YXggd3JhcHMgdGhlIGVudW0gaW4gRW51bSguLi4pIHNvIHRoZSBJbnNwZWN0b3IgY2FuXG4gICAgLy8gcmVuZGVyIGEgZHJvcGRvd24gKGEgcGxhaW4gYHR5cGU6IFNvbWVFbnVtYCB3b24ndCBzaG93IG9uZSkg4oCUIHVud3JhcCBpdCB0byB0aGUgZW51bSBuYW1lLlxuICAgIGlmICh0cy5pc0NhbGxFeHByZXNzaW9uKGV4cHIpICYmIHRzLmlzSWRlbnRpZmllcihleHByLmV4cHJlc3Npb24pICYmIGV4cHIuZXhwcmVzc2lvbi50ZXh0ID09PSAnRW51bScpIHtcbiAgICAgICAgY29uc3QgYXJnID0gZXhwci5hcmd1bWVudHNbMF07XG4gICAgICAgIHJldHVybiBhcmcgPyByZXNvbHZlVHlwZUV4cHJlc3Npb25OYW1lKGFyZykgOiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG59XG5cbi8qKiBSZXNvbHZlcyBgdHlwZTogWGAgdG8gYHt0eXBlTmFtZTogJ1gnLCBpc0xpc3Q6IGZhbHNlfWAsIG9yIENvY29zJ3MgYXJyYXktcHJvcGVydHkgc3ludGF4XG4gKiAgYHR5cGU6IFtYXWAgdG8gYHt0eXBlTmFtZTogJ1gnLCBpc0xpc3Q6IHRydWV9YC4gKi9cbmZ1bmN0aW9uIGdldFR5cGVJbmZvUHJvcChvYmo6IHRzLk9iamVjdExpdGVyYWxFeHByZXNzaW9uKTogeyB0eXBlTmFtZT86IHN0cmluZzsgaXNMaXN0OiBib29sZWFuIH0ge1xuICAgIGNvbnN0IHByb3AgPSBmaW5kUHJvcGVydHkob2JqLCAndHlwZScpO1xuICAgIGlmICghcHJvcCkgcmV0dXJuIHsgaXNMaXN0OiBmYWxzZSB9O1xuXG4gICAgaWYgKHRzLmlzQXJyYXlMaXRlcmFsRXhwcmVzc2lvbihwcm9wLmluaXRpYWxpemVyKSkge1xuICAgICAgICBjb25zdCBlbGVtZW50ID0gcHJvcC5pbml0aWFsaXplci5lbGVtZW50c1swXTtcbiAgICAgICAgcmV0dXJuIHsgdHlwZU5hbWU6IGVsZW1lbnQgPyByZXNvbHZlVHlwZUV4cHJlc3Npb25OYW1lKGVsZW1lbnQpIDogdW5kZWZpbmVkLCBpc0xpc3Q6IHRydWUgfTtcbiAgICB9XG5cbiAgICByZXR1cm4geyB0eXBlTmFtZTogcmVzb2x2ZVR5cGVFeHByZXNzaW9uTmFtZShwcm9wLmluaXRpYWxpemVyKSwgaXNMaXN0OiBmYWxzZSB9O1xufVxuXG5pbnRlcmZhY2UgRW51bUluZm8ge1xuICAgIG9wdGlvbnM6IFBsYXlHcm91bmRFbnVtT3B0aW9uW107XG59XG5cbmZ1bmN0aW9uIGNvbGxlY3RFbnVtcyhzb3VyY2VGaWxlczogdHMuU291cmNlRmlsZVtdKTogTWFwPHN0cmluZywgRW51bUluZm8+IHtcbiAgICBjb25zdCBlbnVtcyA9IG5ldyBNYXA8c3RyaW5nLCBFbnVtSW5mbz4oKTtcblxuICAgIGZvciAoY29uc3Qgc291cmNlRmlsZSBvZiBzb3VyY2VGaWxlcykge1xuICAgICAgICBjb25zdCB2aXNpdCA9IChub2RlOiB0cy5Ob2RlKSA9PiB7XG4gICAgICAgICAgICBpZiAodHMuaXNFbnVtRGVjbGFyYXRpb24obm9kZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcHRpb25zOiBQbGF5R3JvdW5kRW51bU9wdGlvbltdID0gW107XG4gICAgICAgICAgICAgICAgbGV0IG5leHRWYWx1ZSA9IDA7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBtZW1iZXIgb2Ygbm9kZS5tZW1iZXJzKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGxhYmVsID0gdHMuaXNJZGVudGlmaWVyKG1lbWJlci5uYW1lKSA/IG1lbWJlci5uYW1lLnRleHQgOiBtZW1iZXIubmFtZS5nZXRUZXh0KHNvdXJjZUZpbGUpO1xuICAgICAgICAgICAgICAgICAgICBsZXQgdmFsdWUgPSBuZXh0VmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIGlmIChtZW1iZXIuaW5pdGlhbGl6ZXIgJiYgdHMuaXNOdW1lcmljTGl0ZXJhbChtZW1iZXIuaW5pdGlhbGl6ZXIpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IE51bWJlcihtZW1iZXIuaW5pdGlhbGl6ZXIudGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy5wdXNoKHsgbGFiZWwsIHZhbHVlIH0pO1xuICAgICAgICAgICAgICAgICAgICBuZXh0VmFsdWUgPSB2YWx1ZSArIDE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVudW1zLnNldChub2RlLm5hbWUudGV4dCwgeyBvcHRpb25zIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHMuZm9yRWFjaENoaWxkKG5vZGUsIHZpc2l0KTtcbiAgICAgICAgfTtcbiAgICAgICAgdmlzaXQoc291cmNlRmlsZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVudW1zO1xufVxuXG4vKipcbiAqIFNjYW5zIGV2ZXJ5IC50cyBmaWxlIHVuZGVyIGBhc3NldHNEaXJgIGZvciBgQGNjY2xhc3MoLi4uKWAgY2xhc3NlcyBjb250YWluaW5nXG4gKiBgQHBsYXlHcm91bmRGaWVsZCguLi4pYC1kZWNvcmF0ZWQgcHJvcGVydGllcywgcmV0dXJuaW5nIGEgbWFwIGtleWVkIGJ5IHRoZSBjY2NsYXNzIG5hbWVcbiAqIChtYXRjaGluZyB0aGUgYF9fdHlwZV9fYCBzdHJpbmcgdXNlZCBpbiBzZXJpYWxpemVkIC5zY2VuZS8ucHJlZmFiIGZpbGVzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNjYW5EZWNvcmF0b3JzKGFzc2V0c0Rpcjogc3RyaW5nKTogTWFwPHN0cmluZywgRGVjb3JhdGVkQ2xhc3M+IHtcbiAgICBjb25zdCBmaWxlcyA9IGZpbmRUc0ZpbGVzKGFzc2V0c0Rpcik7XG4gICAgY29uc3Qgc291cmNlRmlsZXMgPSBmaWxlcy5tYXAoKGZpbGUpID0+XG4gICAgICAgIHRzLmNyZWF0ZVNvdXJjZUZpbGUoZmlsZSwgZnMucmVhZEZpbGVTeW5jKGZpbGUsICd1dGY4JyksIHRzLlNjcmlwdFRhcmdldC5FUzIwMjAsIHRydWUpXG4gICAgKTtcblxuICAgIGNvbnN0IGVudW1zID0gY29sbGVjdEVudW1zKHNvdXJjZUZpbGVzKTtcbiAgICBjb25zdCBjbGFzc2VzID0gbmV3IE1hcDxzdHJpbmcsIERlY29yYXRlZENsYXNzPigpO1xuXG4gICAgZm9yIChjb25zdCBzb3VyY2VGaWxlIG9mIHNvdXJjZUZpbGVzKSB7XG4gICAgICAgIGNvbnN0IHZpc2l0ID0gKG5vZGU6IHRzLk5vZGUpID0+IHtcbiAgICAgICAgICAgIGlmICh0cy5pc0NsYXNzRGVjbGFyYXRpb24obm9kZSkgJiYgbm9kZS5uYW1lKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2NjbGFzc0NhbGwgPSBnZXREZWNvcmF0b3JDYWxsKG5vZGUsICdjY2NsYXNzJyk7XG4gICAgICAgICAgICAgICAgaWYgKGNjY2xhc3NDYWxsIHx8IGhhc0JhcmVPckNhbGxlZERlY29yYXRvcihub2RlLCAnY2NjbGFzcycpKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsYXNzTmFtZSA9IChjY2NsYXNzQ2FsbCAmJiBnZXRTdHJpbmdMaXRlcmFsQXJnKGNjY2xhc3NDYWxsLCAwKSkgPz8gbm9kZS5uYW1lLnRleHQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpZWxkczogRGVjb3JhdGVkRmllbGRbXSA9IFtdO1xuXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbWVtYmVyIG9mIG5vZGUubWVtYmVycykge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCF0cy5pc1Byb3BlcnR5RGVjbGFyYXRpb24obWVtYmVyKSB8fCAhdHMuaXNJZGVudGlmaWVyKG1lbWJlci5uYW1lKSkgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpZWxkQ2FsbCA9IGdldERlY29yYXRvckNhbGwobWVtYmVyLCAncGxheUdyb3VuZEZpZWxkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWZpZWxkQ2FsbCkgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByb3BlcnR5S2V5ID0gbWVtYmVyLm5hbWUudGV4dDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9wdGlvbnNPYmogPSBnZXRPYmplY3RMaXRlcmFsQXJnKGZpZWxkQ2FsbCwgMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnNPYmopIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGBbY29jb3MtcGxheWdyb3VuZF0gQHBsYXlHcm91bmRGaWVsZCBvbiAke2NsYXNzTmFtZX0uJHtwcm9wZXJ0eUtleX0gaXMgbWlzc2luZyBhbiBvcHRpb25zIG9iamVjdCwgc2tpcHBpbmcuYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgdHlwZU5hbWUsIGlzTGlzdCB9ID0gZ2V0VHlwZUluZm9Qcm9wKG9wdGlvbnNPYmopO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGFiZWwgPSBnZXRTdHJpbmdQcm9wKG9wdGlvbnNPYmosICdsYWJlbCcpID8/IHByb3BlcnR5S2V5O1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZ3JvdXAgPSBnZXRTdHJpbmdQcm9wKG9wdGlvbnNPYmosICdncm91cCcpO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXR5cGVOYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgW2NvY29zLXBsYXlncm91bmRdIEBwbGF5R3JvdW5kRmllbGQgb24gJHtjbGFzc05hbWV9LiR7cHJvcGVydHlLZXl9IGhhcyBubyByZXNvbHZhYmxlIFwidHlwZVwiLCBza2lwcGluZy5gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgYnVpbHRpbktpbmQgPSBCVUlMVElOX0tJTkRfQllfVFlQRV9OQU1FW3R5cGVOYW1lXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChidWlsdGluS2luZCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkcy5wdXNoKHsgY2xhc3NOYW1lLCBwcm9wZXJ0eUtleSwga2luZDogYnVpbHRpbktpbmQsIGxhYmVsLCBncm91cCwgaXNMaXN0IH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlbnVtSW5mbyA9IGVudW1zLmdldCh0eXBlTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW51bUluZm8pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZHMucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHlLZXksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtpbmQ6ICdlbnVtJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdyb3VwLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtT3B0aW9uczogZW51bUluZm8ub3B0aW9ucyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNMaXN0LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYFtjb2Nvcy1wbGF5Z3JvdW5kXSBAcGxheUdyb3VuZEZpZWxkIG9uICR7Y2xhc3NOYW1lfS4ke3Byb3BlcnR5S2V5fSByZWZlcmVuY2VzIHVua25vd24gdHlwZSBcIiR7dHlwZU5hbWV9XCIsIHNraXBwaW5nLmBcbiAgICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBpZiAoZmllbGRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzZXMuc2V0KGNsYXNzTmFtZSwgeyBjbGFzc05hbWUsIGZpZWxkcyB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRzLmZvckVhY2hDaGlsZChub2RlLCB2aXNpdCk7XG4gICAgICAgIH07XG4gICAgICAgIHZpc2l0KHNvdXJjZUZpbGUpO1xuICAgIH1cblxuICAgIHJldHVybiBjbGFzc2VzO1xufVxuXG4vKipcbiAqIEZsYXR0ZW5zIHRoZSBwZXItY2xhc3MgbWFwIGludG8gYHByb3BlcnR5S2V5IC0+IGNhbmRpZGF0ZSBmaWVsZHNgLiBDb2NvcyBDcmVhdG9yJ3Mgc2NlbmUvcHJlZmFiXG4gKiBmaWxlcyBpZGVudGlmeSBjdXN0b20gY29tcG9uZW50IGluc3RhbmNlcyBieSBhbiBpbnRlcm5hbCAob2Z0ZW4gY29tcHJlc3NlZCkgY2xhc3MgaWQsIG5vdCB0aGVcbiAqIHBsYWluIGBAY2NjbGFzc2AgbmFtZSDigJQgdGhhdCBpbnRlcm5hbCBlbmNvZGluZyBpcyB1bmRvY3VtZW50ZWQgYW5kIG5vdCBzYWZlbHkgcmVwcm9kdWNpYmxlXG4gKiBvdXRzaWRlIGEgcnVubmluZyBDb2NvcyBDcmVhdG9yIHByb2Nlc3MsIHNvIHNjYW5TY2VuZXMudHMgZGVsaWJlcmF0ZWx5IGRvZXMgTk9UIHRyeSB0byByZXNvbHZlXG4gKiBgX190eXBlX19gIGJhY2sgdG8gYSBjbGFzcyBuYW1lLiBJbnN0ZWFkIGl0IG1hdGNoZXMgY29tcG9uZW50cyBzdHJ1Y3R1cmFsbHksIGJ5IHdoaWNoXG4gKiBgQHBsYXlHcm91bmRGaWVsZGAtZGVjb3JhdGVkIHByb3BlcnR5IGtleXMgYXJlIHByZXNlbnQgb24gYSBzZXJpYWxpemVkIG9iamVjdC4gVGhpcyBmbGF0dGVuZWQsXG4gKiBwcm9wZXJ0eS1rZXkta2V5ZWQgaW5kZXggaXMgd2hhdCBtYWtlcyB0aGF0IHBvc3NpYmxlOyBhIGBjb25zb2xlLndhcm5gIGlzIGVtaXR0ZWQgYXQgZXhwb3J0XG4gKiB0aW1lIChzZWUgZXhwb3J0LnRzKSBpZiB0aGUgc2FtZSBwcm9wZXJ0eSBrZXkgaXMgZGVjb3JhdGVkIG9uIG1vcmUgdGhhbiBvbmUgY2xhc3MsIHNpbmNlIHRoYXQnc1xuICogdGhlIG9uZSBjYXNlIHRoaXMgYXBwcm9hY2ggY2FuJ3QgZGlzYW1iaWd1YXRlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRQcm9wZXJ0eUtleUluZGV4KGNsYXNzZXM6IE1hcDxzdHJpbmcsIERlY29yYXRlZENsYXNzPik6IE1hcDxzdHJpbmcsIERlY29yYXRlZEZpZWxkW10+IHtcbiAgICBjb25zdCBpbmRleCA9IG5ldyBNYXA8c3RyaW5nLCBEZWNvcmF0ZWRGaWVsZFtdPigpO1xuICAgIGZvciAoY29uc3QgZGVjb3JhdGVkQ2xhc3Mgb2YgY2xhc3Nlcy52YWx1ZXMoKSkge1xuICAgICAgICBmb3IgKGNvbnN0IGZpZWxkIG9mIGRlY29yYXRlZENsYXNzLmZpZWxkcykge1xuICAgICAgICAgICAgY29uc3QgY2FuZGlkYXRlcyA9IGluZGV4LmdldChmaWVsZC5wcm9wZXJ0eUtleSkgPz8gW107XG4gICAgICAgICAgICBjYW5kaWRhdGVzLnB1c2goZmllbGQpO1xuICAgICAgICAgICAgaW5kZXguc2V0KGZpZWxkLnByb3BlcnR5S2V5LCBjYW5kaWRhdGVzKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaW5kZXg7XG59XG4iXX0=