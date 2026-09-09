import { Node, Prefab, Vec3, tween } from 'cc';
import { Ant } from './Ant';
import { AntPool } from './AntPool';
import { arcControlPoint, wallNormalFrom } from './AntPath';
import { GridManager } from '../Grid/GridManager';
import { Tile } from '../Grid/Tile';

const SPAWN_STAGGER = 0.08;
const MIN_SEGMENT_DURATION = 0.25;

// Ground approach (slot<->grid, grid<->hole): slow, visible pace with a light bouncy arc.
const WALK_SPEED = 3
const WALK_LIFT = 0.25;
const WALK_JITTER = 0.3;

// Climbing the grid face up/down to reach a tile that isn't at ground level.
const CLIMB_SPEED = 2;
const CLIMB_JITTER = 0.12;

/**
 * Orchestrates the whole ant lifecycle once a shooter releases its swarm: spawn -> walk to the
 * base of the target tile's column -> climb the face if it's not at ground level -> collect ->
 * turn around, climb back down -> walk to the hole -> despawn.
 * If a matching tile isn't available for one ant in the burst, the whole swarm release stops
 * right there (remaining Ammo just doesn't get spawned) instead of parking ants to wait.
 * Plain class, not a Component: everything here is driven by tweens, nothing needs scene-node
 * lifecycle.
 */
export class AntManager {

    private pool: AntPool;

    constructor(private gridManager: GridManager, private hole: Node, antPrefab: Prefab, container: Node) {
        this.pool = new AntPool(antPrefab, container);
    }

    spawnSwarm(color: number, count: number, fromWorldPos: Vec3) {
        let stopped = false;
        for (let i = 0; i < count; i++) {
            tween({})
                .delay(i * SPAWN_STAGGER)
                .call(() => {
                    if (stopped) return;
                    if (!this.spawnOne(color, fromWorldPos)) stopped = true;
                })
                .start();
        }
    }

    /** Returns false (and spawns nothing) if no tile of `color` is currently on the outer face. */
    private spawnOne(color: number, fromWorldPos: Vec3): boolean {
        const tile = this.gridManager.findCollectible(color);
        if (!tile) return false;

        this.gridManager.reserve(tile);

        const node = this.pool.get();
        node.setWorldPosition(fromWorldPos);
        const ant = node.getComponent(Ant);
        ant.setColor(color);

        this.travelToTile(ant, tile);
        return true;
    }

    /** Walk to the base of the tile's column at ground level, then climb straight up to it. */
    private travelToTile(ant: Ant, tile: Tile) {
        const start = ant.node.worldPosition.clone();
        const tileCenter = tile.node.worldPosition;

        // The wall the ant is about to climb: it's whatever it was walking toward, so its
        // outward normal is the reverse of the walk direction. Reused for the matching descent
        // so the body doesn't re-derive (and potentially flip) a new normal on the way down.
        const wallNormal = wallNormalFrom(start, new Vec3(tileCenter.x, start.y, tileCenter.z));

        // The tile's own position is its mesh center; climb/walk to its outward bottom edge
        // instead so the ant stops at the surface rather than sinking into the cube.
        const top = tile.getPickupPoint(wallNormal);
        const base = new Vec3(top.x, start.y, top.z);

        this.walk(ant, start, base, () => {
            this.climb(ant, base, top, wallNormal, () => {
                if (this.gridManager.collectTile(tile)) {
                    tile.pickUp(ant.tileCollectedPos);
                }
                this.travelToHole(ant, wallNormal);
            });
        });
    }

    /** Turn around, climb back down to ground level, then walk to the hole. */
    private travelToHole(ant: Ant, wallNormal: Vec3) {
        const top = ant.node.worldPosition.clone();
        const holePos = this.hole.worldPosition.clone();
        const base = new Vec3(top.x, holePos.y, top.z);

        this.climb(ant, top, base, wallNormal, () => {
            this.walk(ant, base, holePos, () => {
                ant.tileCollectedPos.children[0]?.destroy();
                this.pool.release(ant.node);
            });
        });
    }

    /** Ground segment: body stays level, standard world-up orientation. */
    private walk(ant: Ant, from: Vec3, to: Vec3, onDone: () => void) {
        const mid = arcControlPoint(from, to, WALK_LIFT, WALK_JITTER);
        const duration = Math.max(MIN_SEGMENT_DURATION, Vec3.distance(from, to) / WALK_SPEED);
        ant.flyTo(from, mid, to, duration, Vec3.UP, onDone);
    }

    /** Vertical segment: body tips upright against the wall, treating it as the new floor. */
    private climb(ant: Ant, from: Vec3, to: Vec3, wallNormal: Vec3, onDone: () => void) {
        const mid = arcControlPoint(from, to, 0, CLIMB_JITTER);
        const duration = Math.max(MIN_SEGMENT_DURATION, Vec3.distance(from, to) / CLIMB_SPEED);
        ant.flyTo(from, mid, to, duration, wallNormal, onDone);
    }

}
