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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportPlayablePackage = exportPlayablePackage;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const jszip_1 = __importDefault(require("jszip"));
const scanDecorators_1 = require("./analysis/scanDecorators");
const scanScenes_1 = require("./analysis/scanScenes");
/** The extension lives at `<project>/extensions/cocos-playground`. */
function findProjectRoot() {
    return path.join(__dirname, '..', '..', '..');
}
function addDirToZip(zip, dir, zipPath) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const entryZipPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            addDirToZip(zip, fullPath, entryZipPath);
        }
        else {
            zip.file(entryZipPath, fs.readFileSync(fullPath));
        }
    }
}
/**
 * Reads which scene(s) actually shipped in this specific build, straight from its own generated
 * `src/settings.json` (`launch.launchScene`, e.g. `"db://assets/Temp.scene"`) — the source of
 * truth for "what's really in the thing about to be zipped up", rather than every `.scene` file
 * that happens to exist under `assets/` (which would include old/unrelated test scenes never
 * checked in this build's "Included Scenes" list). Only covers the launch scene, not every scene
 * a game might transition to later — fine for the common single-scene playable-ad case, but a
 * multi-scene playable would need this extended to also read whatever inter-scene-loading list
 * Cocos records, if any.
 */
function getIncludedScenePaths(webMobileDir) {
    var _a;
    const settingsPath = path.join(webMobileDir, 'src', 'settings.json');
    if (!fs.existsSync(settingsPath))
        return null;
    try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const launchScene = (_a = settings === null || settings === void 0 ? void 0 : settings.launch) === null || _a === void 0 ? void 0 : _a.launchScene;
        if (!launchScene)
            return null;
        const relative = launchScene.replace(/^db:\/\/assets\//, '');
        return new Set([relative]);
    }
    catch (error) {
        console.warn(`[cocos-playground] failed to read ${settingsPath}, scanning all scenes instead: ${error}`);
        return null;
    }
}
/**
 * Scans the project for @playGroundField values, then zips the existing `build/web-mobile`
 * output together with a `playground-manifest.json` into `build/cocos-playground-export/`.
 * Does not trigger a build itself and does not talk to any backend — the user builds for the
 * "Web Mobile" platform via Cocos Creator's own Build panel first, then uploads the resulting
 * zip by hand through the web frontend.
 */
