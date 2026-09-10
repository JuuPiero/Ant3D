import { Node, Prefab, Vec3, tween } from 'cc';
import { Ant, PathPoint } from './Ant';
import { AntPool } from './AntPool';
import { arcControlPoint } from './AntPath';
import { GridManager } from '../Grid/GridManager';
import { Tile } from '../Grid/Tile';

const SPAWN_STAGGER = 0.08;
const MIN_SEGMENT_DURATION = 0.25;
const PICKUP_PAUSE = 0.15; // beat at the tile before turning around to head back down/out

// Ground approach (slot<->grid, grid<->hole): slow, visible pace with a light bouncy arc.
const WALK_SPEED = 3
const WALK_LIFT = 0.25;
const WALK_JITTER = 0.3;

// Climbing the grid face up/down to reach a tile that isn't at ground level. No jitter - the
// grid's exposed face is always its own local -Z (tiles are peeled ascending Z, ants approach
// from the -Z/shooter side) regardless of which direction a given ant happened to walk in from,
// so the body stays perfectly squared to the grid the whole time it's touching it, instead of
// inheriting a diagonal from the walk-in. That local normal is carried into world space via
// GridManager.getOutwardNormal() so it still tracks the wall correctly if the grid itself has
// been rotated to some arbitrary angle, instead of assuming it always faces world -Z.
const CLIMB_SPEED = 2;
const GRID_LOCAL_OUTWARD_NORMAL = new Vec3(0, 0, -1);

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

    /** `onComplete` fires once the whole staggered burst has been dispatched - the full count, or as soon as it stops early. */
    spawnSwarm(color: number, count: number, fromWorldPos: Vec3, onComplete?: () => void) {
        if (count <= 0) {
            onComplete?.();
            return;
        }

        let stopped = false;
        for (let i = 0; i < count; i++) {
            tween({})
                .delay(i * SPAWN_STAGGER)
                .call(() => {
                    if (stopped) return;
                    if (!this.spawnOne(color, fromWorldPos)) {
                        stopped = true;
                        onComplete?.();
                        return;
                    }
                    if (i === count - 1) onComplete?.();
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

    /**
     * Walk to the base of the tile's column at ground level, then climb straight up to it - but
     * only for row > 0. Row 0 sits right at ground level (its "bottom edge" pickup point is only
     * about half a tile below where the ant is already walking), so it doesn't need the separate
     * wall-climb treatment at all: just walk straight to it.
     */
    private travelToTile(ant: Ant, tile: Tile) {
        const start = ant.node.worldPosition.clone();

        // The tile's own position is its mesh center; walk/climb to its outward bottom edge
        // instead so the ant stops at the surface rather than sinking into the cube. Read live
        // (not snapshotted) while climbing: a tile below it in the same column can get collected
        // and settle this one down mid-climb, and the ant needs to track that, not fly to a
        // now-stale position.
        const getTop = () => tile.getPickupPoint(GRID_LOCAL_OUTWARD_NORMAL);
        const top = getTop();
        const needsClimb = tile.data.GridPosition.y > 0;

        const onArrived = () => {
            if (this.gridManager.collectTile(tile)) {
                tile.pickUp(ant.tileCollectedPos);
            }
            // A short beat before turning around: without it, the 180-degree reversal (facing
            // up the wall to facing down it) starts instantly off the climb's own momentum,
            // which reads as a jerky whip-turn no matter how eased the rotation itself is.
            tween({})
                .delay(PICKUP_PAUSE)
                .call(() => this.travelToHole(ant, needsClimb))
                .start();
        };

        if (needsClimb) {
            const base = this.groundPointBelow(top, start.y);
            this.walk(ant, start, base, () => this.climb(ant, base, getTop, onArrived));
        } else {
            this.walk(ant, start, top, onArrived);
        }
    }

    /** Turn around, climb back down to ground level (if it had climbed up at all), then walk to the hole. */
    private travelToHole(ant: Ant, wasClimbing: boolean) {
        const top = ant.node.worldPosition.clone();
        const holePos = this.hole.worldPosition.clone();

        if (wasClimbing) {
            const base = this.groundPointBelow(top, holePos.y);
            this.climb(ant, top, base, () => this.walk(ant, base, holePos, () => this.arriveAtHole(ant)));
        } else {
            this.walk(ant, top, holePos, () => this.arriveAtHole(ant));
        }
    }

    /**
     * Point at ground height `groundY`, directly below/above `top` along the grid's own vertical
     * (climb) axis - not necessarily world Y if the grid has been rotated so its face tilts.
     */
    private groundPointBelow(top: Vec3, groundY: number): Vec3 {
        const up = this.gridManager.getUpAxis();
        const t = (top.y - groundY) / up.y;
        return new Vec3(top.x - up.x * t, groundY, top.z - up.z * t);
    }

    private arriveAtHole(ant: Ant) {
        ant.tileCollectedPos.children[0]?.destroy();
        this.pool.release(ant.node);
    }

    /** Ground segment, before touching or after leaving the grid: free, damped turning. */
    private walk(ant: Ant, from: Vec3, to: Vec3, onDone: () => void) {
        const mid = arcControlPoint(from, to, WALK_LIFT, WALK_JITTER);
        const duration = Math.max(MIN_SEGMENT_DURATION, Vec3.distance(from, to) / WALK_SPEED);
        ant.flyTo(from, mid, to, duration, Vec3.UP, false, onDone);
    }

    /**
     * Vertical segment along the grid face: body snapped upright against the wall (treating it
     * as the new floor), squared to the fixed grid normal for as long as it's touching the grid.
     * `to` may be a live getter (see travelToTile) instead of a fixed point.
     */
    private climb(ant: Ant, from: Vec3, to: PathPoint, onDone: () => void) {
        const getTo = typeof to === 'function' ? to : null;
        const toSnapshot = getTo ? getTo() : (to as Vec3);
        const mid: PathPoint = getTo
            ? () => Vec3.lerp(new Vec3(), from, getTo(), 0.5)
            : arcControlPoint(from, toSnapshot, 0, 0);
        const duration = Math.max(MIN_SEGMENT_DURATION, Vec3.distance(from, toSnapshot) / CLIMB_SPEED);
        ant.flyTo(from, mid, to, duration, this.gridManager.getOutwardNormal(), true, onDone);
    }

}
