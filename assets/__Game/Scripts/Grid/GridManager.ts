import { _decorator, Component, instantiate, Node, Tween, Vec3 } from 'cc';
import { LevelData } from '../Data/LevelData';
import { Tile } from './Tile';
import { ServiceLocator } from 'db://assets/_iKame/Scripts/ServiceLocator';
import { EventBus } from 'db://assets/_iKame/Scripts/EventBus';
import { moveTo } from 'db://assets/_iKame/Scripts/Tween/TweenUntils';
import { GameConfig } from '../Data/GameConfig';
import { GameEvents } from '../GameEvents';
const { ccclass, property } = _decorator;

const columnKey = (x: number, z: number) => `${x}_${z}`;

@ccclass('GridManager')
export class GridManager extends Component {

    @property(Tile) tiles: Tile[] = [];

    private columns = new Map<string, Tile[]>();
    private zCounts = new Map<number, number>();
    private faceZ = -1;

    public initialize(levelData: LevelData) {
        const tilePrefab = ServiceLocator.get(GameConfig).tilePrefab;
        const tileDatas = levelData.Cubes;

        for (const tileData of tileDatas) {
            const tileNode = instantiate(tilePrefab);
            tileNode.setParent(this.node)
            const tile = tileNode.getComponent(Tile);
            tile.initialize(tileData)
            this.tiles.push(tile);

            const { x, z } = tileData.GridPosition;
            const key = columnKey(x, z);
            if (!this.columns.has(key)) this.columns.set(key, []);
            this.columns.get(key).push(tile);

            this.zCounts.set(z, (this.zCounts.get(z) ?? 0) + 1);
        }
        this.faceZ = this.zCounts.size ? Math.min(...this.zCounts.keys()) : -1;

        // this.node.setScale(new Vec3(levelData.CellSize, levelData.CellSize, levelData.CellSize));
        // this.node.eulerAngles = levelData.DefaultRotation;
        // this.node.setWorldPosition(levelData.GridOrigin);

    }

    /** First live tile of `color` currently sitting on the outermost (min-Z) face, if any. */
    findCollectible(color: number): Tile | null {
        for (const tile of this.tiles) {
            if (tile.data.GridPosition.z !== this.faceZ) continue;
            if (tile.data.Color !== color) continue;
            if (tile.data.Health - tile.pendingHits <= 0) continue;
            return tile;
        }
        return null;
    }

    reserve(tile: Tile) {
        tile.pendingHits++;
    }

    /** Only needed if an ant gets cancelled mid-flight before it lands its hit. */
    unreserve(tile: Tile) {
        tile.pendingHits--;
    }

    /** Called when an ant reaches its target tile and lands its hit. Returns true once depleted. */
    collectTile(tile: Tile): boolean {
        tile.pendingHits--;
        const depleted = tile.hit();
        if (!depleted) return false;

        const { x, z } = tile.data.GridPosition;
        const key = columnKey(x, z);
        const bucket = this.columns.get(key) ?? [];
        const index = bucket.indexOf(tile);
        if (index !== -1) bucket.splice(index, 1);

        const tilesIndex = this.tiles.indexOf(tile);
        if (tilesIndex !== -1) this.tiles.splice(tilesIndex, 1);

        const remainingOnFace = (this.zCounts.get(z) ?? 1) - 1;
        if (remainingOnFace <= 0) {
            this.zCounts.delete(z);
            this.faceZ = this.zCounts.size ? Math.min(...this.zCounts.keys()) : -1;
            EventBus.emit(GameEvents.GRID_FACE_ADVANCED);
        } else {
            this.zCounts.set(z, remainingOnFace);
        }

        this.compactColumn(bucket);

        if (this.tiles.length === 0) {
            EventBus.emit(GameEvents.LEVEL_WIN);
        }

        return true;
    }

    /** Settles the surviving tiles of one (x,z) column down toward the floor (y0), gravity-style. */
    private compactColumn(bucket: Tile[]) {
        bucket.sort((a, b) => a.data.GridPosition.y - b.data.GridPosition.y);

        bucket.forEach((tile, y) => {
            if (tile.data.GridPosition.y === y) return;

            tile.data.GridPosition.y = y;
            const target = new Vec3(tile.data.GridPosition.x, y, tile.data.GridPosition.z);
            // A tile can be asked to settle again before its previous settle finished (another
            // removal freed up more room below it); stop that one first so they don't both
            // fight over `position` on the same node.
            Tween.stopAllByTarget(tile.node);
            moveTo(tile.node, target, 0.18);
        });
    }

}
