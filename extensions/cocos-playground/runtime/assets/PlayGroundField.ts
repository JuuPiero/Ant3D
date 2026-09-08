import { _decorator, CCBoolean, CCFloat, CCInteger, CCString, Color, Vec2, Vec3, Vec4 } from 'cc';

const { property } = _decorator;

export type PlayGroundFieldKind =
    | 'string'
    | 'number'
    | 'boolean'
    | 'color'
    | 'vec2'
    | 'vec3'
    | 'vec4'
    | 'enum';

export interface PlayGroundEnumOption {
    label: string;
    value: number;
}

export interface PlayGroundFieldOptions {
    /** Same "type" you'd pass to @property: String/CCString, Number/CCFloat/CCInteger,
     *  Boolean/CCBoolean, Color, Vec2, Vec3, Vec4, or a numeric TS enum object. */
    type: any;
    /** Shown as the field's tooltip in the Inspector and as its label on the web frontend. */
    label?: string;
    /** Groups related fields together in the Inspector. */
    group?: string;
    /** Extra @property options passed through as-is (range, min, max, ...). */
    property?: Record<string, any>;
}

export interface PlayGroundFieldMeta {
    propertyKey: string;
    kind: PlayGroundFieldKind;
    label: string;
    group?: string;
    enumOptions?: PlayGroundEnumOption[];
    /** True when declared as `type: [X]` (Cocos's own array-property syntax) — a list of `kind`. */
    isList?: boolean;
}

declare global {
    // eslint-disable-next-line no-var
    var __PLAYGROUND_REGISTRY__: Map<Function, PlayGroundFieldMeta[]> | undefined;
}

function getRegistry(): Map<Function, PlayGroundFieldMeta[]> {
    const root = globalThis as any;
    if (!root.__PLAYGROUND_REGISTRY__) {
        root.__PLAYGROUND_REGISTRY__ = new Map<Function, PlayGroundFieldMeta[]>();
    }
    return root.__PLAYGROUND_REGISTRY__;
}

function resolveKind(type: any): { kind: PlayGroundFieldKind; enumOptions?: PlayGroundEnumOption[]; isList?: boolean } {
    // Cocos's own array-property syntax: `type: [X]` — a single-element array naming the item type.
    if (Array.isArray(type)) {
        return { ...resolveKind(type[0]), isList: true };
    }

    if (type === String || type === CCString) return { kind: 'string' };
    if (type === Number || type === CCFloat || type === CCInteger) return { kind: 'number' };
    if (type === Boolean || type === CCBoolean) return { kind: 'boolean' };
    if (type === Color) return { kind: 'color' };
    if (type === Vec2) return { kind: 'vec2' };
    if (type === Vec3) return { kind: 'vec3' };
    if (type === Vec4) return { kind: 'vec4' };

    if (type && typeof type === 'object') {
        // A numeric TS enum compiles to a bidirectional map ({A: 0, 0: 'A', ...}); the forward
        // (name -> number) half is exactly the keys whose value is a number. String enums aren't
        // supported yet since Cocos's own Inspector/Enum() wrapping expects numeric enums too.
        const enumOptions: PlayGroundEnumOption[] = Object.keys(type)
            .filter((key) => typeof type[key] === 'number')
            .map((key) => ({ label: key, value: type[key] as number }));

        if (enumOptions.length > 0) {
            return { kind: 'enum', enumOptions };
        }
    }

    throw new Error(`[playGroundField] Unsupported field type: ${String(type)}`);
}

/**
 * Marks a Cocos component property as a "playground field": a piece of creative content
 * (text/number/color/vector/enum) that the Cocos Playground extension extracts into a
 * playable's field manifest for editing outside of Cocos Creator. Wraps the normal `@property`
 * decorator, so the field still serializes and shows in the Inspector as usual.
 */
export function playGroundField(options: PlayGroundFieldOptions) {
    return function (target: any, propertyKey: string) {
        const { kind, enumOptions, isList } = resolveKind(options.type);

        property({
            type: options.type,
            tooltip: options.label,
            ...(options.group ? { group: { name: options.group } } : {}),
            ...options.property,
        })(target, propertyKey);

        const ctor = target.constructor;
        const registry = getRegistry();
        const fields = registry.get(ctor) ?? [];
        fields.push({
            propertyKey,
            kind,
            label: options.label ?? propertyKey,
            group: options.group,
            enumOptions,
            isList,
        });
        registry.set(ctor, fields);

        ensureOverridesAppliedOnLoad(ctor);
    };
}

export function getPlayGroundFields(ctor: Function): PlayGroundFieldMeta[] {
    return getRegistry().get(ctor) ?? [];
}

