import { _decorator, Color, Component, MeshRenderer, Node, Quat, tween, Vec3 } from 'cc';
import { Tile } from '../Grid/Tile';
import { ServiceLocator } from 'db://assets/_iKame/Scripts/ServiceLocator';
import { ColorsConfig } from '../Data/ColorsConfig';
import { bezierPoint, bezierTangent } from './AntPath';
const { ccclass, property } = _decorator;

const HOP_HEIGHT = 0.15;
const HOP_RATE = 2.2; // hops per second, kept constant regardless of segment length/duration
const TURN_DAMPING = 0.18;

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
     * the curve and the node turning to face its direction of travel (damped so it eases into
     * turns rather than snapping frame to frame).
     *
     * `up` is the body's reference "up" axis: world-up while walking the ground, or the wall's
     * outward normal while climbing a vertical face - so climbing visibly tips the body upright
     * against the wall (treating it as the new floor) instead of just floating up the Y axis.
     */
    flyTo(p0: Vec3, p1: Vec3, p2: Vec3, duration: number, up: Vec3, onDone?: () => void) {
        const pos = new Vec3();
        const tangent = new Vec3();
        const targetRot = new Quat();
        const blendedRot = new Quat();

        tween(this.node)
            .to(duration, {}, {
                onUpdate: (_target: unknown, ratio = 0) => {
                    bezierPoint(p0, p1, p2, ratio, pos);
                    const elapsed = ratio * duration;
                    pos.y += Math.max(0, Math.sin(elapsed * HOP_RATE * Math.PI * 2)) * HOP_HEIGHT;
                    this.node.setWorldPosition(pos);

                    bezierTangent(p0, p1, p2, ratio, tangent);
                    if (tangent.lengthSqr() > 1e-6) {
                        // The Bee_2 mesh is authored facing local +Z, not Cocos' usual -Z
                        // "forward" convention, so `view` should point straight along the
                        // travel direction here (not negated).
                        Quat.fromViewUp(targetRot, tangent, up);
                        Quat.slerp(blendedRot, this.node.worldRotation, targetRot, TURN_DAMPING);
                        this.node.setWorldRotation(blendedRot);
                    }
                },
            })
            .call(() => onDone?.())
            .start();
    }

}


