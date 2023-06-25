import { type DatabaseSchema } from "./schema.js";

import { ConversationSchema } from "./conversation.js";
import { DescriptionSchema } from "./description.js";
import { CampaignSchema } from "./campaign.js";
import { ErrorSchema } from "./error.js";
import { GuildSchema } from "./guild.js";
import { ImageSchema } from "./image.js";
import { UserSchema } from "./user.js";

export type DatabaseSchemaMap = {
    users: UserSchema,
    conversations: ConversationSchema,
    descriptions: DescriptionSchema,
    errors: ErrorSchema,
    guilds: GuildSchema,
    images: ImageSchema,
    interactions: DatabaseSchema,
    campaigns: CampaignSchema
}

export const DatabaseSchemas = [
    UserSchema, GuildSchema, ImageSchema, ConversationSchema, DescriptionSchema, ErrorSchema, CampaignSchema
]