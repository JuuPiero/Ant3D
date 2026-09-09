import { _decorator, Component, JsonAsset, Node } from 'cc';
import { GridManager } from './Grid/GridManager';
import { LevelData } from './Data/LevelData';
import { ShooterManager } from './Shooter/ShooterManager';
import { SlotManager } from './Slot/SlotManager';
import { Hole } from './Hole';
const { ccclass, property } = _decorator;

@ccclass('LevelManager')
export class LevelManager extends Component {
    @property(JsonAsset) levels: JsonAsset[] = [];

    @property levelIndex: number = 0;

    @property(LevelData) levelData: LevelData = null;

    @property(GridManager) gridManager: GridManager = null;
    @property(ShooterManager) shooterManager: ShooterManager = null;
    @property(SlotManager) slotManager: SlotManager = null;

    @property(Hole) hole: Hole = null;

    

    initialize() {
        this.levelData = LevelData.ParseJson(this.levels[this.levelIndex]);
        this.gridManager.initialize(this.levelData);
        this.slotManager.initialize();
        this.shooterManager.initialize(this.levelData, this.gridManager, this.slotManager, this.hole.node);


    }
}


