import { _decorator, Component, JsonAsset, Node } from 'cc';
import { GridManager } from './Grid/GridManager';
import { LevelData } from './Data/LevelData';
const { ccclass, property } = _decorator;

@ccclass('LevelManager')
export class LevelManager extends Component {
    @property(JsonAsset) levels: JsonAsset[] = [];

    @property levelIndex: number = 0;

    @property(LevelData) levelData: LevelData = null;

    @property(GridManager) gridManager: GridManager = null;
    

    initialize() {
        this.levelData = LevelData.ParseJson(this.levels[this.levelIndex]);



    }
}


