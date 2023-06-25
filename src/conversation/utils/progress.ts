import { MessageType, PartialResponseMessage, ResponseChatNoticeMessage, ResponseMessage, ResponseNoticeMessage } from "../../chat/types/message.js";
import { ConversationManager } from "../manager.js";

interface ProgressLikeClass<T extends ResponseMessage = ResponseMessage> {
    progress?: (message: T) => Promise<void> | void;
}

type PartialOrFull<T extends ResponseMessage = ResponseMessage> = T | PartialResponseMessage<T>

export class ProgressManager {
    private readonly manager: ConversationManager;

    constructor(manager: ConversationManager) {
        this.manager = manager;
    }

    public build<T extends ResponseMessage>(message: T | PartialResponseMessage<T>): T {
        const full: T = {
            type: message.type ?? MessageType.Chat,
            ...message
        } as T;

        return full;
    }

    public async send<T extends ResponseMessage>(options: ProgressLikeClass | null, message: T | PartialResponseMessage<T>): Promise<T> {
        /* Construct the full message. */
        const full: T = this.build(message);

        /* If no progress() callback was actually given, just return the final data. */
        if (!options || !options.progress) return full;

        try {
            await options.progress(full);
        } catch (_) {}

        return full;
    }

    public async notice(options: ProgressLikeClass | null, message: PartialOrFull<ResponseNoticeMessage>): Promise<ResponseNoticeMessage> {
        return this.send(options, {
            ...message, type: MessageType.Notice
        });
    }

    public async chatNotice(options: ProgressLikeClass | null, message: PartialOrFull<ResponseChatNoticeMessage>): Promise<ResponseChatNoticeMessage> {
        return this.send(options, {
            ...message, type: MessageType.ChatNotice
        } as any);
    }
}