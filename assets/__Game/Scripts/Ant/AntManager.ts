import { Node, Prefab, Vec3, tween } from 'cc';
import { Ant, PathPoint } from './Ant';
import { AntPool } from './AntPool';
import { arcControlPoint } from './AntPath';
import { GridManager } from '../Grid/GridManager';
import { Tile } from '../Grid/Tile';
import { EventBus } from 'db://assets/_iKame/Scripts/EventBus';
import { GameEvents } from '../GameEvents';
import { punch } from 'db://assets/_iKame/Scripts/Tween/TweenUntils';

const SPAWN_STAGGER = 0.08;
const MIN_SEGMENT_DURATION = 0.25;
// Travel itself now eases to a near-stop on arrival and eases back up to speed on departure (see
// Ant.flyTo), so this beat is just long enough to sell the grab (its punch pop) before turning
// around - not a dead stop papering over an instant reversal like it used to be.
const PICKUP_PAUSE = 0.08;
const GRAB_PUNCH_DURATION = 0.25;

// Ground approach (slot<->grid, grid<->hole): slow, visible pace with a light bouncy arc.
const WALK_SPEED = 4
const WALK_LIFT = 0.25;
const WALK_JITTER = 0.3;

// Climbing the grid face up/down to reach a tile that isn't at ground level. No jitter - the
// grid's exposed face is always its own local -Z (tiles are peeled ascending Z, ants approach
// from the -Z/shooter side) regardless of which direction a given ant happened to walk in from,
// so the body stays perfectly squared to the grid the whole time it's touching it, instead of
// inheriting a diagonal from the walk-in. That local normal is carried into world space via
// GridManager.getOutwardNormal() so it still tracks the wall correctly if the grid itself has
// been rotated to some arbitrary angle, instead of assuming it always faces world -Z.
const CLIMB_SPEED = 4;
const GRID_LOCAL_OUTWARD_NORMAL = new Vec3(0, 0, -1);

// However scattered the wall approach is, every ant heading back to the hole is routed through
// this one fixed point first - so instead of each ant drawing its own independent line back
// (which reads as several rays converging on the hole), they all fold onto the same final lane
// and the swarm reads as one braided, single-file queue feeding the hole, matching the reference.
const HOLE_MERGE_DIST = 1;

interface PendingSwarm {
    color: number;
    fromWorldPos: Vec3;
    remaining: number;
    onAmmoUsed?: () => void;
    onComplete?: () => void;
}

/**
 * Orchestrates the whole ant lifecycle once a shooter releases its swarm: spawn -> walk to the
 * base of the target tile's column -> climb the face if it's not at ground level -> collect ->
 * turn around, climb back down -> walk to the hole -> despawn.
 * A shooter's Ammo is sized against the *whole* grid (every z-layer combined), not just
 * whatever's exposed on the outer face the moment it fires - so if the face runs dry of a
 * color mid-burst, the remaining ammo is parked (not dropped) and resumed as soon as more of
 * that color is exposed, keeping ants-spawned == Ammo once the level actually has that much.
 * Plain class, not a Component: everything here is driven by tweens, nothing needs scene-node
 * lifecycle - but it does subscribe to an EventBus event, so call dispose() when done with it.
 */
export class AntManager {

    private pool: AntPool;
    private holeMergePoint: Vec3 | null = null;
    private pendingSwarms: PendingSwarm[] = [];

    constructor(private gridManager: GridManager, private hole: Node, antPrefab: Prefab, container: Node) {
        this.pool = new AntPool(antPrefab, container);
        EventBus.on(GameEvents.GRID_FACE_ADVANCED, this.onFaceAdvanced);
    }

    dispose() {
        EventBus.off(GameEvents.GRID_FACE_ADVANCED, this.onFaceAdvanced);
    }

    /**
     * `onAmmoUsed` fires once per ant as it's actually dispatched (e.g. to live-update a shooter's
     * ammo counter in step with what's really happening, instead of just at the start/end of the
     * burst). `onComplete` fires once `count` ants have actually been spawned - possibly after
     * waiting across one or more face advances.
     */
    spawnSwarm(color: number, count: number, fromWorldPos: Vec3, onAmmoUsed?: () => void, onComplete?: () => void) {
        this.releaseAmmo({ color, fromWorldPos, remaining: count, onAmmoUsed, onComplete });
    }

    /** Retry every swarm that ran out of exposed tiles, now that a new face may have opened some up. */
    private onFaceAdvanced = () => {
        const jobs = this.pendingSwarms;
        this.pendingSwarms = [];
        for (const job of jobs) this.releaseAmmo(job);
    };

