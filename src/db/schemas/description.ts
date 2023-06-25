import { DatabaseDescription } from "../../image/description.js";
import { ChatInput } from "../../conversation/conversation.js";
import { ResponseMessage } from "../../chat/types/message.js";
import { ChatOutputImage } from "../../chat/types/image.js";
import { type AppDatabaseManager } from "../app.js";
import { DatabaseSchema } from "./schema.js";

export class DescriptionSchema extends DatabaseSchema<DatabaseDescription> {
    constructor(db: AppDatabaseManager) {
        super(db, {
            collection: "descriptions"
        });
    }
}