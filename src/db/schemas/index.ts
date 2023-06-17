import { type DatabaseSchema } from "./schema.js";

import { ConversationSchema } from "./conversation.js";
import { GuildSchema } from "./guild.js";
import { ImageSchema } from "./image.js";
import { UserSchema } from "./user.js";

export type DatabaseSchemaMap = {
    users: UserSchema,
    conversations: DatabaseSchema,
    descriptions: DatabaseSchema,
    errors: DatabaseSchema,
    guilds: DatabaseSchema,
    images: DatabaseSchema,
    interactions: DatabaseSchema
}

export const DatabaseSchemas = [
    UserSchema, GuildSchema, ImageSchema, ConversationSchema
]