    /** Spawns one ant, then re-schedules itself after SPAWN_STAGGER until `remaining` hits 0. */
    private releaseAmmo(job: PendingSwarm) {
        if (job.remaining <= 0) {
            job.onComplete?.();
            return;
        }

        if (!this.spawnOne(job.color, job.fromWorldPos)) {
            this.pendingSwarms.push(job);
            return;
        }

        job.remaining--;
        job.onAmmoUsed?.();
        tween({}).delay(SPAWN_STAGGER).call(() => this.releaseAmmo(job)).start();
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
        // (not snapshotted) everywhere below: a tile below it in the same column can get
        // collected and settle this one down - mid-walk or mid-climb - and the ant needs to
        // track that, not fly to a now-stale position.
        const getTop = () => tile.getPickupPoint(GRID_LOCAL_OUTWARD_NORMAL);

        const onArrived = (didClimb: boolean) => {
            if (this.gridManager.collectTile(tile)) {
                tile.pickUp(ant.tileCollectedPos);
            }
            // A quick tactile "got it" pop right on the grab, plus a short beat before turning
            // around so that pop has time to read before the body starts swinging the other way.
            punch(ant.node, GRAB_PUNCH_DURATION);
            tween({})
                .delay(PICKUP_PAUSE)
                .call(() => this.travelToHole(ant, didClimb))
                .start();
        };

        if (tile.data.GridPosition.y > 0) {
            const base = this.groundPointBelow(getTop(), start.y);
            this.walk(ant, start, base, () => {
                // Re-checked on arrival, not just decided once back at departure: the column
                // below can finish compacting - settling this tile all the way to ground level -
                // while this ant was still walking over, in which case it should be grabbed
                // directly like any row-0 tile instead of climbing a wall that isn't there for
                // it anymore (matches the reference: the next ant never climbs for a tile that
                // already dropped to the bottom).
                if (tile.data.GridPosition.y > 0) {
                    this.climb(ant, base, getTop, () => onArrived(true));
                } else {
                    this.walk(ant, base, getTop, () => onArrived(false));
                }
            });
        } else {
            this.walk(ant, start, getTop, () => onArrived(false));
        }
    }

    /** Turn around, climb back down to ground level (if it had climbed up at all), then walk to the hole. */
    private travelToHole(ant: Ant, wasClimbing: boolean) {
        const top = ant.node.worldPosition.clone();
        const holePos = this.hole.worldPosition.clone();

        const walkIn = (from: Vec3) => {
            const merge = this.getHoleMergePoint();
            this.walk(ant, from, merge, () => this.walk(ant, merge, holePos, () => this.arriveAtHole(ant)));
        };

        if (wasClimbing) {
            const base = this.groundPointBelow(top, holePos.y);
            this.climb(ant, top, base, () => walkIn(base));
        } else {
            walkIn(top);
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

    /**
     * Fixed point every returning ant passes through just before the hole, sitting on the line
     * from the grid toward the hole. Same point for every ant regardless of which column it
     * climbed down, so the final leg of the trip always overlaps into one shared lane. Cached
     * since both ends are static for the level's lifetime.
     */
    private getHoleMergePoint(): Vec3 {
        if (!this.holeMergePoint) {
            const holePos = this.hole.worldPosition;
            const dir = Vec3.subtract(new Vec3(), holePos, this.gridManager.node.worldPosition);
            dir.y = 0;
            if (dir.lengthSqr() > 1e-6) dir.normalize(); else dir.set(0, 0, 1);
            this.holeMergePoint = new Vec3(
                holePos.x - dir.x * HOLE_MERGE_DIST,
                holePos.y,
                holePos.z - dir.z * HOLE_MERGE_DIST,
            );
        }
        return this.holeMergePoint;
    }

    private arriveAtHole(ant: Ant) {
        ant.tileCollectedPos.children[0]?.destroy();
        this.pool.release(ant.node);
    }

    /**
     * Ground segment, before touching or after leaving the grid: free, damped turning.
     * `to` may be a live getter (see travelToTile) instead of a fixed point.
     */
    private walk(ant: Ant, from: Vec3, to: PathPoint, onDone: () => void) {
        const getTo = typeof to === 'function' ? to : null;
        const toSnapshot = getTo ? getTo() : (to as Vec3);
        const mid = arcControlPoint(from, toSnapshot, WALK_LIFT, WALK_JITTER);
        const duration = Math.max(MIN_SEGMENT_DURATION, Vec3.distance(from, toSnapshot) / WALK_SPEED);
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
