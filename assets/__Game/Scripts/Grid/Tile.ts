import { _decorator, Color, Component, MeshRenderer, Node, Quat, Tween, Vec3 } from 'cc';
import { Ant } from '../Ant/Ant';
import { TileData } from '../Data/LevelData';
import { ServiceLocator } from 'db://assets/_iKame/Scripts/ServiceLocator';
import { ColorsConfig } from '../Data/ColorsConfig';
import { punch } from 'db://assets/_iKame/Scripts/Tween/TweenUntils';
const { ccclass, property } = _decorator;

@ccclass('Tile')
export class Tile extends Component {
    @property data: TileData = null;
    @property(MeshRenderer) renderer: MeshRenderer = null;
    @property isTargeted: boolean = false;

    /** Ants currently en route to hit this tile — lets a Health>1 tile be targeted by more than one ant at once. */
    pendingHits: number = 0;

    initialize(data: TileData) {
        this.data = data;
        this.node.name = `TILE(${data.GridPosition.x}, ${data.GridPosition.y}, ${data.GridPosition.z})`;
        this.node.setPosition(data.GridPosition);
        this.setColor()
    }

    setColor() {
        const color = ServiceLocator.get(ColorsConfig).colors[this.data.Color];
        const shadowColor = new Color(color.r * 0.6, color.g * 0.6, color.b * 0.6, color.a);

        // Set via GPU-instanced attributes on the shared material (not a
        // material instance) so same-material tiles keep batching into one
        // draw call instead of each forking its own material/draw call.
        this.renderer.setInstancedAttribute('a_instMainColor', [color.r, color.g, color.b, color.a]);
        this.renderer.setInstancedAttribute('a_instShadowColor', [shadowColor.r, shadowColor.g, shadowColor.b, shadowColor.a]);
    }

    /**
     * World position on this tile's bottom, `outwardDir`-facing edge rather than its center
     * (the tile's own position is its mesh center) — so an approaching ant stops right at the
     * surface instead of climbing/walking into the middle of the cube. Falls back to the center
     * if the render model's bounds aren't ready yet (e.g. called before its first frame).
     */
    getPickupPoint(outwardDir: Vec3): Vec3 {
        const center = this.node.worldPosition;
        const halfExtents = this.renderer.model?.worldBounds?.halfExtents;
        if (!halfExtents) return center.clone();

        return new Vec3(
            center.x + outwardDir.x * halfExtents.x,
            center.y - halfExtents.y,
            center.z + outwardDir.z * halfExtents.z,
        );
    }

    /** One hit from a collecting ant. Returns true once the tile is fully depleted. */
    hit(): boolean {
        this.data.Health--;
        if (this.data.Health > 0) {
            punch(this.node, 0.2);
        }
        return this.data.Health <= 0;
    }

    /**
     * Snaps this (now fully depleted) tile onto the collecting ant's carry socket, so it rides
     * along visually until the ant reaches the hole. Keeps world transform across the reparent
     * so the tile doesn't pop to a different size under the ant's unscaled hierarchy, then snaps
     * local position/rotation to the socket.
     */
    pickUp(socket: Node) {
        // A gravity-settle moveTo() from compactColumn() may still be mid-flight on this node
        // (it started while this tile still had a neighbor above it); left running, it would
        // keep overwriting position for its remaining duration, now misinterpreted in the new
        // parent's (much smaller, ant-local) space and yanking the tile away from the socket.
        Tween.stopAllByTarget(this.node);

        this.node.setParent(socket, true);
        this.node.setPosition(Vec3.ZERO);
        this.node.setRotation(Quat.IDENTITY);
        punch(this.node, 0.2);
    }

}


