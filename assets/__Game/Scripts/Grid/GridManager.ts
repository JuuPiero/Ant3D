import { _decorator, Component, instantiate, Node, Vec3 } from 'cc';
import { LevelData } from '../Data/LevelData';
import { Tile } from './Tile';
import { ServiceLocator } from 'db://assets/_iKame/Scripts/ServiceLocator';
import { GameConfig } from '../Data/GameConfig';
const { ccclass, property } = _decorator;

@ccclass('GridManager')
export class GridManager extends Component {

    @property(Tile) tiles: Tile[] = [];

    public initialize(levelData: LevelData) {
        const tilePrefab = ServiceLocator.get(GameConfig).tilePrefab;
        const tileDatas = levelData.Cubes;

        for (const tileData of tileDatas) {
            const tileNode = instantiate(tilePrefab);
            tileNode.setParent(this.node)
            const tile = tileNode.getComponent(Tile);
            tile.initialize(tileData)
            this.tiles.push(tile);
        }
        this.node.setScale(new Vec3(levelData.CellSize, levelData.CellSize, levelData.CellSize));
        // this.node.eulerAngles = levelData.DefaultRotation;
        // this.node.setWorldPosition(levelData.GridOrigin);

    }


}


