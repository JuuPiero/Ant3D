import { _decorator, Component, JsonAsset, Node } from 'cc';
import { GridManager } from './Grid/GridManager';
import { LevelData } from './Data/LevelData';
import { ShooterManager } from './Shooter/ShooterManager';
import { SlotManager } from './Slot/SlotManager';
const { ccclass, property } = _decorator;

@ccclass('LevelManager')
export class LevelManager extends Component {
    @property(JsonAsset) levels: JsonAsset[] = [];

    @property levelIndex: number = 0;

    @property(LevelData) levelData: LevelData = null;

    @property(GridManager) gridManager: GridManager = null;
    @property(ShooterManager) shooterManager: ShooterManager = null;
    @property(SlotManager) slotManager: SlotManager = null;
    

    initialize() {
        this.levelData = LevelData.ParseJson(this.levels[this.levelIndex]);
        this.gridManager.initialize(this.levelData);
        this.shooterManager.initialize(this.levelData);
        this.slotManager.initialize();


    }
}


