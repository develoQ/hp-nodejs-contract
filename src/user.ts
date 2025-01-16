import { clientProtocols, readAsync, writevAsync } from "./common";

type UserInput = [number, number]; // [offset, size] tuple
type UsersObject = { [key: string]: [number, ...UserInput[]] }; // [outfd, ...inputs]

export class UsersCollection {
    #users: { [key: string]: User } = {};
    #infd: number;

    constructor(userInputsFd: number, usersObj: UsersObject, clientProtocol: string) {
        this.#infd = userInputsFd;

        Object.entries(usersObj).forEach(([publicKey, arr]) => {
            const outfd = arr[0]; // First array element is the output fd.
            arr.splice(0, 1); // Remove first element (output fd). The rest are pairs of msg offset/length tuples.

            const channel = new UserChannel(outfd, clientProtocol);
            this.#users[publicKey] = new User(publicKey, channel, arr.slice() as UserInput[]);
        });
    }

    // Returns the User for the specified public key. Returns undefined if not found.
    find(publicKey: string): User | undefined {
        return this.#users[publicKey];
    }

    // Returns all the currently connected users.
    list(): User[] {
        return Object.values(this.#users);
    }

    count(): number {
        return Object.keys(this.#users).length;
    }

    async read(input: UserInput): Promise<Buffer> {
        const [offset, size] = input;
        const buf = Buffer.alloc(size);
        await readAsync(this.#infd, buf, offset, size);
        return buf;
    }
}

export class User {
    readonly publicKey: string;
    readonly inputs: UserInput[];
    #channel: UserChannel;

    constructor(publicKey: string, channel: UserChannel, inputs: UserInput[]) {
        this.publicKey = publicKey;
        this.inputs = inputs;
        this.#channel = channel;
    }

    async send(msg: string | Buffer | object): Promise<void> {
        await this.#channel.send(msg);
    }
}

export class UserChannel {
    #outfd: number;
    #clientProtocol: string;

    constructor(outfd: number, clientProtocol: string) {
        this.#outfd = outfd;
        this.#clientProtocol = clientProtocol;
    }

    async send(msg: string | Buffer | object): Promise<void> {
        const messageBuf = this.serialize(msg);
        const headerBuf = Buffer.alloc(4);
        // Writing message length in big endian format.
        headerBuf.writeUInt32BE(messageBuf.byteLength);
        await writevAsync(this.#outfd, [headerBuf, messageBuf]);
    }

    private serialize(msg: string | Buffer | object): Buffer {
        if (!msg)
            throw new Error("Cannot serialize null content.");

        if (Buffer.isBuffer(msg))
            return msg;
        else if (this.#clientProtocol === clientProtocols.bson)
            return Buffer.from(msg as string);
        else // json
            return Buffer.from(JSON.stringify(msg));
    }
}
