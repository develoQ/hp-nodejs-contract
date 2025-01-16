import { constants } from './common';
import * as fs from 'fs';

interface ConsensusConfig {
    mode: 'public' | 'private';
    roundtime: number;
    stage_slice: number;
    threshold: number;
}

interface NplConfig {
    mode: 'public' | 'private';
}

interface RoundLimits {
    user_input_bytes: number;
    user_output_bytes: number;
    npl_output_bytes: number;
    proc_cpu_seconds: number;
    proc_mem_bytes: number;
    proc_ofd_count: number;
}

export interface PatchConfigData {
    version: string;
    unl: string[];
    bin_path: string;
    consensus: ConsensusConfig;
    npl: NplConfig;
    round_limits: RoundLimits;
    max_input_ledger_offset: number;
}

// Handles patch config manipulation.
export class PatchConfig {

    // Loads the config value if there's a patch config file. Otherwise throw error.
    getConfig(): Promise<PatchConfigData> {
        if (!fs.existsSync(constants.PATCH_CONFIG_PATH))
            throw new Error("Patch config file does not exist.");

        return new Promise((resolve, reject) => {
            fs.readFile(constants.PATCH_CONFIG_PATH, 'utf8', function (err, data) {
                if (err) reject(err);
                else resolve(JSON.parse(data) as PatchConfigData);
            });
        });
    }

    updateConfig(config: PatchConfigData): Promise<void> {
        this.validateConfig(config);

        return new Promise((resolve, reject) => {
            // Format json to match with the patch.cfg json format created by HP at the startup.
            fs.writeFile(constants.PATCH_CONFIG_PATH, JSON.stringify(config, null, 4), (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    private validateConfig(config: PatchConfigData): void {
        // Validate all config fields.
        if (!config.version)
            throw new Error("Contract version is not specified.");
        if (!config.unl || !config.unl.length)
            throw new Error("UNL list cannot be empty.");
        for (let publicKey of config.unl) {
            // Public keys are validated against length, ed prefix and hex characters.
            if (!publicKey.length)
                throw new Error("UNL public key not specified.");
            else if (!(/^(e|E)(d|D)[0-9a-fA-F]{64}$/g.test(publicKey)))
                throw new Error("Invalid UNL public key specified.");
        }
        if (!config.bin_path || !config.bin_path.length)
            throw new Error("Binary path cannot be empty.");
        if (config.consensus.mode != "public" && config.consensus.mode != "private")
            throw new Error("Invalid consensus mode configured in patch file. Valid values: public|private");
        if (config.consensus.roundtime < 1 && config.consensus.roundtime > 3600000)
            throw new Error("Round time must be between 1 and 3600000ms inclusive.");
        if (config.consensus.stage_slice < 1 || config.consensus.stage_slice > 33)
            throw new Error("Stage slice must be between 1 and 33 percent inclusive.");
        if (config.consensus.threshold < 1 || config.consensus.threshold > 100)
            throw new Error("Consensus threshold must be between 1 and 100 percent inclusive.");
        if (config.npl.mode != "public" && config.npl.mode != "private")
            throw new Error("Invalid npl mode configured in patch file. Valid values: public|private");
        if (config.round_limits.user_input_bytes < 0 || config.round_limits.user_output_bytes < 0 || config.round_limits.npl_output_bytes < 0 ||
            config.round_limits.proc_cpu_seconds < 0 || config.round_limits.proc_mem_bytes < 0 || config.round_limits.proc_ofd_count < 0)
            throw new Error("Invalid round limits.");
        if (config.max_input_ledger_offset < 0)
            throw new Error("Invalid max input ledger offset");
    }
}
