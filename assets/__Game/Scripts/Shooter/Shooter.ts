import { _decorator, Color, Component, EventMouse, EventTouch, Label, MeshRenderer, Node } from 'cc';
import { Ant } from '../Ant/Ant';
import { ShooterData } from '../Data/LevelData';
import { ServiceLocator } from 'db://assets/_iKame/Scripts/ServiceLocator';
import { ColorsConfig } from '../Data/ColorsConfig';
import { IPointerClickHandler } from 'db://assets/_iKame/Scripts/Systems/PointerEvent';
const { ccclass, property } = _decorator;

@ccclass('Shooter')
export class Shooter extends Component implements IPointerClickHandler {
   
    @property({type: ShooterData, readonly: true}) data: ShooterData = null;

    @property(MeshRenderer) renderers: MeshRenderer[] = [];

    @property(Label) ammolabel: Label = null; 

    /** Set by ShooterManager per-instance; avoids a circular back-reference @property. */
    onClick: (shooter: Shooter) => void = null;

    isBusy: boolean = false;

    initialize(data: ShooterData) {
        this.data = data;
        this.setColor();
        this.updateUI()
    }

    updateUI() {
        this.ammolabel.string = this.data.Ammo.toString()
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
        if (this.isBusy) return;
        this.onClick?.(this);
    }

}


