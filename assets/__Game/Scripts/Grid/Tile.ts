import { _decorator, Color, Component, MeshRenderer, Node } from 'cc';
import { Ant } from '../Ant/Ant';
import { TileData } from '../Data/LevelData';
import { ServiceLocator } from 'db://assets/_iKame/Scripts/ServiceLocator';
import { ColorsConfig } from '../Data/ColorsConfig';
const { ccclass, property } = _decorator;

@ccclass('Tile')
export class Tile extends Component {
    @property data: TileData = null;
    @property(MeshRenderer) renderer: MeshRenderer = null;
    @property isTargeted: boolean = false;

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



}


