import { _decorator, Color, Component, EventMouse, EventTouch, MeshRenderer, Node } from 'cc';
import { Ant } from '../Ant/Ant';
import { ShooterData } from '../Data/LevelData';
import { ServiceLocator } from 'db://assets/_iKame/Scripts/ServiceLocator';
import { ColorsConfig } from '../Data/ColorsConfig';
import { IPointerClickHandler } from 'db://assets/_iKame/Scripts/Systems/PointerEvent';
const { ccclass, property } = _decorator;

@ccclass('Shooter')
export class Shooter extends Component implements IPointerClickHandler {
   
    @property(ShooterData) data: ShooterData = null;

    @property(MeshRenderer) renderers: MeshRenderer[] = [];

    initialize(data: ShooterData) {
        this.data = data;
        this.setColor();
    }

    setColor() {
        const color = ServiceLocator.get(ColorsConfig).colors[this.data.Color];
        const shadowColor = new Color(color.r * 0.6, color.g * 0.6, color.b * 0.6, color.a);

        for (const renderer of this.renderers) {
            renderer.setInstancedAttribute('a_instMainColor', [color.r, color.g, color.b, color.a]);
            renderer.setInstancedAttribute('a_instShadowColor', [shadowColor.r, shadowColor.g, shadowColor.b, shadowColor.a]);
        }
    }

    onPointerClick(event: EventMouse | EventTouch): void {
        console.log("Click shooter " );
        
    }

}


