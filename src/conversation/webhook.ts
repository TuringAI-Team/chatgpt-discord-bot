import { APIMessage, BaseGuildTextChannel, DiscordAPIError, Message, Routes, WebhookMessageCreateOptions, WebhookMessageEditOptions } from "discord.js";

import { DatabaseGuild } from "../db/managers/user.js";
import { Bot } from "../bot/bot.js";

type WebhookChannel = BaseGuildTextChannel

interface Webhook {
    token: string;
    id: string;
}

export class WebhookManager {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    public mode(db?: DatabaseGuild | null): "noAds" | "on" | "off" {
        if (!db) return "off";
        return this.bot.db.settings.get(db, "character:mode");
    }

    public base(db: DatabaseGuild): Pick<WebhookMessageCreateOptions, "avatarURL" | "username"> {
        const name: string = this.bot.db.settings.get(db, "character:name");
        const avatarURL: string = this.bot.db.settings.get(db, "character:avatar");

        return {
            avatarURL: avatarURL.length > 0 ? avatarURL : undefined,
            username: name
        };
    }

    public async send(channel: WebhookChannel, webhook: Webhook, data: WebhookMessageCreateOptions): Promise<Message> {
        try {
            const raw: APIMessage = await this.bot.client.rest.post(`${Routes.webhook(webhook.id, webhook.token)}?wait=true`, {
                body: {
                    ...data, avatar_url: data.avatarURL
                }, auth: false
            }) as APIMessage;

            return await channel.messages.fetch(raw.id);

        } catch (raw) {
            const error: DiscordAPIError = raw as DiscordAPIError;

            /* If the webhook doesn't exist anymore, delete it from the cache too. */
            if (error.status === 404) await this.bot.db.cache.delete("webhooks", channel.id);
            throw error;
        }
    }

    public async edit(channel: WebhookChannel, message: Message, webhook: Webhook, data: WebhookMessageEditOptions): Promise<Message> {
        try {
            const raw: APIMessage = await this.bot.client.rest.patch(`${Routes.webhookMessage(webhook.id, webhook.token, message.id)}?wait=true`, {
                body: {
                    ...data
                }, auth: false
            }) as APIMessage;

            return await channel.messages.fetch(raw.id);

        } catch (raw) {
            const error: DiscordAPIError = raw as DiscordAPIError;

            /* If the webhook doesn't exist anymore, delete it from the cache too. */
            if (error.status === 404) await this.bot.db.cache.delete("webhooks", webhook.id);
            throw error;
        }
    }
    
    public async fetch(channel: WebhookChannel): Promise<Webhook> {
        const existing: Webhook | null = await this.get(channel);
        if (existing !== null) return existing;

        return await this.create(channel);
    }

    private async get(channel: WebhookChannel): Promise<Webhook | null> {
        /* The webhook name */
        const name = this.webhookName(channel);

        /* Try to find the webhook in the cache first. */
        const cached: Webhook | null = await this.bot.db.cache.get("webhooks", channel.id);
        if (cached !== null) return cached;

        /* All webhooks on the guild */
        const all = Array.from(
            (await channel.guild.fetchWebhooks()).values()
        );

        /* Find the existing webhook, if available. */
        const found = all.find(w => w.channelId === channel.id && w.name === name && w.token !== null) ?? null;
        if (found === null) return null;

        const result: Webhook = {
            token: found.token!,
            id: found.id
        };

        await this.bot.db.cache.set("webhooks", channel.id, result);
        return result;
    }

    private async create(channel: WebhookChannel): Promise<Webhook> {
        const webhook = await channel.createWebhook({
            name: this.webhookName(channel), reason: "Custom character webhook for the bot"
        });

        const data: Webhook = {
            token: webhook.token!,
            id: webhook.id
        };

        await this.bot.db.cache.set("webhooks", channel.id, data);
        return data;
    }

    public webhookName(channel: WebhookChannel): string {
        return `${this.bot.client.user.username} - Custom Character`;
    }
}