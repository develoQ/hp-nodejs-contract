import { invokeCallback } from "./common";

interface UnlStats {
    active_on: number;
}

interface UnlData {
    [key: string]: UnlStats;
}

type NplMessage = Buffer | string | object;

interface NplChannel {
    consume(callback: (publicKey: string, msg: NplMessage) => void): void;
    send(msg: NplMessage): Promise<void>;
}

export class UnlNode {
    readonly publicKey: string;
    readonly activeOn: number;

    constructor(publicKey: string, activeOn: number) {
        this.publicKey = publicKey;
        this.activeOn = activeOn;
    }
}

export class UnlCollection {
    readonly nodes: { [key: string]: UnlNode } = {};
    #readonly: boolean;
    #pendingTasks: Promise<void>[];
    #channel: NplChannel | null;

    constructor(
        readonly: boolean,
        unl: UnlData,
        channel: NplChannel | null,
        pendingTasks: Promise<void>[]
    ) {
        this.#readonly = readonly;
        this.#pendingTasks = pendingTasks;

        if (!readonly) {
            for (const [publicKey, stat] of Object.entries(unl)) {
                this.nodes[publicKey] = new UnlNode(publicKey, stat.active_on);
            }

            this.#channel = channel;
        } else {
            this.#channel = null;
        }
    }

    // Returns the unl node for the specified public key. Returns undefined if not found.
    find(publicKey: string): UnlNode | undefined {
        return this.nodes[publicKey];
    }

    // Returns all the unl nodes.
    list(): UnlNode[] {
        return Object.values(this.nodes);
    }

    count(): number {
        return Object.keys(this.nodes).length;
    }

    // Registers for NPL messages.
    onMessage(callback: (node: UnlNode, msg: NplMessage) => void | Promise<void>): void {
        if (this.#readonly) {
            throw new Error("NPL messages not available in readonly mode.");
        }

        if (!this.#channel) {
            throw new Error("NPL channel not available.");
        }

        this.#channel.consume((publicKey: string, msg: NplMessage) => {
            const node = this.nodes[publicKey];
            if (node) {
                this.#pendingTasks.push(invokeCallback(callback, node, msg));
            }
        });
    }

    // Broadcasts a message to all unl nodes (including self if self is part of unl).
    async send(msg: NplMessage): Promise<void> {
        if (this.#readonly) {
            throw new Error("NPL messages not available in readonly mode.");
        }

        if (!this.#channel) {
            throw new Error("NPL channel not available.");
        }

        await this.#channel.send(msg);
    }
}
