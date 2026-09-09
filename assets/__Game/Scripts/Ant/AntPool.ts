import { instantiate, Node, Prefab } from 'cc';

/**
 * Plain (non-Component) pool: ants are spawned/despawned constantly while the grid is being
 * cleared, and nothing here needs scene-node lifecycle, so it's owned directly by AntManager
 * instead of relying on scene wiring.
 */
export class AntPool {
    private free: Node[] = [];

    constructor(private prefab: Prefab, private container: Node) {}

    get(): Node {
        const node = this.free.pop() ?? instantiate(this.prefab);
        node.setParent(this.container);
        node.active = true;
        return node;
    }

    release(node: Node) {
        node.active = false;
        this.free.push(node);
    }
}