export function getAllPlayGroundClasses(): Function[] {
    return Array.from(getRegistry().keys());
}

/**
 * Rebuilds a raw JSON value coming from the overrides payload into the actual runtime type Cocos
 * expects for that field's kind — assigning a plain `{r,g,b,a}` object straight to a `Color`
 * property, for instance, would not behave like a real `Color` instance.
 */
function reconstructOverrideScalar(kind: PlayGroundFieldKind, raw: any): any {
    switch (kind) {
        case 'color':
            return raw ? new Color(raw.r ?? 0, raw.g ?? 0, raw.b ?? 0, raw.a ?? 255) : undefined;
        case 'vec2':
            return raw ? new Vec2(raw.x ?? 0, raw.y ?? 0) : undefined;
        case 'vec3':
            return raw ? new Vec3(raw.x ?? 0, raw.y ?? 0, raw.z ?? 0) : undefined;
        case 'vec4':
            return raw ? new Vec4(raw.x ?? 0, raw.y ?? 0, raw.z ?? 0, raw.w ?? 0) : undefined;
        default:
            return raw;
    }
}

function reconstructOverrideValue(field: PlayGroundFieldMeta, raw: any): any {
    if (field.isList) {
        if (!Array.isArray(raw)) return undefined;
        return raw.map((item) => reconstructOverrideScalar(field.kind, item));
    }
    return reconstructOverrideScalar(field.kind, raw);
}

/**
 * Overrides travel as a base64-encoded JSON blob under a short, non-descriptive name — this is
 * *not* real security (the whole build is public once shipped to an ad network; anyone can still
 * decode it with devtools), just enough that raw field names/values aren't sitting in plain text
 * for a casual view-source. Two sources: `window.__pgvo__`, set by a `<script>` tag the Cocos
 * Playground export service injects via playable-adapter-core's `injectOptions[channel].body`
 * extension point (see CocosPlaygroundExportService/src/export.ts) for real exported builds; or a
 * `pgvo` query-string param, set by the frontend's live preview iframe (an unmodified, un-exported
 * web-mobile build served directly) — see CocosPlaygroundView's PlayableEditorView.vue.
 */
function decodeOverridesPayload(encoded: string): Record<string, unknown> | undefined {
    try {
        // atob() only handles Latin1; decodeURIComponent(escape(...)) round-trips arbitrary UTF-8
        // (e.g. non-ASCII labels/text values) through it correctly.
        const json = decodeURIComponent(escape(atob(encoded)));
        return JSON.parse(json);
    } catch (error) {
        console.warn('[cocos-playground] failed to decode playground overrides payload:', error);
        return undefined;
    }
}

function readPlaygroundOverrides(): Record<string, unknown> | undefined {
    const encoded: string | undefined =
        (globalThis as any).__pgvo__ ?? new URLSearchParams(window.location.search).get('pgvo') ?? undefined;
    return encoded ? decodeOverridesPayload(encoded) : undefined;
}

const UNSET = Symbol('unset');
let cachedOverrides: Record<string, unknown> | undefined | typeof UNSET = UNSET;

function getOverridesOnce(): Record<string, unknown> | undefined {
    if (cachedOverrides === UNSET) {
        cachedOverrides = readPlaygroundOverrides();
    }
    return cachedOverrides as Record<string, unknown> | undefined;
}

/** Applies any override values for `instance`'s registered fields. */
function applyOverridesTo(instance: any, ctor: Function): void {
    const overrides = getOverridesOnce();
    if (!overrides) return;

    for (const field of getPlayGroundFields(ctor)) {
        if (!(field.propertyKey in overrides)) continue;
        const value = reconstructOverrideValue(field, overrides[field.propertyKey]);
        if (value !== undefined) {
            instance[field.propertyKey] = value;
        }
    }
}

/**
 * Wraps this class's `onLoad` (adding one if it doesn't define one) so overrides land on every
 * instance right before its own `onLoad` runs. This has to happen this early — not, say, on
 * `Director.EVENT_AFTER_SCENE_LAUNCH` — because that event fires *after* every component's
 * `onLoad` in the scene has already run; a component that copies `this.someField` onto a
 * Label/Sprite once in its own `onLoad` (the common case for configurable text/color) would
 * already have used the stale value by then. Idempotent per class.
 */
function ensureOverridesAppliedOnLoad(ctor: Function): void {
    const proto = (ctor as any).prototype;
    if (proto.__playgroundOnLoadPatched) return;
    proto.__playgroundOnLoadPatched = true;

    const originalOnLoad: (() => void) | undefined = proto.onLoad;
    proto.onLoad = function (this: any) {
        applyOverridesTo(this, ctor);
        originalOnLoad?.call(this);
    };
}
