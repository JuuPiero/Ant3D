import { _decorator, Color, Component, Node, Prefab } from 'cc';
import { bh } from 'db://scriptable-asset/scriptable_runtime';
const { ccclass, property } = _decorator;

@bh.createAssetMenu('ColorsConfig', 'Config/ColorsConfig')
@bh.scriptable('ColorsConfig')
export class ColorsConfig extends bh.ScriptableAsset {
    @property(Color) colors: Color[] = [
        new Color("#7A1428"), // 0
        new Color("#CC3333"), // 1
        new Color("#D47F7F"), // 2
        new Color("#8B2255"), // 3
        new Color("#CC2288"), // 4
        new Color("#FF55AA"), // 5
        new Color("#FF88CC"), // 6
        new Color("#441888"), // 7
        new Color("#8844BB"), // 8
        new Color("#6644FF"), // 9
        new Color("#AA88EE"), // 10
        new Color("#11205A"), // 11
        new Color("#1212E6"), // 12
        new Color("#2299EE"), // 13
        null, // 14
        new Color("#118866"), // 15
        new Color("#19D4E6"), // 16
        null, // 17
        new Color("#147914"), // 18
        new Color("#778833"), // 19
        new Color("#0FBF0F"), // 20
        new Color("#DD9900"), // 21
        new Color("#FFDD00"), // 22
        new Color("#EE7722"), // 23
        new Color("#FFAA77"), // 24
        new Color("#442211"), // 25
        new Color("#85351B"), // 26
        new Color("#BB8833"), // 27
        new Color("#313131"), // 28
        new Color("#EEEEEE"), // 29
        new Color("#6C6C7B"), // 30
    ];

}


