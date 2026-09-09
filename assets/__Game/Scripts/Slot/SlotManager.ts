import { _decorator, Component, instantiate, Node } from 'cc';
import { LevelData } from '../Data/LevelData';
import { ServiceLocator } from 'db://assets/_iKame/Scripts/ServiceLocator';
import { GameConfig } from '../Data/GameConfig';
const { ccclass, property } = _decorator;

@ccclass('SlotManager')
export class SlotManager extends Component {
    @property count: number = 5;

    @property spacing: number = 1;

    private slots: Node[] = [];
    private occupied: boolean[] = [];

    initialize() {
        const slotPrefab = ServiceLocator.get(GameConfig).slotPrefab;
        const offset = (this.count - 1) / 2;
        for (let i = 0; i < this.count; i++) {
            const slotNode = instantiate(slotPrefab)
            slotNode.setParent(this.node)
            slotNode.setPosition((i - offset) * this.spacing, 0, 0);
            this.slots.push(slotNode);
            this.occupied.push(false);
        }
    }

    getEmptySlot(): Node | null {
        const index = this.occupied.indexOf(false);
        return index === -1 ? null : this.slots[index];
    }

    occupy(slot: Node) {
        this.occupied[this.slots.indexOf(slot)] = true;
    }

    free(slot: Node) {
        this.occupied[this.slots.indexOf(slot)] = false;
    }
}


