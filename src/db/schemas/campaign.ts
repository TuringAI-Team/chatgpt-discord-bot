import { DatabaseCampaign } from "../managers/campaign.js";
import { type AppDatabaseManager } from "../app.js";
import { DatabaseSchema } from "./schema.js";

export class CampaignSchema extends DatabaseSchema<DatabaseCampaign> {
    constructor(db: AppDatabaseManager) {
        super(db, {
            collection: "campaigns"
        });
    }

    public async process(campaign: DatabaseCampaign): Promise<DatabaseCampaign> {
        campaign.budget = typeof campaign.budget === "object" ? campaign.budget : { total: 5, used: 0, type: "click", cost: 5 };
        campaign.logs = Array.isArray(campaign.logs) ? campaign.logs : [];
        
        return campaign;
    }
}