import * as fs from 'fs';
import * as path from 'path';
import { DecoratedField, ManifestField, PlayGroundFieldKind } from './types';

/**
 * Cocos Creator's source .scene/.prefab files are a flat JSON array of plain objects; cross
 * references (parent/child/component links) use `{"__id__": N}` indices into that same array.
 * This assumes the project does NOT have "Use Compressed Scene Data" enabled — if it does, these
 * files are a packed/obfuscated format instead and this parsing will fail (see the warning logged
 * below in that case).
 *
 * Custom component instances are matched by which decorated property keys they carry, NOT by
 * `__type__` (see buildPropertyKeyIndex() in scanDecorators.ts for why: `__type__` for a custom
 * component is an internal, often-compressed class id, not the plain @ccclass name). That alone
 * isn't enough, though: BUILT-IN engine types (`cc.Sprite`, `cc.ParticleSystem2D`, and even
 * nested data types like `cc.ColorKey`/`cc.GradientRange` used by particle-system color-over-time
 * modules) commonly reuse very ordinary property names like `color`, and any project with enough
 * third-party prefabs (a purchased VFX pack, say) will have thousands of unrelated objects
 * carrying a `color` key. Built-in engine types always serialize with a plain, readable
 * `__type__` starting with `"cc."`; a compressed custom-script class id never does (confirmed
 * empirically: GameManager's script uuid `dd0a767d-...` serializes as `__type__: "dd0a7Z9TVR..."`,
 * not `"cc...."`). So objects whose `__type__` starts with `"cc."` are skipped entirely before
 * property-key matching — this is what actually keeps a "color" field from matching every
 * particle-system tint in the project.
 */

function findSceneFiles(dir: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findSceneFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.scene') || entry.name.endsWith('.prefab'))) {
            results.push(fullPath);
        }
    }
    return results;
}

function resolveNodePath(objects: any[], nodeIndex: number | undefined): string {
    const segments: string[] = [];
    let current = nodeIndex;
    const seen = new Set<number>();

    while (current !== undefined && !seen.has(current)) {
        seen.add(current);
        const node = objects[current];
        if (!node || typeof node !== 'object') break;

        segments.unshift(typeof node._name === 'string' && node._name.length > 0 ? node._name : `#${current}`);
        current = node._parent && typeof node._parent.__id__ === 'number' ? node._parent.__id__ : undefined;
    }

    return segments.length > 0 ? segments.join('/') : '(unknown node)';
}

function extractScalarValue(kind: PlayGroundFieldKind, raw: any): any {
    switch (kind) {
        case 'color':
            return raw && typeof raw === 'object'
                ? { r: raw.r ?? 0, g: raw.g ?? 0, b: raw.b ?? 0, a: raw.a ?? 255 }
                : null;
        case 'vec2':
            return raw && typeof raw === 'object' ? { x: raw.x ?? 0, y: raw.y ?? 0 } : null;
        case 'vec3':
            return raw && typeof raw === 'object' ? { x: raw.x ?? 0, y: raw.y ?? 0, z: raw.z ?? 0 } : null;
        case 'vec4':
            return raw && typeof raw === 'object'
                ? { x: raw.x ?? 0, y: raw.y ?? 0, z: raw.z ?? 0, w: raw.w ?? 0 }
                : null;
        default:
            return raw ?? null;
    }
}

function extractFieldValue(field: DecoratedField, raw: any): any {
    if (field.isList) {
        return Array.isArray(raw) ? raw.map((item) => extractScalarValue(field.kind, item)) : [];
    }
    return extractScalarValue(field.kind, raw);
}

/**
 * Walks every .scene (restricted to `includedScenes` when given — see `getIncludedScenePaths()`
 * in export.ts, which reads the actual built `settings.json` so a scene that merely exists in the
 * project but isn't part of *this* build, like an old test scene, doesn't leak into the manifest)
 * and every .prefab (always scanned — prefabs are shared/reachable in ways that are hard to trace
 * reliably from source alone) under `assetsDir`. For every serialized object that carries at least
 * one decorated property key as an own property, reads the current value of every decorated field
 * found on it.
 */
export function scanScenes(
    assetsDir: string,
    propertyKeyIndex: Map<string, DecoratedField[]>,
    includedScenes: Set<string> | null = null,
): ManifestField[] {
    const manifest: ManifestField[] = [];
    if (propertyKeyIndex.size === 0) return manifest;

    const warnedCollisions = new Set<string>();
    const propertyKeys = Array.from(propertyKeyIndex.keys());

    for (const sceneFile of findSceneFiles(assetsDir)) {
        const relativePath = path.relative(assetsDir, sceneFile).split(path.sep).join('/');

        if (includedScenes && sceneFile.endsWith('.scene') && !includedScenes.has(relativePath)) {
            continue;
        }

        let objects: any;
        try {
            objects = JSON.parse(fs.readFileSync(sceneFile, 'utf8'));
        } catch (error) {
            console.warn(
                `[cocos-playground] Failed to parse ${sceneFile} as JSON, skipping (is "Use Compressed Scene Data" enabled for this project?): ${error}`
            );
            continue;
        }
        if (!Array.isArray(objects)) continue;

        objects.forEach((obj: any, index: number) => {
            if (!obj || typeof obj !== 'object') return;
            if (typeof obj.__type__ === 'string' && obj.__type__.startsWith('cc.')) return;

            const matchedKeys = propertyKeys.filter((key) => Object.prototype.hasOwnProperty.call(obj, key));
            if (matchedKeys.length === 0) return;

            const nodeIndex = obj.node && typeof obj.node.__id__ === 'number' ? obj.node.__id__ : undefined;
            const nodePath = resolveNodePath(objects, nodeIndex);

            for (const key of matchedKeys) {
                const candidates = propertyKeyIndex.get(key)!;
                if (candidates.length > 1 && !warnedCollisions.has(key)) {
                    warnedCollisions.add(key);
                    console.warn(
                        `[cocos-playground] Property "${key}" is @playGroundField on more than one class (${candidates
                            .map((c) => c.className)
                            .join(', ')}); using the first match for every instance. Rename one of them to disambiguate.`
                    );
                }

                const field = candidates[0];
                manifest.push({
                    scene: relativePath,
                    nodePath,
                    componentType: field.className,
                    propertyKey: field.propertyKey,
                    label: field.label,
                    kind: field.kind,
                    group: field.group,
                    enumOptions: field.enumOptions,
                    isList: field.isList,
                    value: extractFieldValue(field, obj[key]),
                });
            }
        });
    }

    return manifest;
}
