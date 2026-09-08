import { _decorator, Component, Node, Renderer } from 'cc';
import { Tile } from '../Grid/Tile';
const { ccclass, property } = _decorator;

@ccclass('Ant')
export class Ant extends Component {
    @property(Tile) target: Tile = null;
    @property(Renderer) renderers: Renderer[] = [];

    setColor(colorId: number) {

    }
   
}


