import { Packet, PacketDirection, PacketSendOptions } from "../packet/packet.js";
import { DatabaseCollectionType } from "../../../db/manager.js";
import { TuringConnectionManager } from "../connection.js";

interface UpdatePacketIncomingData {
    /** Name of the collection to update */
    collection: DatabaseCollectionType;

    /* ID of the entry to update */
    id: string;

    /* Updates to apply */
    updates: Record<string, any>;
}

export class UpdatePacket extends Packet<UpdatePacketIncomingData> {
    constructor(manager: TuringConnectionManager) {
        super(manager, {
            name: "update",
            direction: PacketDirection.Incoming
        });
    }

    public async handle({ collection, id, updates }: UpdatePacketIncomingData): Promise<PacketSendOptions | void> {
        /* Make sure that the entry exists, before updating it. */
        const existing = await this.manager.app.db.fetchFromCacheOrDatabase(collection, id);
        if (existing === null) return;

        await this.manager.app.db.queue.update(collection, existing, updates);
    }
}