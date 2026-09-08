import { _decorator, Component, instantiate, Node, Vec2 } from 'cc';
import { LevelData } from '../Data/LevelData';
import { Shooter } from './Shooter';
import { ServiceLocator } from 'db://assets/_iKame/Scripts/ServiceLocator';
import { GameConfig } from '../Data/GameConfig';
const { ccclass, property } = _decorator;

@ccclass('ShooterManager')
export class ShooterManager extends Component {

    @property(Shooter) shooterLines: Shooter[][] = [];

    @property(Vec2) spacing: Vec2 = new Vec2(); // space x and y grid


    @property({type: Node, readonly: true}) lineNodes: Node[] = []


    initialize(levelData: LevelData) {
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
            shooterNode.setPosition(0, 0, shooterData.Index * this.spacing.y);

            const shooter = shooterNode.getComponent(Shooter)
            shooter.initialize(shooterData);

            if (!this.shooterLines[shooterData.Line]) {
                this.shooterLines[shooterData.Line] = [];
            }
            this.shooterLines[shooterData.Line][shooterData.Index] = shooter;
        }

    }

}


