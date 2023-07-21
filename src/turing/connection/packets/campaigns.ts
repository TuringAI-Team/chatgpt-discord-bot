import { Packet, PacketDirection, PacketSendOptions } from "../packet/packet.js";
import { DatabaseCampaign } from "../../../db/managers/campaign.js";
import { TuringConnectionManager } from "../connection.js";

type CampaignsPacketIncomingData = {
    action: "incrementStats";
    id: string;
} & Record<string, any>

export class UpdatePacket extends Packet<CampaignsPacketIncomingData> {
    constructor(manager: TuringConnectionManager) {
        super(manager, {
            name: "campaigns",
            direction: PacketDirection.Incoming
        });
    }

    public async handle(data: CampaignsPacketIncomingData): Promise<PacketSendOptions | void> {
        const { action, id } = data;

        if (action === "incrementStats") {
            /* Which statistics to increment */
            const type: "views" | "clicks" = data.type;

            /* The location of the user, optional */
            const location: string | null = data.geo ?? null;

            /* Make sure that the campaign exists, before updating it. */
            const campaign: DatabaseCampaign | null = await this.manager.app.db.fetchFromCacheOrDatabase("campaigns", id);
            if (campaign === null) return;

            /* Updated total amount of statistics of this type */
            const total: number = campaign.stats[type].total + 1;

            this.manager.app.db.metrics.change("campaigns", {
                [type]: {
                    total: { [campaign.name]: total },
                    now: { [campaign.name]: "+1" }
                }
            });

            await this.manager.app.db.campaign.update(campaign, {
                stats: {
                    ...campaign.stats,

                    [type]: {
                        total, geo: {
                            ...campaign.stats[type].geo,

                            ...location !== null ? {
                                [location]: campaign.stats[type]?.geo[location] + 1 ?? 1
                            } : {}
                        }
                    }
                }
            });
        }
    }
}