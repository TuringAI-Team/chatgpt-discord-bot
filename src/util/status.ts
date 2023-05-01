import { Bot, BotStatus } from "../bot/bot.js";
import { Utils } from "./utils.js";

import { ActivityType, Awaitable } from "discord.js";
import chalk from "chalk";
import { StatusTypeEmojiMap, StatusTypeTitleMap } from "../commands/status.js";

interface StatusMessage {
    /* Type of the status message */
    type: Exclude<ActivityType, ActivityType.Custom>;

    /* Display name of the status message */
    name: string;

    /* Template for the status message */
    template: (bot: Bot) => Awaitable<string>;
}

/* List of status messages to use */
const messages: StatusMessage[] = [
    {
        type: ActivityType.Playing,
        name: "Playing with ChatGPT",

        template: () => "with ChatGPT"
    },

    {
        type: ActivityType.Playing,
        name: "Playing with language models",

        template: () => "with LLMs"
    },

    {
        type: ActivityType.Playing,
        name: "Playing with Premium perks",

        template: () => "with Premium perks"
    },

    {
        type: ActivityType.Listening,
        name: "Listening to Conversations",

        template: async (bot: Bot) => `${bot.statistics.conversations} conversations`
    },

    {
        type: ActivityType.Watching,
        name: "Watching over Users",

        template: async (bot: Bot) => `${bot.statistics.databaseUsers} users`
    },

    {
        type: ActivityType.Watching,
        name: "Watching over Servers",

        template: async (bot: Bot) => `over ${bot.statistics.guildCount} servers`
    }
]

/**
 * Choose a random status message for the Discord bot.
 */
export const chooseStatusMessage = async (bot: Bot): Promise<void> => {
    /* Get the current status of the bot. */
    const status: BotStatus = await bot.status();

    /* The bot is under maintenance */
    if (status.type === "maintenance") {
        return void bot.client.user!.setPresence({
            status: "dnd",

            activities: [ {
                type: ActivityType.Playing,
                name: `🛠️ ${status.notice ?? "Under maintenance"}`
            } ]
        });

    /* The bot is at another status, but not fully operational */
    } else if (status.type !== "operational") {
        return void bot.client.user!.setPresence({
            status: "idle",

            activities: [ {
                type: ActivityType.Playing,
                name: `${StatusTypeEmojiMap[status.type]} ${status.notice ?? StatusTypeTitleMap[status.type]}`
            } ]
        });
    }

    /* Choose a random status message. */
    const message: StatusMessage = Utils.random(messages);
    let result: string | null = null;

    /* Try to execute the template of the status message. */
    try {
        result = await message.template(bot);
    } catch (error) {
        return void bot.logger.error(`Failed to use status template ${chalk.bold(message.name)} -> ${(error as Error).message}`);
    }

    /* Update the bot's activity & status. */
    bot.client.user!.setPresence({
        status: "online",

        activities: [ {
            type: message.type,
            name: `${result!} » @${bot.client.user!.username}`
        } ]
    });
}