import { Snowflake } from "discord.js";

import { Packet, PacketDirection, PacketSendOptions } from "../packet/packet.js";
import { TuringConnectionManager } from "../connection.js";
import { DatabaseUser } from "../../../db/schemas/user.js";

type VotePacketIncomingData = Snowflake

export class VotePacket extends Packet<VotePacketIncomingData> {
    constructor(manager: TuringConnectionManager) {
        super(manager, {
            name: "vote",
            direction: PacketDirection.Incoming
        });
    }

    public async handle(id: VotePacketIncomingData): Promise<PacketSendOptions | void> {
        /* Find the user's database entry. */
        const existing: DatabaseUser | null = await this.manager.app.db.fetchFromCacheOrDatabase("users", id);
        if (existing === null) return;

        await this.manager.app.db.queue.update("users", existing, {
            voted: new Date().toISOString()
        });
    }
}