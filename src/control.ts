import * as fs from 'fs';
import { constants, writeAsync } from './common';

type MessageCallback = (data: Buffer) => void;

export class ControlChannel {
    #fd: number;
    #readStream: fs.ReadStream | null = null;

    constructor(fd: number) {
        this.#fd = fd;
    }

    consume(onMessage: MessageCallback): void {
        if (this.#readStream) {
            throw new Error("Control channel already consumed.");
        }

        this.#readStream = fs.createReadStream('', { 
            fd: this.#fd, 
            highWaterMark: constants.MAX_SEQ_PACKET_SIZE 
        });

        this.#readStream.on("data", (data: string | Buffer) => {
            const bufferData = Buffer.isBuffer(data) ? data : Buffer.from(data);
            onMessage(bufferData);
        });

        this.#readStream.on("error", (err: Error) => {
            console.error("Control channel error:", err);
        });
    }

    async send(obj: unknown): Promise<void> {
        const buf = Buffer.from(JSON.stringify(obj));
        if (buf.length > constants.MAX_SEQ_PACKET_SIZE) {
            throw new Error(`Control message exceeds max size ${constants.MAX_SEQ_PACKET_SIZE}`);
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
