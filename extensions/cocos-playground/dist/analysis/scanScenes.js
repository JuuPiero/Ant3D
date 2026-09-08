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
exports.scanScenes = scanScenes;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
function findSceneFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir))
        return results;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findSceneFiles(fullPath));
        }
        else if (entry.isFile() && (entry.name.endsWith('.scene') || entry.name.endsWith('.prefab'))) {
            results.push(fullPath);
        }
    }
    return results;
}
function resolveNodePath(objects, nodeIndex) {
    const segments = [];
    let current = nodeIndex;
    const seen = new Set();
    while (current !== undefined && !seen.has(current)) {
        seen.add(current);
        const node = objects[current];
        if (!node || typeof node !== 'object')
            break;
        segments.unshift(typeof node._name === 'string' && node._name.length > 0 ? node._name : `#${current}`);
        current = node._parent && typeof node._parent.__id__ === 'number' ? node._parent.__id__ : undefined;
    }
    return segments.length > 0 ? segments.join('/') : '(unknown node)';
}
function extractScalarValue(kind, raw) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    switch (kind) {
        case 'color':
            return raw && typeof raw === 'object'
                ? { r: (_a = raw.r) !== null && _a !== void 0 ? _a : 0, g: (_b = raw.g) !== null && _b !== void 0 ? _b : 0, b: (_c = raw.b) !== null && _c !== void 0 ? _c : 0, a: (_d = raw.a) !== null && _d !== void 0 ? _d : 255 }
                : null;
        case 'vec2':
            return raw && typeof raw === 'object' ? { x: (_e = raw.x) !== null && _e !== void 0 ? _e : 0, y: (_f = raw.y) !== null && _f !== void 0 ? _f : 0 } : null;
        case 'vec3':
            return raw && typeof raw === 'object' ? { x: (_g = raw.x) !== null && _g !== void 0 ? _g : 0, y: (_h = raw.y) !== null && _h !== void 0 ? _h : 0, z: (_j = raw.z) !== null && _j !== void 0 ? _j : 0 } : null;
        case 'vec4':
            return raw && typeof raw === 'object'
                ? { x: (_k = raw.x) !== null && _k !== void 0 ? _k : 0, y: (_l = raw.y) !== null && _l !== void 0 ? _l : 0, z: (_m = raw.z) !== null && _m !== void 0 ? _m : 0, w: (_o = raw.w) !== null && _o !== void 0 ? _o : 0 }
                : null;
        default:
            return raw !== null && raw !== void 0 ? raw : null;
    }
}
function extractFieldValue(field, raw) {
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
function scanScenes(assetsDir, propertyKeyIndex, includedScenes = null) {
    const manifest = [];
    if (propertyKeyIndex.size === 0)
        return manifest;
    const warnedCollisions = new Set();
    const propertyKeys = Array.from(propertyKeyIndex.keys());
    for (const sceneFile of findSceneFiles(assetsDir)) {
        const relativePath = path.relative(assetsDir, sceneFile).split(path.sep).join('/');
        if (includedScenes && sceneFile.endsWith('.scene') && !includedScenes.has(relativePath)) {
            continue;
        }
        let objects;
        try {
            objects = JSON.parse(fs.readFileSync(sceneFile, 'utf8'));
        }
        catch (error) {
            console.warn(`[cocos-playground] Failed to parse ${sceneFile} as JSON, skipping (is "Use Compressed Scene Data" enabled for this project?): ${error}`);
            continue;
        }
        if (!Array.isArray(objects))
            continue;
        objects.forEach((obj, index) => {
            if (!obj || typeof obj !== 'object')
                return;
            if (typeof obj.__type__ === 'string' && obj.__type__.startsWith('cc.'))
                return;
            const matchedKeys = propertyKeys.filter((key) => Object.prototype.hasOwnProperty.call(obj, key));
            if (matchedKeys.length === 0)
                return;
            const nodeIndex = obj.node && typeof obj.node.__id__ === 'number' ? obj.node.__id__ : undefined;
            const nodePath = resolveNodePath(objects, nodeIndex);
            for (const key of matchedKeys) {
                const candidates = propertyKeyIndex.get(key);
                if (candidates.length > 1 && !warnedCollisions.has(key)) {
                    warnedCollisions.add(key);
                    console.warn(`[cocos-playground] Property "${key}" is @playGroundField on more than one class (${candidates
                        .map((c) => c.className)
                        .join(', ')}); using the first match for every instance. Rename one of them to disambiguate.`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NhblNjZW5lcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS9hbmFseXNpcy9zY2FuU2NlbmVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBNkZBLGdDQW9FQztBQWpLRCx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBRzdCOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQW9CRztBQUVILFNBQVMsY0FBYyxDQUFDLEdBQVc7SUFDL0IsTUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO0lBQzdCLElBQUksQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQztRQUFFLE9BQU8sT0FBTyxDQUFDO0lBRXhDLEtBQUssTUFBTSxLQUFLLElBQUksRUFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO1FBQy9ELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM1QyxJQUFJLEtBQUssQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO1lBQ3RCLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxjQUFjLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUM5QyxDQUFDO2FBQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLENBQUM7WUFDN0YsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMzQixDQUFDO0lBQ0wsQ0FBQztJQUNELE9BQU8sT0FBTyxDQUFDO0FBQ25CLENBQUM7QUFFRCxTQUFTLGVBQWUsQ0FBQyxPQUFjLEVBQUUsU0FBNkI7SUFDbEUsTUFBTSxRQUFRLEdBQWEsRUFBRSxDQUFDO0lBQzlCLElBQUksT0FBTyxHQUFHLFNBQVMsQ0FBQztJQUN4QixNQUFNLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBVSxDQUFDO0lBRS9CLE9BQU8sT0FBTyxLQUFLLFNBQVMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUNqRCxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2xCLE1BQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM5QixJQUFJLENBQUMsSUFBSSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVE7WUFBRSxNQUFNO1FBRTdDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxJQUFJLENBQUMsS0FBSyxLQUFLLFFBQVEsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksT0FBTyxFQUFFLENBQUMsQ0FBQztRQUN2RyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sSUFBSSxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztJQUN4RyxDQUFDO0lBRUQsT0FBTyxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLENBQUM7QUFDdkUsQ0FBQztBQUVELFNBQVMsa0JBQWtCLENBQUMsSUFBeUIsRUFBRSxHQUFROztJQUMzRCxRQUFRLElBQUksRUFBRSxDQUFDO1FBQ1gsS0FBSyxPQUFPO1lBQ1IsT0FBTyxHQUFHLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUTtnQkFDakMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQUEsR0FBRyxDQUFDLENBQUMsbUNBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFBLEdBQUcsQ0FBQyxDQUFDLG1DQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBQSxHQUFHLENBQUMsQ0FBQyxtQ0FBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQUEsR0FBRyxDQUFDLENBQUMsbUNBQUksR0FBRyxFQUFFO2dCQUNsRSxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ2YsS0FBSyxNQUFNO1lBQ1AsT0FBTyxHQUFHLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFBLEdBQUcsQ0FBQyxDQUFDLG1DQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBQSxHQUFHLENBQUMsQ0FBQyxtQ0FBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQ3BGLEtBQUssTUFBTTtZQUNQLE9BQU8sR0FBRyxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBQSxHQUFHLENBQUMsQ0FBQyxtQ0FBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQUEsR0FBRyxDQUFDLENBQUMsbUNBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFBLEdBQUcsQ0FBQyxDQUFDLG1DQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDbkcsS0FBSyxNQUFNO1lBQ1AsT0FBTyxHQUFHLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUTtnQkFDakMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQUEsR0FBRyxDQUFDLENBQUMsbUNBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxNQUFBLEdBQUcsQ0FBQyxDQUFDLG1DQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsTUFBQSxHQUFHLENBQUMsQ0FBQyxtQ0FBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLE1BQUEsR0FBRyxDQUFDLENBQUMsbUNBQUks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LENBQUMsQ0FBQztpQkFDNUMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVELE9BQU8sUUFBUSxDQUFDO0FBQ3BCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgRGVjb3JhdGVkRmllbGQsIE1hbmlmZXN0RmllbGQsIFBsYXlHcm91bmRGaWVsZEtpbmQgfSBmcm9tICcuL3R5cGVzJztcblxuLyoqXG4gKiBDb2NvcyBDcmVhdG9yJ3Mgc291cmNlIC5zY2VuZS8ucHJlZmFiIGZpbGVzIGFyZSBhIGZsYXQgSlNPTiBhcnJheSBvZiBwbGFpbiBvYmplY3RzOyBjcm9zc1xuICogcmVmZXJlbmNlcyAocGFyZW50L2NoaWxkL2NvbXBvbmVudCBsaW5rcykgdXNlIGB7XCJfX2lkX19cIjogTn1gIGluZGljZXMgaW50byB0aGF0IHNhbWUgYXJyYXkuXG4gKiBUaGlzIGFzc3VtZXMgdGhlIHByb2plY3QgZG9lcyBOT1QgaGF2ZSBcIlVzZSBDb21wcmVzc2VkIFNjZW5lIERhdGFcIiBlbmFibGVkIOKAlCBpZiBpdCBkb2VzLCB0aGVzZVxuICogZmlsZXMgYXJlIGEgcGFja2VkL29iZnVzY2F0ZWQgZm9ybWF0IGluc3RlYWQgYW5kIHRoaXMgcGFyc2luZyB3aWxsIGZhaWwgKHNlZSB0aGUgd2FybmluZyBsb2dnZWRcbiAqIGJlbG93IGluIHRoYXQgY2FzZSkuXG4gKlxuICogQ3VzdG9tIGNvbXBvbmVudCBpbnN0YW5jZXMgYXJlIG1hdGNoZWQgYnkgd2hpY2ggZGVjb3JhdGVkIHByb3BlcnR5IGtleXMgdGhleSBjYXJyeSwgTk9UIGJ5XG4gKiBgX190eXBlX19gIChzZWUgYnVpbGRQcm9wZXJ0eUtleUluZGV4KCkgaW4gc2NhbkRlY29yYXRvcnMudHMgZm9yIHdoeTogYF9fdHlwZV9fYCBmb3IgYSBjdXN0b21cbiAqIGNvbXBvbmVudCBpcyBhbiBpbnRlcm5hbCwgb2Z0ZW4tY29tcHJlc3NlZCBjbGFzcyBpZCwgbm90IHRoZSBwbGFpbiBAY2NjbGFzcyBuYW1lKS4gVGhhdCBhbG9uZVxuICogaXNuJ3QgZW5vdWdoLCB0aG91Z2g6IEJVSUxULUlOIGVuZ2luZSB0eXBlcyAoYGNjLlNwcml0ZWAsIGBjYy5QYXJ0aWNsZVN5c3RlbTJEYCwgYW5kIGV2ZW5cbiAqIG5lc3RlZCBkYXRhIHR5cGVzIGxpa2UgYGNjLkNvbG9yS2V5YC9gY2MuR3JhZGllbnRSYW5nZWAgdXNlZCBieSBwYXJ0aWNsZS1zeXN0ZW0gY29sb3Itb3Zlci10aW1lXG4gKiBtb2R1bGVzKSBjb21tb25seSByZXVzZSB2ZXJ5IG9yZGluYXJ5IHByb3BlcnR5IG5hbWVzIGxpa2UgYGNvbG9yYCwgYW5kIGFueSBwcm9qZWN0IHdpdGggZW5vdWdoXG4gKiB0aGlyZC1wYXJ0eSBwcmVmYWJzIChhIHB1cmNoYXNlZCBWRlggcGFjaywgc2F5KSB3aWxsIGhhdmUgdGhvdXNhbmRzIG9mIHVucmVsYXRlZCBvYmplY3RzXG4gKiBjYXJyeWluZyBhIGBjb2xvcmAga2V5LiBCdWlsdC1pbiBlbmdpbmUgdHlwZXMgYWx3YXlzIHNlcmlhbGl6ZSB3aXRoIGEgcGxhaW4sIHJlYWRhYmxlXG4gKiBgX190eXBlX19gIHN0YXJ0aW5nIHdpdGggYFwiY2MuXCJgOyBhIGNvbXByZXNzZWQgY3VzdG9tLXNjcmlwdCBjbGFzcyBpZCBuZXZlciBkb2VzIChjb25maXJtZWRcbiAqIGVtcGlyaWNhbGx5OiBHYW1lTWFuYWdlcidzIHNjcmlwdCB1dWlkIGBkZDBhNzY3ZC0uLi5gIHNlcmlhbGl6ZXMgYXMgYF9fdHlwZV9fOiBcImRkMGE3WjlUVlIuLi5cImAsXG4gKiBub3QgYFwiY2MuLi4uXCJgKS4gU28gb2JqZWN0cyB3aG9zZSBgX190eXBlX19gIHN0YXJ0cyB3aXRoIGBcImNjLlwiYCBhcmUgc2tpcHBlZCBlbnRpcmVseSBiZWZvcmVcbiAqIHByb3BlcnR5LWtleSBtYXRjaGluZyDigJQgdGhpcyBpcyB3aGF0IGFjdHVhbGx5IGtlZXBzIGEgXCJjb2xvclwiIGZpZWxkIGZyb20gbWF0Y2hpbmcgZXZlcnlcbiAqIHBhcnRpY2xlLXN5c3RlbSB0aW50IGluIHRoZSBwcm9qZWN0LlxuICovXG5cbmZ1bmN0aW9uIGZpbmRTY2VuZUZpbGVzKGRpcjogc3RyaW5nKTogc3RyaW5nW10ge1xuICAgIGNvbnN0IHJlc3VsdHM6IHN0cmluZ1tdID0gW107XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKGRpcikpIHJldHVybiByZXN1bHRzO1xuXG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiBmcy5yZWFkZGlyU3luYyhkaXIsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KSkge1xuICAgICAgICBjb25zdCBmdWxsUGF0aCA9IHBhdGguam9pbihkaXIsIGVudHJ5Lm5hbWUpO1xuICAgICAgICBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkge1xuICAgICAgICAgICAgcmVzdWx0cy5wdXNoKC4uLmZpbmRTY2VuZUZpbGVzKGZ1bGxQYXRoKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoZW50cnkuaXNGaWxlKCkgJiYgKGVudHJ5Lm5hbWUuZW5kc1dpdGgoJy5zY2VuZScpIHx8IGVudHJ5Lm5hbWUuZW5kc1dpdGgoJy5wcmVmYWInKSkpIHtcbiAgICAgICAgICAgIHJlc3VsdHMucHVzaChmdWxsUGF0aCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdHM7XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVOb2RlUGF0aChvYmplY3RzOiBhbnlbXSwgbm9kZUluZGV4OiBudW1iZXIgfCB1bmRlZmluZWQpOiBzdHJpbmcge1xuICAgIGNvbnN0IHNlZ21lbnRzOiBzdHJpbmdbXSA9IFtdO1xuICAgIGxldCBjdXJyZW50ID0gbm9kZUluZGV4O1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgU2V0PG51bWJlcj4oKTtcblxuICAgIHdoaWxlIChjdXJyZW50ICE9PSB1bmRlZmluZWQgJiYgIXNlZW4uaGFzKGN1cnJlbnQpKSB7XG4gICAgICAgIHNlZW4uYWRkKGN1cnJlbnQpO1xuICAgICAgICBjb25zdCBub2RlID0gb2JqZWN0c1tjdXJyZW50XTtcbiAgICAgICAgaWYgKCFub2RlIHx8IHR5cGVvZiBub2RlICE9PSAnb2JqZWN0JykgYnJlYWs7XG5cbiAgICAgICAgc2VnbWVudHMudW5zaGlmdCh0eXBlb2Ygbm9kZS5fbmFtZSA9PT0gJ3N0cmluZycgJiYgbm9kZS5fbmFtZS5sZW5ndGggPiAwID8gbm9kZS5fbmFtZSA6IGAjJHtjdXJyZW50fWApO1xuICAgICAgICBjdXJyZW50ID0gbm9kZS5fcGFyZW50ICYmIHR5cGVvZiBub2RlLl9wYXJlbnQuX19pZF9fID09PSAnbnVtYmVyJyA/IG5vZGUuX3BhcmVudC5fX2lkX18gOiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNlZ21lbnRzLmxlbmd0aCA+IDAgPyBzZWdtZW50cy5qb2luKCcvJykgOiAnKHVua25vd24gbm9kZSknO1xufVxuXG5mdW5jdGlvbiBleHRyYWN0U2NhbGFyVmFsdWUoa2luZDogUGxheUdyb3VuZEZpZWxkS2luZCwgcmF3OiBhbnkpOiBhbnkge1xuICAgIHN3aXRjaCAoa2luZCkge1xuICAgICAgICBjYXNlICdjb2xvcic6XG4gICAgICAgICAgICByZXR1cm4gcmF3ICYmIHR5cGVvZiByYXcgPT09ICdvYmplY3QnXG4gICAgICAgICAgICAgICAgPyB7IHI6IHJhdy5yID8/IDAsIGc6IHJhdy5nID8/IDAsIGI6IHJhdy5iID8/IDAsIGE6IHJhdy5hID8/IDI1NSB9XG4gICAgICAgICAgICAgICAgOiBudWxsO1xuICAgICAgICBjYXNlICd2ZWMyJzpcbiAgICAgICAgICAgIHJldHVybiByYXcgJiYgdHlwZW9mIHJhdyA9PT0gJ29iamVjdCcgPyB7IHg6IHJhdy54ID8/IDAsIHk6IHJhdy55ID8/IDAgfSA6IG51bGw7XG4gICAgICAgIGNhc2UgJ3ZlYzMnOlxuICAgICAgICAgICAgcmV0dXJuIHJhdyAmJiB0eXBlb2YgcmF3ID09PSAnb2JqZWN0JyA/IHsgeDogcmF3LnggPz8gMCwgeTogcmF3LnkgPz8gMCwgejogcmF3LnogPz8gMCB9IDogbnVsbDtcbiAgICAgICAgY2FzZSAndmVjNCc6XG4gICAgICAgICAgICByZXR1cm4gcmF3ICYmIHR5cGVvZiByYXcgPT09ICdvYmplY3QnXG4gICAgICAgICAgICAgICAgPyB7IHg6IHJhdy54ID8/IDAsIHk6IHJhdy55ID8/IDAsIHo6IHJhdy56ID8/IDAsIHc6IHJhdy53ID8/IDAgfVxuICAgICAgICAgICAgICAgIDogbnVsbDtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHJldHVybiByYXcgPz8gbnVsbDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RGaWVsZFZhbHVlKGZpZWxkOiBEZWNvcmF0ZWRGaWVsZCwgcmF3OiBhbnkpOiBhbnkge1xuICAgIGlmIChmaWVsZC5pc0xpc3QpIHtcbiAgICAgICAgcmV0dXJuIEFycmF5LmlzQXJyYXkocmF3KSA/IHJhdy5tYXAoKGl0ZW0pID0+IGV4dHJhY3RTY2FsYXJWYWx1ZShmaWVsZC5raW5kLCBpdGVtKSkgOiBbXTtcbiAgICB9XG4gICAgcmV0dXJuIGV4dHJhY3RTY2FsYXJWYWx1ZShmaWVsZC5raW5kLCByYXcpO1xufVxuXG4vKipcbiAqIFdhbGtzIGV2ZXJ5IC5zY2VuZSAocmVzdHJpY3RlZCB0byBgaW5jbHVkZWRTY2VuZXNgIHdoZW4gZ2l2ZW4g4oCUIHNlZSBgZ2V0SW5jbHVkZWRTY2VuZVBhdGhzKClgXG4gKiBpbiBleHBvcnQudHMsIHdoaWNoIHJlYWRzIHRoZSBhY3R1YWwgYnVpbHQgYHNldHRpbmdzLmpzb25gIHNvIGEgc2NlbmUgdGhhdCBtZXJlbHkgZXhpc3RzIGluIHRoZVxuICogcHJvamVjdCBidXQgaXNuJ3QgcGFydCBvZiAqdGhpcyogYnVpbGQsIGxpa2UgYW4gb2xkIHRlc3Qgc2NlbmUsIGRvZXNuJ3QgbGVhayBpbnRvIHRoZSBtYW5pZmVzdClcbiAqIGFuZCBldmVyeSAucHJlZmFiIChhbHdheXMgc2Nhbm5lZCDigJQgcHJlZmFicyBhcmUgc2hhcmVkL3JlYWNoYWJsZSBpbiB3YXlzIHRoYXQgYXJlIGhhcmQgdG8gdHJhY2VcbiAqIHJlbGlhYmx5IGZyb20gc291cmNlIGFsb25lKSB1bmRlciBgYXNzZXRzRGlyYC4gRm9yIGV2ZXJ5IHNlcmlhbGl6ZWQgb2JqZWN0IHRoYXQgY2FycmllcyBhdCBsZWFzdFxuICogb25lIGRlY29yYXRlZCBwcm9wZXJ0eSBrZXkgYXMgYW4gb3duIHByb3BlcnR5LCByZWFkcyB0aGUgY3VycmVudCB2YWx1ZSBvZiBldmVyeSBkZWNvcmF0ZWQgZmllbGRcbiAqIGZvdW5kIG9uIGl0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2NhblNjZW5lcyhcbiAgICBhc3NldHNEaXI6IHN0cmluZyxcbiAgICBwcm9wZXJ0eUtleUluZGV4OiBNYXA8c3RyaW5nLCBEZWNvcmF0ZWRGaWVsZFtdPixcbiAgICBpbmNsdWRlZFNjZW5lczogU2V0PHN0cmluZz4gfCBudWxsID0gbnVsbCxcbik6IE1hbmlmZXN0RmllbGRbXSB7XG4gICAgY29uc3QgbWFuaWZlc3Q6IE1hbmlmZXN0RmllbGRbXSA9IFtdO1xuICAgIGlmIChwcm9wZXJ0eUtleUluZGV4LnNpemUgPT09IDApIHJldHVybiBtYW5pZmVzdDtcblxuICAgIGNvbnN0IHdhcm5lZENvbGxpc2lvbnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBwcm9wZXJ0eUtleXMgPSBBcnJheS5mcm9tKHByb3BlcnR5S2V5SW5kZXgua2V5cygpKTtcblxuICAgIGZvciAoY29uc3Qgc2NlbmVGaWxlIG9mIGZpbmRTY2VuZUZpbGVzKGFzc2V0c0RpcikpIHtcbiAgICAgICAgY29uc3QgcmVsYXRpdmVQYXRoID0gcGF0aC5yZWxhdGl2ZShhc3NldHNEaXIsIHNjZW5lRmlsZSkuc3BsaXQocGF0aC5zZXApLmpvaW4oJy8nKTtcblxuICAgICAgICBpZiAoaW5jbHVkZWRTY2VuZXMgJiYgc2NlbmVGaWxlLmVuZHNXaXRoKCcuc2NlbmUnKSAmJiAhaW5jbHVkZWRTY2VuZXMuaGFzKHJlbGF0aXZlUGF0aCkpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IG9iamVjdHM6IGFueTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIG9iamVjdHMgPSBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhzY2VuZUZpbGUsICd1dGY4JykpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgIGBbY29jb3MtcGxheWdyb3VuZF0gRmFpbGVkIHRvIHBhcnNlICR7c2NlbmVGaWxlfSBhcyBKU09OLCBza2lwcGluZyAoaXMgXCJVc2UgQ29tcHJlc3NlZCBTY2VuZSBEYXRhXCIgZW5hYmxlZCBmb3IgdGhpcyBwcm9qZWN0Pyk6ICR7ZXJyb3J9YFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShvYmplY3RzKSkgY29udGludWU7XG5cbiAgICAgICAgb2JqZWN0cy5mb3JFYWNoKChvYmo6IGFueSwgaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgICAgICAgaWYgKCFvYmogfHwgdHlwZW9mIG9iaiAhPT0gJ29iamVjdCcpIHJldHVybjtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb2JqLl9fdHlwZV9fID09PSAnc3RyaW5nJyAmJiBvYmouX190eXBlX18uc3RhcnRzV2l0aCgnY2MuJykpIHJldHVybjtcblxuICAgICAgICAgICAgY29uc3QgbWF0Y2hlZEtleXMgPSBwcm9wZXJ0eUtleXMuZmlsdGVyKChrZXkpID0+IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpO1xuICAgICAgICAgICAgaWYgKG1hdGNoZWRLZXlzLmxlbmd0aCA9PT0gMCkgcmV0dXJuO1xuXG4gICAgICAgICAgICBjb25zdCBub2RlSW5kZXggPSBvYmoubm9kZSAmJiB0eXBlb2Ygb2JqLm5vZGUuX19pZF9fID09PSAnbnVtYmVyJyA/IG9iai5ub2RlLl9faWRfXyA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGNvbnN0IG5vZGVQYXRoID0gcmVzb2x2ZU5vZGVQYXRoKG9iamVjdHMsIG5vZGVJbmRleCk7XG5cbiAgICAgICAgICAgIGZvciAoY29uc3Qga2V5IG9mIG1hdGNoZWRLZXlzKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY2FuZGlkYXRlcyA9IHByb3BlcnR5S2V5SW5kZXguZ2V0KGtleSkhO1xuICAgICAgICAgICAgICAgIGlmIChjYW5kaWRhdGVzLmxlbmd0aCA+IDEgJiYgIXdhcm5lZENvbGxpc2lvbnMuaGFzKGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgd2FybmVkQ29sbGlzaW9ucy5hZGQoa2V5KTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgICAgICAgICAgYFtjb2Nvcy1wbGF5Z3JvdW5kXSBQcm9wZXJ0eSBcIiR7a2V5fVwiIGlzIEBwbGF5R3JvdW5kRmllbGQgb24gbW9yZSB0aGFuIG9uZSBjbGFzcyAoJHtjYW5kaWRhdGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLm1hcCgoYykgPT4gYy5jbGFzc05hbWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmpvaW4oJywgJyl9KTsgdXNpbmcgdGhlIGZpcnN0IG1hdGNoIGZvciBldmVyeSBpbnN0YW5jZS4gUmVuYW1lIG9uZSBvZiB0aGVtIHRvIGRpc2FtYmlndWF0ZS5gXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgZmllbGQgPSBjYW5kaWRhdGVzWzBdO1xuICAgICAgICAgICAgICAgIG1hbmlmZXN0LnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBzY2VuZTogcmVsYXRpdmVQYXRoLFxuICAgICAgICAgICAgICAgICAgICBub2RlUGF0aCxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50VHlwZTogZmllbGQuY2xhc3NOYW1lLFxuICAgICAgICAgICAgICAgICAgICBwcm9wZXJ0eUtleTogZmllbGQucHJvcGVydHlLZXksXG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiBmaWVsZC5sYWJlbCxcbiAgICAgICAgICAgICAgICAgICAga2luZDogZmllbGQua2luZCxcbiAgICAgICAgICAgICAgICAgICAgZ3JvdXA6IGZpZWxkLmdyb3VwLFxuICAgICAgICAgICAgICAgICAgICBlbnVtT3B0aW9uczogZmllbGQuZW51bU9wdGlvbnMsXG4gICAgICAgICAgICAgICAgICAgIGlzTGlzdDogZmllbGQuaXNMaXN0LFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogZXh0cmFjdEZpZWxkVmFsdWUoZmllbGQsIG9ialtrZXldKSxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG1hbmlmZXN0O1xufVxuIl19