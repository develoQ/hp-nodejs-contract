import { constants, writeAsync } from './common';
import * as fs from 'fs';

type MessageCallback = (publicKey: string, data: Buffer) => void;

// Represents the node-party-line that can be used to communicate with unl nodes.
export class NplChannel {
    #fd: number;
    #readStream: fs.ReadStream | null = null;

    constructor(fd: number) {
        this.#fd = fd;
    }

    consume(onMessage: MessageCallback): void {
        if (this.#readStream) {
            throw new Error("NPL channel already consumed.");
        }

        this.#readStream = fs.createReadStream('', { 
            fd: this.#fd, 
            highWaterMark: constants.MAX_SEQ_PACKET_SIZE 
        });

        // When hotpocket is sending the npl messages, first it sends the public key of the particular node
        // and then the message, First data buffer is taken as public key and the second one as message,
        // then npl message object is constructed and the event is emmited.
        let publicKey: string | null = null;

        this.#readStream.on("data", (data: string | Buffer) => {
            const bufferData = Buffer.isBuffer(data) ? data : Buffer.from(data);
            if (!publicKey) {
                publicKey = bufferData.toString();
            }
            else {
                onMessage(publicKey, bufferData);
                publicKey = null;
            }
        });

        this.#readStream.on("error", (err: Error) => {
            console.error("NPL read stream error:", err);
        });
    }

    async send(msg: string | Buffer): Promise<void> {
        const buf = Buffer.isBuffer(msg) ? msg : Buffer.from(msg);
        if (buf.length > constants.MAX_SEQ_PACKET_SIZE) {
            throw new Error(`NPL message exceeds max size ${constants.MAX_SEQ_PACKET_SIZE}`);
        }
        await writeAsync(this.#fd, buf);
    }

    close(): void {
        if (this.#readStream) {
            this.#readStream.destroy();
            this.#readStream = null;
        }
    }
}
