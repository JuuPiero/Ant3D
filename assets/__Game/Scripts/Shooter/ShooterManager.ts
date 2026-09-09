import { _decorator, Component, instantiate, Node, Vec2, Vec3, tween } from 'cc';
import { LevelData } from '../Data/LevelData';
import { Shooter } from './Shooter';
import { ServiceLocator } from 'db://assets/_iKame/Scripts/ServiceLocator';
import { EventBus } from 'db://assets/_iKame/Scripts/EventBus';
import { GameConfig } from '../Data/GameConfig';
import { GridManager } from '../Grid/GridManager';
import { SlotManager } from '../Slot/SlotManager';
import { AntManager } from '../Ant/AntManager';
import { GameEvents } from '../GameEvents';
const { ccclass, property } = _decorator;

const FLY_DURATION = 0.5;

interface WaitingShooter {
    shooter: Shooter;
    slot: Node;
    atWorldPos: Vec3;
}

@ccclass('ShooterManager')
export class ShooterManager extends Component {

    @property(Shooter) shooterLines: Shooter[][] = [];

    @property(Vec2) spacing: Vec2 = new Vec2(); // space x and y grid


    @property({type: Node, readonly: true}) lineNodes: Node[] = []

    private slotManager: SlotManager = null;
    private gridManager: GridManager = null;
    private antManager: AntManager = null;

    /** Shooters that reached their slot but had no matching tile to release ants against yet. */
    private waitingShooters: WaitingShooter[] = [];

    initialize(levelData: LevelData, gridManager: GridManager, slotManager: SlotManager, hole: Node) {
        this.gridManager = gridManager;
        this.slotManager = slotManager;

        const antContainer = new Node('Ants');
        antContainer.setParent(this.node);
        this.antManager = new AntManager(gridManager, hole, ServiceLocator.get(GameConfig).antPrefab, antContainer);

        EventBus.on(GameEvents.GRID_FACE_ADVANCED, this.onFaceAdvanced);

        const lineOffset = (levelData.LineCount - 1) / 2;
        for (let i = 0; i < levelData.LineCount; i++) {
            const lineNode = new Node(`LINE_${i}`);
            lineNode.setParent(this.node);
            lineNode.setPosition((i - lineOffset) * this.spacing.x, 0, 0);
            this.lineNodes.push(lineNode)
        }

        const shooterDatas = levelData.ShooterSpawnData;
        const shooterPrefab = ServiceLocator.get(GameConfig).shooterPrefab;
        for (const shooterData of shooterDatas) {
            const shooterNode = instantiate(shooterPrefab);
            shooterNode.setParent(this.lineNodes[shooterData.Line]);
            // Index 0 is the front of the queue, and the front must sit closest to the
            // slots; the line's local +Z is the direction from ShooterManager toward
            // SlotManager, so higher indices trail behind at more negative Z.
            shooterNode.setPosition(0, 0, -shooterData.Index * this.spacing.y);

            const shooter = shooterNode.getComponent(Shooter)
            shooter.initialize(shooterData);
            shooter.onClick = () => this.onShooterClicked(shooterData.Line, shooter);

            if (!this.shooterLines[shooterData.Line]) {
                this.shooterLines[shooterData.Line] = [];
            }
            this.shooterLines[shooterData.Line][shooterData.Index] = shooter;
        }

    }

    protected onDestroy(): void {
        EventBus.off(GameEvents.GRID_FACE_ADVANCED, this.onFaceAdvanced);
    }

    /** Only the front-most shooter of a line can fire; the rest wait their turn. */
    private onShooterClicked(line: number, shooter: Shooter) {
        const queue = this.shooterLines[line];
        if (!queue || queue[0] !== shooter) return;

        const slot = this.slotManager.getEmptySlot();
        if (!slot) return; // no open slot right now, ignore the click

        queue.shift();
        this.slotManager.occupy(slot);
        shooter.isBusy = true;

        const targetWorldPos = slot.worldPosition.clone();
        tween(shooter.node)
            .to(FLY_DURATION, { worldPosition: targetWorldPos }, { easing: 'quadInOut' })
            .call(() => this.tryRelease({ shooter, slot, atWorldPos: targetWorldPos }))
            .start();

        this.advanceLine(line);
    }

    /**
     * Releases the shooter's swarm and despawns it, but only once at least one matching tile
     * is available; otherwise it stays parked at its slot (still occupying it) until the grid's
     * outer face advances enough to expose one.
     */
    private tryRelease(waiting: WaitingShooter) {
        const { shooter, slot, atWorldPos } = waiting;
        if (!this.gridManager.findCollectible(shooter.data.Color)) {
            this.waitingShooters.push(waiting);
            return;
        }

        this.antManager.spawnSwarm(shooter.data.Color, shooter.data.Ammo, atWorldPos);
        this.slotManager.free(slot);
        shooter.node.destroy();
    }

    private onFaceAdvanced = () => {
        const stillWaiting: WaitingShooter[] = [];
        for (const waiting of this.waitingShooters) {
            if (this.gridManager.findCollectible(waiting.shooter.data.Color)) {
                this.tryRelease(waiting);
            } else {
                stillWaiting.push(waiting);
            }
        }
        this.waitingShooters = stillWaiting;
    };

    /** Slides the remaining queued shooters of a line forward one step to close the gap. */
    private advanceLine(line: number) {
        this.shooterLines[line].forEach((shooter, index) => {
            tween(shooter.node)
                .to(FLY_DURATION, { position: new Vec3(0, 0, -index * this.spacing.y) }, { easing: 'quadInOut' })
                .start();
        });
    }

}


