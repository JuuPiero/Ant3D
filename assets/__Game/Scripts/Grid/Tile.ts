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
     * if the mesh has no authored bounds.
     *
     * `outwardDir` is in the tile's own local space (e.g. the grid's fixed local -Z peel face),
     * not world space: the point is built from the mesh's own raw vertex-space bounds (fixed
     * geometry, untouched by node scale/rotation) and only then carried into world space via the
     * node's full world matrix, so it still lands on the true face/edge even when the grid has
     * been rotated to an arbitrary angle.
     */
    getPickupPoint(outwardDir: Vec3): Vec3 {
        const struct = this.renderer.mesh?.struct;
        const min = struct?.minPosition;
        const max = struct?.maxPosition;
        if (!min || !max) return this.renderer.node.worldPosition.clone();

        const local = new Vec3(
            (min.x + max.x) / 2 + outwardDir.x * (max.x - min.x) / 2,
            (min.y + max.y) / 2 - (max.y - min.y) / 2,
            (min.z + max.z) / 2 + outwardDir.z * (max.z - min.z) / 2,
        );
        // Transformed via the renderer's own node (not necessarily `this.node` if the mesh sits
        // on a child) so an authored offset/rotation on that child is respected too.
        return Vec3.transformMat4(local, local, this.renderer.node.worldMatrix);
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


