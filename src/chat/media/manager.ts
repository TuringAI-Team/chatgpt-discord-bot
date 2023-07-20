import { Collection } from "discord.js";

import { ChatMediaHandler, ChatMediaHandlerHasOptions, ChatMediaHandlerRunOptions } from "./handler.js";
import { ChatMedia, ChatMediaType } from "./types/media.js";
import { ImageChatHandler } from "./handlers/image.js";
import { Utils } from "../../util/utils.js";
import { ChatClient } from "../client.js";

export class ChatMediaManager {
    private readonly client: ChatClient;

    /* Collection of all media handlers */
    private readonly handlers: Collection<ChatMediaType, ChatMediaHandler>;

    constructor(client: ChatClient) {
        this.client = client;
        this.handlers = new Collection();
    }

    public async setup(): Promise<void> {
		return new Promise((resolve, reject) => {
			Utils.search("./build/chat/media/handlers")
				.then(async (files: string[]) => {
					await Promise.all(files.map(async path => {
						await import(path)
							.then((data: { [key: string]: any }) => {
								const list = Object.values(data).filter(data => data.name);

								for (const data of list) {
									const instance: ChatMediaHandler = new (data as any)(this.client);
                                    this.handlers.set(instance.settings.type, instance);
								}
							})
							.catch(reject);
					}));

					resolve();
				})
				.catch(reject);
		});
    }

    public get all(): ChatMediaHandler[] {
        return Array.from(this.handlers.values());
    }

    public get image(): ImageChatHandler {
        return this.get(ChatMediaType.Images);
    }

    public get<T extends ChatMediaHandler>(type: ChatMediaType): T {
        const handler: T | null = this.handlers.get(type) as T ?? null;
        if (handler === null) throw new Error(`Couldn't find handler "${type}"`);

        return handler;
    }

    /**
     * Check whether the given message has any media attachments.
     * @param options Media run options
     */
    public async has(options: ChatMediaHandlerHasOptions): Promise<ChatMediaType[]> {
        const types: ChatMediaType[] = [];

        for (const handler of this.all) {
            const has: boolean = await handler.has(options);
            if (has) types.push(handler.settings.type);
        }

        return types;
    }

    /**
     * Get a list of additional system instructions to apply, given these media attachments.
     * @returns List of system prompts to add
     */
    public initialPrompts(media: ChatMedia[]): string[] {
        const prompts: string[] = [];

        for (const handler of this.all) {
            if (media.some(m => m.id === handler.settings.type)) {
                const initial = handler.initialPrompt().trim();
                prompts.push(initial);
            }
        }

        return prompts;
    }

    public prompts(media: ChatMedia[]): string[] {
        const prompts: string[] = [];

        for (const m of media) {
            const handler = this.get(m.id);
            prompts.push(handler.prompt(m));
        }

        return prompts;
    }

    public async run(options: ChatMediaHandlerRunOptions): Promise<ChatMedia[]> {
        /* All of the final media attachments */
        const media: ChatMedia[] = [];

        for (const handler of this.all) {
            /* Notice message to display */
            const notice: string = Array.isArray(handler.settings.message)
                ? Utils.random(handler.settings.message) : handler.settings.message;

            try {
                /* Make sure that the message actually has media of this type attached. */
                const exists = await handler.has(options);
                if (!exists) continue;

                await this.client.manager.progress.notice(options, {
                    text: notice
                });

                /* Then, actually run the handler to extract all media attachments from the message. */
                const results = await handler.run(options);

                media.push(...results.map(r => ({
                    ...r, id: handler.settings.type
                })));
            
            } catch (error) {
                await this.client.manager.bot.error.handle({
                    error, notice: `Failed to extract media \`${handler.settings.type}\``
                })

                await this.client.manager.progress.notice(options, {
                    text: `Something went wrong while trying to extract ${handler.settings.type}`
                });
            }
        }

        return media;
    }
}