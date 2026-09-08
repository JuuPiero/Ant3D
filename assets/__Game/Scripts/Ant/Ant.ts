import { _decorator, Component, Node } from 'cc';
import { Tile } from '../Grid/Tile';
const { ccclass, property } = _decorator;

@ccclass('Ant')
export class Ant extends Component {
    @property(Tile) target: Tile = null;





}


