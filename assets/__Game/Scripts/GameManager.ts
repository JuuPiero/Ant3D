import { _decorator, Component, Node } from 'cc';
import { LevelManager } from './LevelManager';
import { ServiceLocator } from '../../_iKame/Scripts/ServiceLocator';
import { EventBus } from '../../_iKame/Scripts/EventBus';
import { GameEvents } from './GameEvents';
import { PREVIEW } from 'cc/env';
import { ETrackingEvent, TrackingManager } from '../../_iKame/Scripts/TrackingManager';
import { GameConfig } from './Data/GameConfig';
import { ColorsConfig } from './Data/ColorsConfig';
const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {

    @property(GameConfig) gameConfig: GameConfig = null;
    @property(ColorsConfig) colorsConfig: ColorsConfig = null;

    @property(LevelManager) levelManager: LevelManager = null;



    protected onLoad(): void {
        ServiceLocator.register(GameManager, this);
        ServiceLocator.register(GameConfig, this.gameConfig);
        ServiceLocator.register(ColorsConfig, this.colorsConfig);
        ServiceLocator.register(LevelManager, this.levelManager);
    }

    protected start(): void {
        EventBus.emit(GameEvents.NEW_LEVEL);
        
    }

    protected onEnable(): void {
        EventBus.on(GameEvents.NEW_LEVEL, this.onNewgame);
        EventBus.on(GameEvents.LEVEL_WIN, this.onWinGame);
        EventBus.on(GameEvents.LEVEL_LOSE, this.onLoseGame);
        EventBus.on(GameEvents.TOGGLE_VIDEO, this.onToggleVideo);

    }

    protected onDisable(): void {
        EventBus.off(GameEvents.NEW_LEVEL, this.onNewgame)
        EventBus.off(GameEvents.LEVEL_WIN, this.onWinGame)
        EventBus.off(GameEvents.LEVEL_LOSE, this.onLoseGame);
        EventBus.off(GameEvents.TOGGLE_VIDEO, this.onToggleVideo);

    }


    onNewgame = () => {
        this.levelManager.initialize();
    }

    onWinGame = () => {

    }

    onLoseGame = () => {


    }

    onToggleVideo = () => {

    }


    @property({ readonly: true }) public progress: number = 0
    @property({ readonly: true }) public total: number = 0
    progressTracked = {
        quarter: false,  // 25%
        half: false,     // 50%
        threeQuarter: false  // 75%
    }
    onProgress = () => {
        this.progress++

        const percentage = (this.progress / this.total) * 100

        if (PREVIEW) {
            console.log("progress " + percentage)
        }
        if (!this.progressTracked.quarter && percentage >= 25) {
            this.progressTracked.quarter = true
            TrackingManager.TrackEvent(ETrackingEvent.CHALLENGE_PASS_25)
        }

        if (!this.progressTracked.half && percentage >= 50) {
            this.progressTracked.half = true
            TrackingManager.TrackEvent(ETrackingEvent.CHALLENGE_PASS_50)
        }

        if (!this.progressTracked.threeQuarter && percentage >= 75) {
            this.progressTracked.threeQuarter = true
            TrackingManager.TrackEvent(ETrackingEvent.CHALLENGE_PASS_75)
        }

        if (this.progress === this.total) {
            TrackingManager.TrackEvent(ETrackingEvent.CHALLENGE_SOLVED)
        }
    }



}


