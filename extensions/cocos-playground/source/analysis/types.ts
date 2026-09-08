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

export interface DecoratedField {
    className: string;
    propertyKey: string;
    kind: PlayGroundFieldKind;
    label: string;
    group?: string;
    enumOptions?: PlayGroundEnumOption[];
    /** True when declared as `type: [X]` (Cocos's own array-property syntax) — a list of `kind`. */
    isList?: boolean;
}

export interface DecoratedClass {
    className: string;
    fields: DecoratedField[];
}

export interface ManifestField {
    scene: string;
    nodePath: string;
    /**
     * The @ccclass name found in source for the *first* matching candidate (see scanScenes.ts
     * for why component identity is inferred from property-key presence rather than reading
     * `__type__` directly).
     */
    componentType: string;
    propertyKey: string;
    label: string;
    kind: PlayGroundFieldKind;
    group?: string;
    enumOptions?: PlayGroundEnumOption[];
    isList?: boolean;
    value: any;
}

export interface PlayableManifest {
    generatedAt: string;
    fields: ManifestField[];
}
