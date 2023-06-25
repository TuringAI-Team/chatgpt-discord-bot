import { ChatInput } from "../../conversation/conversation.js";
import { ResponseMessage } from "../../chat/types/message.js";
import { ChatOutputImage } from "../../chat/types/image.js";
import { type AppDatabaseManager } from "../app.js";
import { DatabaseSchema } from "./schema.js";

export type DatabaseOutputImage = Omit<ChatOutputImage, "data"> & {
    data: string;
} 

export type DatabaseResponseMessage = Pick<ResponseMessage, "raw" | "text" | "type"> & {
    images?: DatabaseOutputImage[];
}

export interface DatabaseConversationMessage {
    id: string;

    output: DatabaseResponseMessage;
    input: ChatInput;
}

export interface DatabaseConversation {
    created: string;
    id: string;
    active: boolean;
    history: DatabaseConversationMessage[] | null;
}

export interface DatabaseMessage {
    id: string;
    requestedAt: string;
    completedAt: string;
    input: ChatInput;
    output: DatabaseResponseMessage;
    tone: string;
    model: string;
}

export class ConversationSchema extends DatabaseSchema<DatabaseConversation> {
    constructor(db: AppDatabaseManager) {
        super(db, {
            collection: "conversations"
        });
    }
}