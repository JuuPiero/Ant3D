import { _decorator, Color, Component, MeshRenderer, Node, Quat, tween, Vec3 } from 'cc';
import { Tile } from '../Grid/Tile';
import { ServiceLocator } from 'db://assets/_iKame/Scripts/ServiceLocator';
import { ColorsConfig } from '../Data/ColorsConfig';
import { bezierPoint, bezierTangent } from './AntPath';
const { ccclass, property } = _decorator;

const HOP_HEIGHT = 0.15;
const HOP_RATE = 2.2; // hops per second, kept constant regardless of segment length/duration
const TURN_DAMPING = 0.18;
const SQUARE_UP_DURATION = 0.3; // seconds to ease into grid-aligned rotation once `snap` is on

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** A path point that's either fixed, or re-read live every frame (e.g. a tile that can shift). */
export type PathPoint = Vec3 | (() => Vec3);
const resolvePoint = (p: PathPoint, out: Vec3): Vec3 => {
    out.set(typeof p === 'function' ? p() : p);
    return out;
};

@ccclass('Ant')
export class Ant extends Component {
    @property(Tile) target: Tile = null;
    @property(MeshRenderer) renderers: MeshRenderer[] = [];
    @property colorId: number = -1;
    @property(Node) tileCollectedPos: Node = null;

    setColor(colorId: number) {
        this.colorId = colorId;
        const color = ServiceLocator.get(ColorsConfig).colors[colorId];
        const shadowColor = new Color(color.r * 0.6, color.g * 0.6, color.b * 0.6, color.a);

        for (const renderer of this.renderers) {
            renderer.setInstancedAttribute('a_instMainColor', [color.r, color.g, color.b, color.a]);
            renderer.setInstancedAttribute('a_instShadowColor', [shadowColor.r, shadowColor.g, shadowColor.b, shadowColor.a]);
        }
    }

    /**
     * Flies along the quadratic Bezier p0->p1->p2, with a footstep-like hop layered on top of
     * the curve and the node turning to face its direction of travel.
     *
     * Travel along the curve itself eases in and out (slow-fast-slow) rather than moving at a
     * constant rate, so arriving at one leg's endpoint and departing on the next both read as a
     * natural decelerate-then-accelerate rather than a robotic constant-speed cut - which is what
     * lets two back-to-back legs (e.g. arriving at a tile, then immediately turning to leave it)
     * flow into each other smoothly instead of needing a dead stop in between to hide the seam.
     * The footstep hop still ticks on real elapsed time underneath that, so its cadence doesn't
     * stretch or compress with the eased travel speed.
     *
     * `up` is the body's reference "up" axis: world-up while walking the ground, or the wall's
     * outward normal while climbing a vertical face - so climbing visibly tips the body upright
     * against the wall (treating it as the new floor) instead of just floating up the Y axis.
     *
     * `snap` picks how that turn is applied: damped (continuously eases toward wherever the
     * curve is currently heading) for free-roaming ground travel, or - for climbing - a single
     * smooth ease from whatever angle it was facing into the grid-aligned orientation over
     * `SQUARE_UP_DURATION`, then held exactly there for the rest of the segment. That guarantees
     * it's squared up with the grid well before it reaches the tile (never left lagging), without
     * the turn itself popping instantly.
     */
    flyTo(p0: Vec3, p1: PathPoint, p2: PathPoint, duration: number, up: Vec3, snap: boolean, onDone?: () => void) {
        const pos = new Vec3();
        const tangent = new Vec3();
        const targetRot = new Quat();
        const blendedRot = new Quat();
        const startRot = this.node.worldRotation.clone();
        const p1v = new Vec3();
        const p2v = new Vec3();

        tween(this.node)
            .to(duration, {}, {
                onUpdate: (_target: unknown, ratio = 0) => {
                    resolvePoint(p1, p1v);
                    resolvePoint(p2, p2v);

                    const eased = smoothstep(ratio);
                    bezierPoint(p0, p1v, p2v, eased, pos);
                    const elapsed = ratio * duration;
                    pos.y += Math.max(0, Math.sin(elapsed * HOP_RATE * Math.PI * 2)) * HOP_HEIGHT;
                    this.node.setWorldPosition(pos);

                    bezierTangent(p0, p1v, p2v, eased, tangent);
                    if (tangent.lengthSqr() > 1e-6) {
                        // The Bee_2 mesh is authored facing local +Z, not Cocos' usual -Z
                        // "forward" convention, so `view` should point straight along the
                        // travel direction here (not negated).
                        Quat.fromViewUp(targetRot, tangent, up);
                        if (snap) {
                            const squareUpT = smoothstep(Math.min(1, elapsed / SQUARE_UP_DURATION));
                            Quat.slerp(blendedRot, startRot, targetRot, squareUpT);
                        } else {
                            Quat.slerp(blendedRot, this.node.worldRotation, targetRot, TURN_DAMPING);
                        }
                        this.node.setWorldRotation(blendedRot);
                    }
                },
            })
            .call(() => onDone?.())
            .start();
    }

}


