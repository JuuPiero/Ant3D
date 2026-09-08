"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
const export_1 = require("./export");
/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
exports.methods = {
    /**
     * @en A method that can be triggered by message
     * @zh 通过 message 触发的方法
     */
    showLog() {
        console.log('Hello World');
    },
    /**
     * @en Scans @playGroundField values and zips them with the existing web-mobile build.
     * @zh 扫描 @playGroundField 字段，并与已有的 web-mobile 构建打包成压缩包
     */
    async exportPlayable() {
        try {
            const outFile = await (0, export_1.exportPlayablePackage)();
            console.log(`[cocos-playground] Exported playable package to ${outFile}`);
            await Editor.Dialog.info(`Playable package exported to:\n${outFile}`, {
                title: 'Cocos Playground',
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[cocos-playground] Failed to export playable package: ${message}`);
            await Editor.Dialog.error(message, { title: 'Cocos Playground — Export failed' });
        }
    },
};
/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 */
function load() { }
/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 */
function unload() { }
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQXNDQSxvQkFBMEI7QUFNMUIsd0JBQTRCO0FBNUM1QixxQ0FBaUQ7QUFFakQ7OztHQUdHO0FBQ1UsUUFBQSxPQUFPLEdBQTRDO0lBQzVEOzs7T0FHRztJQUNILE9BQU87UUFDSCxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsY0FBYztRQUNoQixJQUFJLENBQUM7WUFDRCxNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUEsOEJBQXFCLEdBQUUsQ0FBQztZQUM5QyxPQUFPLENBQUMsR0FBRyxDQUFDLG1EQUFtRCxPQUFPLEVBQUUsQ0FBQyxDQUFDO1lBQzFFLE1BQU0sTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsa0NBQWtDLE9BQU8sRUFBRSxFQUFFO2dCQUNsRSxLQUFLLEVBQUUsa0JBQWtCO2FBQzVCLENBQUMsQ0FBQztRQUNQLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2IsTUFBTSxPQUFPLEdBQUcsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sQ0FBQyxLQUFLLENBQUMseURBQXlELE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDbEYsTUFBTSxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsRUFBRSxLQUFLLEVBQUUsa0NBQWtDLEVBQUUsQ0FBQyxDQUFDO1FBQ3RGLENBQUM7SUFDTCxDQUFDO0NBQ0osQ0FBQztBQUVGOzs7R0FHRztBQUNILFNBQWdCLElBQUksS0FBSyxDQUFDO0FBRTFCOzs7R0FHRztBQUNILFNBQWdCLE1BQU0sS0FBSyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZXhwb3J0UGxheWFibGVQYWNrYWdlIH0gZnJvbSAnLi9leHBvcnQnO1xuXG4vKipcbiAqIEBlbiBSZWdpc3RyYXRpb24gbWV0aG9kIGZvciB0aGUgbWFpbiBwcm9jZXNzIG9mIEV4dGVuc2lvblxuICogQHpoIOS4uuaJqeWxleeahOS4u+i/m+eoi+eahOazqOWGjOaWueazlVxuICovXG5leHBvcnQgY29uc3QgbWV0aG9kczogeyBba2V5OiBzdHJpbmddOiAoLi4uYW55OiBhbnkpID0+IGFueSB9ID0ge1xuICAgIC8qKlxuICAgICAqIEBlbiBBIG1ldGhvZCB0aGF0IGNhbiBiZSB0cmlnZ2VyZWQgYnkgbWVzc2FnZVxuICAgICAqIEB6aCDpgJrov4cgbWVzc2FnZSDop6blj5HnmoTmlrnms5VcbiAgICAgKi9cbiAgICBzaG93TG9nKCkge1xuICAgICAgICBjb25zb2xlLmxvZygnSGVsbG8gV29ybGQnKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQGVuIFNjYW5zIEBwbGF5R3JvdW5kRmllbGQgdmFsdWVzIGFuZCB6aXBzIHRoZW0gd2l0aCB0aGUgZXhpc3Rpbmcgd2ViLW1vYmlsZSBidWlsZC5cbiAgICAgKiBAemgg5omr5o+PIEBwbGF5R3JvdW5kRmllbGQg5a2X5q6177yM5bm25LiO5bey5pyJ55qEIHdlYi1tb2JpbGUg5p6E5bu65omT5YyF5oiQ5Y6L57yp5YyFXG4gICAgICovXG4gICAgYXN5bmMgZXhwb3J0UGxheWFibGUoKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBvdXRGaWxlID0gYXdhaXQgZXhwb3J0UGxheWFibGVQYWNrYWdlKCk7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW2NvY29zLXBsYXlncm91bmRdIEV4cG9ydGVkIHBsYXlhYmxlIHBhY2thZ2UgdG8gJHtvdXRGaWxlfWApO1xuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLkRpYWxvZy5pbmZvKGBQbGF5YWJsZSBwYWNrYWdlIGV4cG9ydGVkIHRvOlxcbiR7b3V0RmlsZX1gLCB7XG4gICAgICAgICAgICAgICAgdGl0bGU6ICdDb2NvcyBQbGF5Z3JvdW5kJyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKTtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtjb2Nvcy1wbGF5Z3JvdW5kXSBGYWlsZWQgdG8gZXhwb3J0IHBsYXlhYmxlIHBhY2thZ2U6ICR7bWVzc2FnZX1gKTtcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5EaWFsb2cuZXJyb3IobWVzc2FnZSwgeyB0aXRsZTogJ0NvY29zIFBsYXlncm91bmQg4oCUIEV4cG9ydCBmYWlsZWQnIH0pO1xuICAgICAgICB9XG4gICAgfSxcbn07XG5cbi8qKlxuICogQGVuIE1ldGhvZCBUcmlnZ2VyZWQgb24gRXh0ZW5zaW9uIFN0YXJ0dXBcbiAqIEB6aCDmianlsZXlkK/liqjml7bop6blj5HnmoTmlrnms5VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxvYWQoKSB7IH1cblxuLyoqXG4gKiBAZW4gTWV0aG9kIHRyaWdnZXJlZCB3aGVuIHVuaW5zdGFsbGluZyB0aGUgZXh0ZW5zaW9uXG4gKiBAemgg5Y246L295omp5bGV5pe26Kem5Y+R55qE5pa55rOVXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1bmxvYWQoKSB7IH1cbiJdfQ==