async function exportPlayablePackage(projectRoot = findProjectRoot()) {
    const assetsDir = path.join(projectRoot, 'assets');
    const webMobileDir = path.join(projectRoot, 'build', 'web-mobile');
    const indexHtmlPath = path.join(webMobileDir, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
        throw new Error(`No web-mobile build found at "${webMobileDir}". Build for the "Web Mobile" platform in Cocos Creator's Build panel first, then run this command again.`);
    }
    const decoratedClasses = (0, scanDecorators_1.scanDecorators)(assetsDir);
    const propertyKeyIndex = (0, scanDecorators_1.buildPropertyKeyIndex)(decoratedClasses);
    const includedScenes = getIncludedScenePaths(webMobileDir);
    const fields = (0, scanScenes_1.scanScenes)(assetsDir, propertyKeyIndex, includedScenes);
    const manifest = {
        generatedAt: new Date().toISOString(),
        fields,
    };
    const zip = new jszip_1.default();
    addDirToZip(zip, webMobileDir, 'web-mobile');
    zip.file('playground-manifest.json', JSON.stringify(manifest, null, 2));
    const outDir = path.join(projectRoot, 'build', 'cocos-playground-export');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `playable-${Date.now()}.zip`);
    const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(outFile, content);
    return outFile;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwb3J0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc291cmNlL2V4cG9ydC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQTBEQSxzREFpQ0M7QUEzRkQsdUNBQXlCO0FBQ3pCLDJDQUE2QjtBQUM3QixrREFBMEI7QUFDMUIsOERBQWtGO0FBQ2xGLHNEQUFtRDtBQUduRCxzRUFBc0U7QUFDdEUsU0FBUyxlQUFlO0lBQ3BCLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNsRCxDQUFDO0FBRUQsU0FBUyxXQUFXLENBQUMsR0FBVSxFQUFFLEdBQVcsRUFBRSxPQUFlO0lBQ3pELEtBQUssTUFBTSxLQUFLLElBQUksRUFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUUsRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDO1FBQy9ELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUM1QyxNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztRQUN2RSxJQUFJLEtBQUssQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDO1lBQ3RCLFdBQVcsQ0FBQyxHQUFHLEVBQUUsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzdDLENBQUM7YUFBTSxDQUFDO1lBQ0osR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ3RELENBQUM7SUFDTCxDQUFDO0FBQ0wsQ0FBQztBQUVEOzs7Ozs7Ozs7R0FTRztBQUNILFNBQVMscUJBQXFCLENBQUMsWUFBb0I7O0lBQy9DLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLEtBQUssRUFBRSxlQUFlLENBQUMsQ0FBQztJQUNyRSxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUM7UUFBRSxPQUFPLElBQUksQ0FBQztJQUU5QyxJQUFJLENBQUM7UUFDRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDbkUsTUFBTSxXQUFXLEdBQXVCLE1BQUEsUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFFLE1BQU0sMENBQUUsV0FBVyxDQUFDO1FBQ3RFLElBQUksQ0FBQyxXQUFXO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFFOUIsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM3RCxPQUFPLElBQUksR0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztRQUNiLE9BQU8sQ0FBQyxJQUFJLENBQUMscUNBQXFDLFlBQVksa0NBQWtDLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDekcsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztBQUNMLENBQUM7QUFFRDs7Ozs7O0dBTUc7QUFDSSxLQUFLLFVBQVUscUJBQXFCLENBQUMsY0FBc0IsZUFBZSxFQUFFO0lBQy9FLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ25ELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNuRSxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxZQUFZLENBQUMsQ0FBQztJQUU1RCxJQUFJLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO1FBQ2hDLE1BQU0sSUFBSSxLQUFLLENBQ1gsaUNBQWlDLFlBQVksMkdBQTJHLENBQzNKLENBQUM7SUFDTixDQUFDO0lBRUQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFBLCtCQUFjLEVBQUMsU0FBUyxDQUFDLENBQUM7SUFDbkQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFBLHNDQUFxQixFQUFDLGdCQUFnQixDQUFDLENBQUM7SUFDakUsTUFBTSxjQUFjLEdBQUcscUJBQXFCLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDM0QsTUFBTSxNQUFNLEdBQUcsSUFBQSx1QkFBVSxFQUFDLFNBQVMsRUFBRSxnQkFBZ0IsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUV2RSxNQUFNLFFBQVEsR0FBcUI7UUFDL0IsV0FBVyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFO1FBQ3JDLE1BQU07S0FDVCxDQUFDO0lBRUYsTUFBTSxHQUFHLEdBQUcsSUFBSSxlQUFLLEVBQUUsQ0FBQztJQUN4QixXQUFXLENBQUMsR0FBRyxFQUFFLFlBQVksRUFBRSxZQUFZLENBQUMsQ0FBQztJQUM3QyxHQUFHLENBQUMsSUFBSSxDQUFDLDBCQUEwQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRXhFLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSx5QkFBeUIsQ0FBQyxDQUFDO0lBQzFFLEVBQUUsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDMUMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsWUFBWSxJQUFJLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBRWhFLE1BQU0sT0FBTyxHQUFHLE1BQU0sR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLFNBQVMsRUFBRSxDQUFDLENBQUM7SUFDeEYsRUFBRSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFFbkMsT0FBTyxPQUFPLENBQUM7QUFDbkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgSlNaaXAgZnJvbSAnanN6aXAnO1xuaW1wb3J0IHsgYnVpbGRQcm9wZXJ0eUtleUluZGV4LCBzY2FuRGVjb3JhdG9ycyB9IGZyb20gJy4vYW5hbHlzaXMvc2NhbkRlY29yYXRvcnMnO1xuaW1wb3J0IHsgc2NhblNjZW5lcyB9IGZyb20gJy4vYW5hbHlzaXMvc2NhblNjZW5lcyc7XG5pbXBvcnQgeyBQbGF5YWJsZU1hbmlmZXN0IH0gZnJvbSAnLi9hbmFseXNpcy90eXBlcyc7XG5cbi8qKiBUaGUgZXh0ZW5zaW9uIGxpdmVzIGF0IGA8cHJvamVjdD4vZXh0ZW5zaW9ucy9jb2Nvcy1wbGF5Z3JvdW5kYC4gKi9cbmZ1bmN0aW9uIGZpbmRQcm9qZWN0Um9vdCgpOiBzdHJpbmcge1xuICAgIHJldHVybiBwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4nLCAnLi4nLCAnLi4nKTtcbn1cblxuZnVuY3Rpb24gYWRkRGlyVG9aaXAoemlwOiBKU1ppcCwgZGlyOiBzdHJpbmcsIHppcFBhdGg6IHN0cmluZykge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgZnMucmVhZGRpclN5bmMoZGlyLCB7IHdpdGhGaWxlVHlwZXM6IHRydWUgfSkpIHtcbiAgICAgICAgY29uc3QgZnVsbFBhdGggPSBwYXRoLmpvaW4oZGlyLCBlbnRyeS5uYW1lKTtcbiAgICAgICAgY29uc3QgZW50cnlaaXBQYXRoID0gemlwUGF0aCA/IGAke3ppcFBhdGh9LyR7ZW50cnkubmFtZX1gIDogZW50cnkubmFtZTtcbiAgICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5KCkpIHtcbiAgICAgICAgICAgIGFkZERpclRvWmlwKHppcCwgZnVsbFBhdGgsIGVudHJ5WmlwUGF0aCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB6aXAuZmlsZShlbnRyeVppcFBhdGgsIGZzLnJlYWRGaWxlU3luYyhmdWxsUGF0aCkpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIFJlYWRzIHdoaWNoIHNjZW5lKHMpIGFjdHVhbGx5IHNoaXBwZWQgaW4gdGhpcyBzcGVjaWZpYyBidWlsZCwgc3RyYWlnaHQgZnJvbSBpdHMgb3duIGdlbmVyYXRlZFxuICogYHNyYy9zZXR0aW5ncy5qc29uYCAoYGxhdW5jaC5sYXVuY2hTY2VuZWAsIGUuZy4gYFwiZGI6Ly9hc3NldHMvVGVtcC5zY2VuZVwiYCkg4oCUIHRoZSBzb3VyY2Ugb2ZcbiAqIHRydXRoIGZvciBcIndoYXQncyByZWFsbHkgaW4gdGhlIHRoaW5nIGFib3V0IHRvIGJlIHppcHBlZCB1cFwiLCByYXRoZXIgdGhhbiBldmVyeSBgLnNjZW5lYCBmaWxlXG4gKiB0aGF0IGhhcHBlbnMgdG8gZXhpc3QgdW5kZXIgYGFzc2V0cy9gICh3aGljaCB3b3VsZCBpbmNsdWRlIG9sZC91bnJlbGF0ZWQgdGVzdCBzY2VuZXMgbmV2ZXJcbiAqIGNoZWNrZWQgaW4gdGhpcyBidWlsZCdzIFwiSW5jbHVkZWQgU2NlbmVzXCIgbGlzdCkuIE9ubHkgY292ZXJzIHRoZSBsYXVuY2ggc2NlbmUsIG5vdCBldmVyeSBzY2VuZVxuICogYSBnYW1lIG1pZ2h0IHRyYW5zaXRpb24gdG8gbGF0ZXIg4oCUIGZpbmUgZm9yIHRoZSBjb21tb24gc2luZ2xlLXNjZW5lIHBsYXlhYmxlLWFkIGNhc2UsIGJ1dCBhXG4gKiBtdWx0aS1zY2VuZSBwbGF5YWJsZSB3b3VsZCBuZWVkIHRoaXMgZXh0ZW5kZWQgdG8gYWxzbyByZWFkIHdoYXRldmVyIGludGVyLXNjZW5lLWxvYWRpbmcgbGlzdFxuICogQ29jb3MgcmVjb3JkcywgaWYgYW55LlxuICovXG5mdW5jdGlvbiBnZXRJbmNsdWRlZFNjZW5lUGF0aHMod2ViTW9iaWxlRGlyOiBzdHJpbmcpOiBTZXQ8c3RyaW5nPiB8IG51bGwge1xuICAgIGNvbnN0IHNldHRpbmdzUGF0aCA9IHBhdGguam9pbih3ZWJNb2JpbGVEaXIsICdzcmMnLCAnc2V0dGluZ3MuanNvbicpO1xuICAgIGlmICghZnMuZXhpc3RzU3luYyhzZXR0aW5nc1BhdGgpKSByZXR1cm4gbnVsbDtcblxuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHNldHRpbmdzID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoc2V0dGluZ3NQYXRoLCAndXRmOCcpKTtcbiAgICAgICAgY29uc3QgbGF1bmNoU2NlbmU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHNldHRpbmdzPy5sYXVuY2g/LmxhdW5jaFNjZW5lO1xuICAgICAgICBpZiAoIWxhdW5jaFNjZW5lKSByZXR1cm4gbnVsbDtcblxuICAgICAgICBjb25zdCByZWxhdGl2ZSA9IGxhdW5jaFNjZW5lLnJlcGxhY2UoL15kYjpcXC9cXC9hc3NldHNcXC8vLCAnJyk7XG4gICAgICAgIHJldHVybiBuZXcgU2V0KFtyZWxhdGl2ZV0pO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgW2NvY29zLXBsYXlncm91bmRdIGZhaWxlZCB0byByZWFkICR7c2V0dGluZ3NQYXRofSwgc2Nhbm5pbmcgYWxsIHNjZW5lcyBpbnN0ZWFkOiAke2Vycm9yfWApO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59XG5cbi8qKlxuICogU2NhbnMgdGhlIHByb2plY3QgZm9yIEBwbGF5R3JvdW5kRmllbGQgdmFsdWVzLCB0aGVuIHppcHMgdGhlIGV4aXN0aW5nIGBidWlsZC93ZWItbW9iaWxlYFxuICogb3V0cHV0IHRvZ2V0aGVyIHdpdGggYSBgcGxheWdyb3VuZC1tYW5pZmVzdC5qc29uYCBpbnRvIGBidWlsZC9jb2Nvcy1wbGF5Z3JvdW5kLWV4cG9ydC9gLlxuICogRG9lcyBub3QgdHJpZ2dlciBhIGJ1aWxkIGl0c2VsZiBhbmQgZG9lcyBub3QgdGFsayB0byBhbnkgYmFja2VuZCDigJQgdGhlIHVzZXIgYnVpbGRzIGZvciB0aGVcbiAqIFwiV2ViIE1vYmlsZVwiIHBsYXRmb3JtIHZpYSBDb2NvcyBDcmVhdG9yJ3Mgb3duIEJ1aWxkIHBhbmVsIGZpcnN0LCB0aGVuIHVwbG9hZHMgdGhlIHJlc3VsdGluZ1xuICogemlwIGJ5IGhhbmQgdGhyb3VnaCB0aGUgd2ViIGZyb250ZW5kLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXhwb3J0UGxheWFibGVQYWNrYWdlKHByb2plY3RSb290OiBzdHJpbmcgPSBmaW5kUHJvamVjdFJvb3QoKSk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgYXNzZXRzRGlyID0gcGF0aC5qb2luKHByb2plY3RSb290LCAnYXNzZXRzJyk7XG4gICAgY29uc3Qgd2ViTW9iaWxlRGlyID0gcGF0aC5qb2luKHByb2plY3RSb290LCAnYnVpbGQnLCAnd2ViLW1vYmlsZScpO1xuICAgIGNvbnN0IGluZGV4SHRtbFBhdGggPSBwYXRoLmpvaW4od2ViTW9iaWxlRGlyLCAnaW5kZXguaHRtbCcpO1xuXG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKGluZGV4SHRtbFBhdGgpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgIGBObyB3ZWItbW9iaWxlIGJ1aWxkIGZvdW5kIGF0IFwiJHt3ZWJNb2JpbGVEaXJ9XCIuIEJ1aWxkIGZvciB0aGUgXCJXZWIgTW9iaWxlXCIgcGxhdGZvcm0gaW4gQ29jb3MgQ3JlYXRvcidzIEJ1aWxkIHBhbmVsIGZpcnN0LCB0aGVuIHJ1biB0aGlzIGNvbW1hbmQgYWdhaW4uYFxuICAgICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IGRlY29yYXRlZENsYXNzZXMgPSBzY2FuRGVjb3JhdG9ycyhhc3NldHNEaXIpO1xuICAgIGNvbnN0IHByb3BlcnR5S2V5SW5kZXggPSBidWlsZFByb3BlcnR5S2V5SW5kZXgoZGVjb3JhdGVkQ2xhc3Nlcyk7XG4gICAgY29uc3QgaW5jbHVkZWRTY2VuZXMgPSBnZXRJbmNsdWRlZFNjZW5lUGF0aHMod2ViTW9iaWxlRGlyKTtcbiAgICBjb25zdCBmaWVsZHMgPSBzY2FuU2NlbmVzKGFzc2V0c0RpciwgcHJvcGVydHlLZXlJbmRleCwgaW5jbHVkZWRTY2VuZXMpO1xuXG4gICAgY29uc3QgbWFuaWZlc3Q6IFBsYXlhYmxlTWFuaWZlc3QgPSB7XG4gICAgICAgIGdlbmVyYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIGZpZWxkcyxcbiAgICB9O1xuXG4gICAgY29uc3QgemlwID0gbmV3IEpTWmlwKCk7XG4gICAgYWRkRGlyVG9aaXAoemlwLCB3ZWJNb2JpbGVEaXIsICd3ZWItbW9iaWxlJyk7XG4gICAgemlwLmZpbGUoJ3BsYXlncm91bmQtbWFuaWZlc3QuanNvbicsIEpTT04uc3RyaW5naWZ5KG1hbmlmZXN0LCBudWxsLCAyKSk7XG5cbiAgICBjb25zdCBvdXREaXIgPSBwYXRoLmpvaW4ocHJvamVjdFJvb3QsICdidWlsZCcsICdjb2Nvcy1wbGF5Z3JvdW5kLWV4cG9ydCcpO1xuICAgIGZzLm1rZGlyU3luYyhvdXREaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgIGNvbnN0IG91dEZpbGUgPSBwYXRoLmpvaW4ob3V0RGlyLCBgcGxheWFibGUtJHtEYXRlLm5vdygpfS56aXBgKTtcblxuICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB6aXAuZ2VuZXJhdGVBc3luYyh7IHR5cGU6ICdub2RlYnVmZmVyJywgY29tcHJlc3Npb246ICdERUZMQVRFJyB9KTtcbiAgICBmcy53cml0ZUZpbGVTeW5jKG91dEZpbGUsIGNvbnRlbnQpO1xuXG4gICAgcmV0dXJuIG91dEZpbGU7XG59XG4iXX0=