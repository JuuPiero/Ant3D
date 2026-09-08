import { _decorator, Color, Component, MeshRenderer, Node, Renderer } from 'cc';
import { Tile } from '../Grid/Tile';
import { ServiceLocator } from 'db://assets/_iKame/Scripts/ServiceLocator';
import { ColorsConfig } from '../Data/ColorsConfig';
const { ccclass, property } = _decorator;

@ccclass('Ant')
export class Ant extends Component {
    @property(Tile) target: Tile = null;
    @property(MeshRenderer) renderers: MeshRenderer[] = [];

    setColor(colorId: number) {
        const color = ServiceLocator.get(ColorsConfig).colors[colorId];
        const shadowColor = new Color(color.r * 0.6, color.g * 0.6, color.b * 0.6, color.a);

        for (const renderer of this.renderers) {
            renderer.setInstancedAttribute('a_instMainColor', [color.r, color.g, color.b, color.a]);
            renderer.setInstancedAttribute('a_instShadowColor', [shadowColor.r, shadowColor.g, shadowColor.b, shadowColor.a]);
        }
    }

}


