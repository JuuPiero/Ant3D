import { _decorator, JsonAsset, Vec3 } from 'cc';

const { ccclass, property } = _decorator;

export interface Serializable<T> {
    toJSON(): T;
    fromJSON(json: T): this;
}

type Vec3Json = { x: number; y: number; z: number };

function toVec3(value: Partial<Vec3Json> | Vec3 | undefined): Vec3 {
    return new Vec3(value?.x ?? 0, value?.y ?? 0, value?.z ?? 0);
}

function vec3ToJSON(value: Vec3): Vec3Json {
    return { x: value.x, y: value.y, z: value.z };
}

@ccclass('TileData')
export class TileData implements Serializable<TileDataJson> {
    @property(Vec3)
    GridPosition: Vec3 = new Vec3();

    @property
    Color = 0;

    @property
    Health = 1;

    @property
    IsKey = false;

    toJSON(): TileDataJson {
        return {
            GridPosition: vec3ToJSON(this.GridPosition),
            Color: this.Color,
            Health: this.Health,
            IsKey: this.IsKey ? 1 : 0,
        };
    }

    fromJSON(json: TileDataJson): this {
        this.GridPosition = toVec3(json.GridPosition);
        this.Color = json.Color ?? 0;
        this.Health = json.Health ?? 1;
        this.IsKey = Boolean(json.IsKey);
        return this;
    }

    static fromJSON(json: TileDataJson): TileData {
        return new TileData().fromJSON(json);
    }
}

export interface TileDataJson {
    GridPosition: Vec3Json;
    Color: number;
    Health: number;
    IsKey: number | boolean;
}

@ccclass('ShooterData')
export class ShooterData implements Serializable<ShooterDataJson> {
    @property
    Color = 0;

    @property
    Ammo = 0;

    @property
    Line = 0;

    @property
    Index = 0;

    @property
    ConnectionGroup = 0;

    @property
    IsMystery = false;

    @property
    FrozenAmmo = 0;

    @property([Number])
    Tunnel: number[] = [];

    @property
    TunnelSlotCount = 0;

    @property
    SecondColor = -1;

    @property
    SecondAmmo = 0;

    @property
    IsCaged = false;

    @property
    RequiredKeys = 0;

    toJSON(): ShooterDataJson {
        return {
            Color: this.Color,
            Ammo: this.Ammo,
            Line: this.Line,
            Index: this.Index,
            ConnectionGroup: this.ConnectionGroup,
            IsMystery: this.IsMystery ? 1 : 0,
            FrozenAmmo: this.FrozenAmmo,
            Tunnel: [...this.Tunnel],
            TunnelSlotCount: this.TunnelSlotCount,
            SecondColor: this.SecondColor,
            SecondAmmo: this.SecondAmmo,
            IsCaged: this.IsCaged ? 1 : 0,
            RequiredKeys: this.RequiredKeys,
        };
    }

    fromJSON(json: ShooterDataJson): this {
        this.Color = json.Color ?? 0;
        this.Ammo = json.Ammo ?? 0;
        this.Line = json.Line ?? 0;
        this.Index = json.Index ?? 0;
        this.ConnectionGroup = json.ConnectionGroup ?? 0;
        this.IsMystery = Boolean(json.IsMystery);
        this.FrozenAmmo = json.FrozenAmmo ?? 0;
        this.Tunnel = Array.isArray(json.Tunnel) ? [...json.Tunnel] : [];
        this.TunnelSlotCount = json.TunnelSlotCount ?? 0;
        this.SecondColor = json.SecondColor ?? -1;
        this.SecondAmmo = json.SecondAmmo ?? 0;
        this.IsCaged = Boolean(json.IsCaged);
        this.RequiredKeys = json.RequiredKeys ?? 0;
        return this;
    }

    static fromJSON(json: ShooterDataJson): ShooterData {
        return new ShooterData().fromJSON(json);
    }
}

export interface ShooterDataJson {
    Color: number;
    Ammo: number;
    Line: number;
    Index: number;
    ConnectionGroup: number;
    IsMystery: number | boolean;
    FrozenAmmo: number;
    Tunnel: number[];
    TunnelSlotCount: number;
    SecondColor: number;
    SecondAmmo: number;
    IsCaged: number | boolean;
    RequiredKeys: number;
}

