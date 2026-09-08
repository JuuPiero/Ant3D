import { _decorator, Component, Node, Prefab } from 'cc';
import { bh } from 'db://scriptable-asset/scriptable_runtime';
const { ccclass, property } = _decorator;

@bh.createAssetMenu('GameConfig', 'Config/GameConfig')
@bh.scriptable('GameConfig')
export class GameConfig extends bh.ScriptableAsset {
    
    @property(Prefab) tilePrefab: Prefab = null;
    @property(Prefab) shooterPrefab: Prefab = null;
    @property(Prefab) slotPrefab: Prefab = null;
    

}


