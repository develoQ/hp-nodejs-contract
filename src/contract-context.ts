import { controlMessages } from "./common";
import { PatchConfig, PatchConfigData } from "./patch-config";
import { User, UsersCollection } from "./user";
import { UnlCollection } from "./unl";

interface HotPocketArguments {
    contract_id: string;
    public_key: string;
    private_key: string;
    readonly: boolean;
    timestamp: number;
    lcl_seq_no?: number;  // Not available in readonly mode
    lcl_hash?: string;    // Not available in readonly mode
}

interface ControlChannel {
    send(message: { 
        type: string;
        add: string[];
        remove: string[];
    }): Promise<void>;
}

// HotPocket contract context which is passed into every smart contract invocation.
export class ContractContext {
    readonly contractId: string;
    readonly publicKey: string;
    readonly privateKey: string;
    readonly readonly: boolean;
    readonly timestamp: number;
    readonly users: UsersCollection;
    readonly unl?: UnlCollection;
    readonly lclSeqNo?: number;
    readonly lclHash?: string;

    #patchConfig: PatchConfig;
    #controlChannel: ControlChannel;

    constructor(
        hpargs: HotPocketArguments,
        users: UsersCollection,
        unl: UnlCollection | undefined,
        controlChannel: ControlChannel
    ) {
        this.#patchConfig = new PatchConfig();
        this.#controlChannel = controlChannel;
        this.contractId = hpargs.contract_id;
        this.publicKey = hpargs.public_key;
        this.privateKey = hpargs.private_key;
        this.readonly = hpargs.readonly;
        this.timestamp = hpargs.timestamp;
        this.users = users;
        this.unl = unl;         // Not available in readonly mode.
        this.lclSeqNo = hpargs.lcl_seq_no;  // Not available in readonly mode.
        this.lclHash = hpargs.lcl_hash;      // Not available in readonly mode.
    }

    // Returns the config values in patch config.
    getConfig(): Promise<PatchConfigData> {
        return this.#patchConfig.getConfig();
    }

    // Updates the config with given config object and save the patch config.
    updateConfig(config: PatchConfigData): Promise<void> {
        return this.#patchConfig.updateConfig(config);
    }

    // Updates the known-peers this node must attempt connections to.
    // toAdd: Array of strings containing peers to be added. Each string must be in the format of "<ip>:<port>".
    updatePeers(toAdd?: string[], toRemove?: string[]): Promise<void> {
        return this.#controlChannel.send({
            type: controlMessages.peerChangeset,
            add: toAdd || [],
            remove: toRemove || []
        });
    }
}