@ccclass('IceGroupData')
export class IceGroupData implements Serializable<IceGroupDataJson> {
    @property([Number])
    Cubes: number[] = [];

    toJSON(): IceGroupDataJson {
        return { Cubes: [...this.Cubes] };
    }

    fromJSON(json: IceGroupDataJson): this {
        this.Cubes = Array.isArray(json.Cubes) ? [...json.Cubes] : [];
        return this;
    }

    static fromJSON(json: IceGroupDataJson): IceGroupData {
        return new IceGroupData().fromJSON(json);
    }
}

export interface IceGroupDataJson {
    Cubes: number[];
}

export interface LevelDataJson {
    Name: string;
    GridSize: Vec3Json;
    CellSize: number;
    GridOrigin: Vec3Json;
    DefaultRotation: Vec3Json;
    KeyScale: number;
    Cubes: TileDataJson[];
    IceGroups: IceGroupDataJson[];
    LineCount: number;
    ShooterSpawnData: ShooterDataJson[];
    Difficulty: number;
    ExcludeFromRandomRounds: number | boolean;
    IntroStyle: number;
    IntroStartFrom: number;
}

@ccclass('LevelData')
export class LevelData implements Serializable<LevelDataJson> {
    @property
    Name = '';

    @property(Vec3)
    GridSize: Vec3 = new Vec3();

    @property
    CellSize = 1;

    @property(Vec3)
    GridOrigin: Vec3 = new Vec3();

    @property(Vec3)
    DefaultRotation: Vec3 = new Vec3();

    @property
    KeyScale = 1;

    @property([TileData])
    Cubes: TileData[] = [];

    @property([IceGroupData])
    IceGroups: IceGroupData[] = [];

    @property
    LineCount = 0;

    @property([ShooterData])
    ShooterSpawnData: ShooterData[] = [];

    @property
    Difficulty = 0;

    @property
    ExcludeFromRandomRounds = false;

    @property
    IntroStyle = 0;

    @property
    IntroStartFrom = 0;

    toJSON(): LevelDataJson {
        return {
            Name: this.Name,
            GridSize: vec3ToJSON(this.GridSize),
            CellSize: this.CellSize,
            GridOrigin: vec3ToJSON(this.GridOrigin),
            DefaultRotation: vec3ToJSON(this.DefaultRotation),
            KeyScale: this.KeyScale,
            Cubes: this.Cubes.map((cube) => cube.toJSON()),
            IceGroups: this.IceGroups.map((group) => group.toJSON()),
            LineCount: this.LineCount,
            ShooterSpawnData: this.ShooterSpawnData.map((shooter) => shooter.toJSON()),
            Difficulty: this.Difficulty,
            ExcludeFromRandomRounds: this.ExcludeFromRandomRounds ? 1 : 0,
            IntroStyle: this.IntroStyle,
            IntroStartFrom: this.IntroStartFrom,
        };
    }

    fromJSON(json: LevelDataJson): this {
        this.Name = json.Name ?? '';
        this.GridSize = toVec3(json.GridSize);
        this.CellSize = json.CellSize ?? 1;
        this.GridOrigin = toVec3(json.GridOrigin);
        this.DefaultRotation = toVec3(json.DefaultRotation);
        this.KeyScale = json.KeyScale ?? 1;
        this.Cubes = (json.Cubes ?? []).map((cube) => TileData.fromJSON(cube));
        this.IceGroups = (json.IceGroups ?? []).map((group) => IceGroupData.fromJSON(group));
        this.LineCount = json.LineCount ?? 0;
        this.ShooterSpawnData = (json.ShooterSpawnData ?? []).map((shooter) => ShooterData.fromJSON(shooter));
        this.Difficulty = json.Difficulty ?? 0;
        this.ExcludeFromRandomRounds = Boolean(json.ExcludeFromRandomRounds);
        this.IntroStyle = json.IntroStyle ?? 0;
        this.IntroStartFrom = json.IntroStartFrom ?? 0;
        return this;
    }

    static fromJSON(json: LevelDataJson): LevelData {
        return new LevelData().fromJSON(json);
    }

    static ParseJson(jsonAsset: JsonAsset): LevelData {
        if (!jsonAsset?.json || typeof jsonAsset.json !== 'object') {
            throw new Error('LevelData.ParseJson requires a JsonAsset containing a level object.');
        }

        return LevelData.fromJSON(jsonAsset.json as LevelDataJson);
    }
}
