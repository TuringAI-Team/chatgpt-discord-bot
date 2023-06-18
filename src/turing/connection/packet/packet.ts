import { TuringConnectionManager } from "../connection.js";

/* All packet names */
export type PacketName = "cache" | "update" | "vote"

/* Which types can be used for incoming packet data */
export type PacketData = any

/* In which direction packets go */
export enum PacketDirection {
    /* API -> bot */
    Incoming,

    /* Bot -> API */
    Outgoing,

    /* API <-> bot */
    Both
}

interface PacketOptions {
    /** Name of the packet */
    name: PacketName;

    /** In which direction this packet goes (default PacketDirection.Both) */
    direction?: PacketDirection;
}

export interface PacketSendOptions {
    /** Name of the packet to send */
    name: PacketName;

    /** Data to send */
    data: any;
}

export interface RawPacketData {
    /** Name of the packet */
    id: PacketName;

    /** Request data, if applicable */
    data: PacketData | null;
}

export interface PacketMetadata {
    /* ID of the packet */
    id: number;
}

export class Packet<IncomingData extends PacketData = PacketData, OutgoingOptions extends PacketData = PacketData, OutgoingData extends PacketData = PacketData> {
    protected readonly manager: TuringConnectionManager;

    /* Various settings about the packet */
    public readonly options: Required<PacketOptions>;

    constructor(manager: TuringConnectionManager, options: PacketOptions) {
        this.manager = manager;

        this.options = {
            direction: PacketDirection.Both,
            ...options
        };
    }

    /**
     * Handle an incoming type of this message.
     * You can optionally return a packet to reply to the original message.
     */
    public async handle(data: IncomingData, metadata: PacketMetadata): Promise<PacketSendOptions | void> {
        /* Stub */
    }
    
    public async send(data: OutgoingOptions): Promise<OutgoingData> {
        /* Stub */
        return data as unknown as OutgoingData;
    }
}