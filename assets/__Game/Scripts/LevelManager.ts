import { _decorator, Component, JsonAsset, Node } from 'cc';
import { GridManager } from './Grid/GridManager';
const { ccclass, property } = _decorator;

@ccclass('LevelManager')
export class LevelManager extends Component {
    @property(JsonAsset) levels: JsonAsset[] = [];

    @property levelIndex: number = 0;



    @property(GridManager) gridManager: GridManager = null;
    

    initialize() {

    }
}


