import { ActivityType, Awaitable } from "discord.js";
import chalk from "chalk";

import { StatusTypeEmojiMap, StatusTypeTitleMap } from "../commands/status.js";
import { Bot, BotStatus } from "../bot/bot.js";
import { Utils } from "./utils.js";

interface StatusMessage {
    /* Type of the status message */
    type: Exclude<ActivityType, ActivityType.Custom>;

    /* Display name of the status message */
    name: string;

    /* Condition, which checks whether this status message can be displayed */
    condition?: (bot: Bot) => boolean;

    /* Template for the status message */
    template: (bot: Bot) => Awaitable<string>;
}

/* List of status messages to use */
const StatusMessages: StatusMessage[] = [
    {
        name: "Playing with ChatGPT",
        type: ActivityType.Playing,

        template: () => "with ChatGPT"
    },

    {
        name: "Playing with language models",
        type: ActivityType.Playing,

        template: () => "with AIs"
    },

    {
        name: "Playing with Premium perks",
        type: ActivityType.Playing,

        template: () => "with Premium perks"
    },

    {
        name: "Listening to Conversations",
        type: ActivityType.Listening,

        condition: bot => bot.statistics.conversations > 0,
        template: async (bot: Bot) => `${new Intl.NumberFormat("en-US").format(bot.statistics.conversations)} conversations`
    },

    {
        name: "Watching over Users",
        type: ActivityType.Watching,

        condition: bot => bot.statistics.databaseUsers > 0,
        template: async (bot: Bot) => `${new Intl.NumberFormat("en-US").format(bot.statistics.databaseUsers)} users`
    },

    {
        name: "Watching over Servers",
        type: ActivityType.Watching,

        condition: bot => bot.statistics.guildCount > 0,
        template: async (bot: Bot) => `over ${new Intl.NumberFormat("en-US").format(bot.statistics.guildCount)} servers`
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
        return void bot.client.user.setPresence({
            status: "dnd",

            activities: [ {
                type: ActivityType.Playing,
                name: `🛠️ ${status.notice ?? "Under maintenance"}`
            } ]
        });

    /* The bot is at another status, but not fully operational */
    } else if (status.type !== "operational") {
        return void bot.client.user.setPresence({
            status: "idle",

            activities: [ {
                type: ActivityType.Playing,
                name: `${StatusTypeEmojiMap[status.type]} ${status.notice ?? StatusTypeTitleMap[status.type]}`
            } ]
        });
    }

    /* Filter out all applicable status messages. */
    const usable: StatusMessage[] = StatusMessages.filter(message => message.condition ? message.condition(bot) : true);
    if (usable.length === 0) return;

    /* Choose a random status message. */
    const message: StatusMessage = Utils.random(usable);
    let result: string | null = null;

    /* Try to execute the template of the status message. */
    try {
        result = await message.template(bot);
    } catch (error) {
        return bot.logger.error(`Failed to use status template ${chalk.bold(message.name)} -> ${(error as Error).message}`);
    }

    /* Update the bot's activity & status. */
    bot.client.user.setPresence({
        status: "online",

        activities: [ {
            type: message.type,
            name: `${result!} » @${bot.client.user.username}`
        } ]
    });
}