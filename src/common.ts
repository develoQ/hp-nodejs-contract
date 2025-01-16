import * as fs from 'fs';

export const controlMessages = {
    peerChangeset: "peer_changeset"
} as const;

export const clientProtocols = {
    json: "json",
    bson: "bson"
} as const;

export const constants = {
    MAX_SEQ_PACKET_SIZE: 128 * 1024,
    PATCH_CONFIG_PATH: "../patch.cfg",
    POST_EXEC_SCRIPT_NAME: "post_exec.sh"
} as const;

export type ControlMessages = typeof controlMessages[keyof typeof controlMessages];
export type ClientProtocols = typeof clientProtocols[keyof typeof clientProtocols];

export function writeAsync(fd: number, buf: Buffer): Promise<{ bytesWritten: number; buffer: Buffer }> {
    return new Promise((resolve) => {
        fs.write(fd, buf, (err, bytesWritten, buffer) => {
            if (err) throw err;
            resolve({ bytesWritten, buffer });
        });
    });
}

export function writevAsync(fd: number, bufList: Buffer[]): Promise<{ bytesWritten: number; buffers: ArrayBufferView[] }> {
    return new Promise((resolve) => {
        fs.writev(fd, bufList, (err, bytesWritten, buffers) => {
            if (err) throw err;
            resolve({ bytesWritten, buffers });
        });
    });
}

export function readAsync(fd: number, buf: Buffer, offset: number, size: number): Promise<{ bytesRead: number; buffer: Buffer }> {
    return new Promise((resolve) => {
        fs.read(fd, buf, 0, size, offset, (err, bytesRead, buffer) => {
            if (err) throw err;
            resolve({ bytesRead, buffer });
        });
    });
}

type CallbackFunction<TArgs extends any[] = any[]> = 
    | ((...args: TArgs) => void) 
    | ((...args: TArgs) => Promise<void>);

export async function invokeCallback<TArgs extends any[]>(
    callback: CallbackFunction<TArgs> | undefined,
    ...args: TArgs
): Promise<void> {
    if (!callback)
        return;

    try {
        if (callback.constructor.name === 'AsyncFunction') {
            await (callback(...args) as Promise<void>);
        } else {
            callback(...args);
        }
    } catch (error) {
        errHandler(error instanceof Error ? error : new Error(String(error)));
    }
}

export function errHandler(err: Error): void {
    console.log(err);
}
