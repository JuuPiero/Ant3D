import { _decorator, Button, Component, Node } from 'cc';
import { ScreenBase } from 'db://assets/_iKame/Scripts/Navigation/ScreenBase';
// import { TweenScale } from '../TweenScale';
import { PlayableAdsManager } from 'db://assets/_iKame/Scripts/PlayableAdsManager';
import { ETrackingEvent, TrackingManager } from 'db://assets/_iKame/Scripts/TrackingManager';
import { EventBus } from 'db://assets/_iKame/Scripts/EventBus';
import { GameEvents } from '../GameEvents';
const { ccclass, property } = _decorator;

@ccclass('EndGameScreen')
export class EndGameScreen extends ScreenBase {
    @property(Button) downloadBtn: Button = null;
    @property(Button) retryBtn: Button = null;

    @property(Node) logo: Node = null;


    public async enter(param?: {isWin, firstLose}): Promise<void> {
        // const {isWin, isFirstLose} = param;
        super.enter(param)
        if(param.firstLose) {
            this.downloadBtn.node.active = false;
            this.retryBtn.node.active = true;
            // console.log("here 123");
        }
        else {
            this.downloadBtn.node.active = true;
            this.retryBtn.node.active = false;
        }
       
    }



    protected start(): void {
        TrackingManager.TrackEvent(ETrackingEvent.ENDCARD_SHOWN)
        // this.downloadBtn.getComponent(TweenScale).playDefaultAsync()
        // this.logo.getComponent(TweenScale).playDefaultAsync()
        this.downloadBtn.node.on(Button.EventType.CLICK, () => {
            TrackingManager.TrackEvent(ETrackingEvent.CTA_CLICKED)
            PlayableAdsManager.OpenStore()
        })

        // this.retryBtn.node.on(Button.EventType.CLICK, () => {
        //     TrackingManager.TrackEvent(ETrackingEvent.CHALLENGE_RETRY);
        //     EventBus.emit(GameEvents.NEW_LEVEL);
        //     this.exit();
        // })
    }

}


