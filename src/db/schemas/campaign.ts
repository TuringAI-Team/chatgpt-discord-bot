import { DatabaseCampaign } from "../managers/campaign.js";
import { type AppDatabaseManager } from "../app.js";
import { DatabaseSchema } from "./schema.js";

export class CampaignSchema extends DatabaseSchema<DatabaseCampaign> {
    constructor(db: AppDatabaseManager) {
        super(db, {
            collection: "campaigns"
        });
    }
}