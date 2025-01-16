import { clientProtocols, controlMessages, errHandler, invokeCallback } from './common';
import { ContractContext } from './contract-context';
import { ControlChannel } from './control';
import { NplChannel } from './npl';
import { UnlCollection } from './unl';
import { UsersCollection } from './user';
import * as fs from 'fs';
import * as tty from 'tty';

interface HotPocketArgs {
    control_fd: number;
    npl_fd: number;
    user_in_fd: number;
    users: { [key: string]: [number, ...[number, number][]] };
    readonly: boolean;
    unl: { [key: string]: { active_on: number } };
    contract_id: string;
    public_key: string;
    private_key: string;
    timestamp: number;
    lcl_seq_no?: number;
    lcl_hash?: string;
}

type ContractFunction = (context: ContractContext) => void | Promise<void>;

export class HotPocketContract {
    #controlChannel: ControlChannel | null = null;
    #clientProtocol: string | null = null;
    #forceTerminate: boolean = false;

    async init(
        contractFunc: ContractFunction,
        clientProtocol: string = clientProtocols.json,
        forceTerminate: boolean = false
    ): Promise<boolean> {
        return new Promise<boolean>(resolve => {
            if (this.#controlChannel) { // Already initialized.
                resolve(false);
                return;
            }

            this.#clientProtocol = clientProtocol;

            // Check whether we are running on a console and provide error.
            if (tty.isatty(process.stdin.fd)) {
                console.error("Error: HotPocket smart contracts must be executed via HotPocket.");
                resolve(false);
                return;
            }

            this.#forceTerminate = forceTerminate;

            // Parse HotPocket args.
            fs.readFile(process.stdin.fd, 'utf8', (err, argsJson) => {
                if (err) {
                    console.error("Error reading HotPocket args:", err);
                    resolve(false);
                    return;
                }

                try {
                    const hpargs = JSON.parse(argsJson) as HotPocketArgs;
                    this.#controlChannel = new ControlChannel(hpargs.control_fd);
                    this.#executeContract(hpargs, contractFunc);
                    resolve(true);
                } catch (error) {
                    console.error("Error parsing HotPocket args:", error);
                    resolve(false);
                }
            });
        });
    }

    #executeContract(hpargs: HotPocketArgs, contractFunc: ContractFunction): void {
        // Keeps track of all the tasks (promises) that must be awaited before the termination.
        const pendingTasks: Promise<void>[] = [];
        const nplChannel = new NplChannel(hpargs.npl_fd);

        const users = new UsersCollection(hpargs.user_in_fd, hpargs.users, this.#clientProtocol ?? clientProtocols.json);
        const unl = new UnlCollection(hpargs.readonly, hpargs.unl, nplChannel, pendingTasks);
        
        if (!this.#controlChannel) {
            throw new Error("Control channel not initialized");
        }

        const executionContext = new ContractContext(hpargs, users, unl, this.#controlChannel);

        invokeCallback(contractFunc, executionContext)
            .catch(errHandler)
            .finally(() => {
                // Wait for any pending tasks added during execution.
                Promise.all(pendingTasks)
                    .catch(errHandler)
                    .finally(() => {
                        nplChannel.close();
                        this.#terminate();
                    });
            });
    }

    #terminate(): void {
        if (this.#controlChannel) {
            this.#controlChannel.close();
        }
        if (this.#forceTerminate) {
            process.kill(process.pid, 'SIGINT');
        }
    }
}
