import { ColorResolvable } from "discord.js";

import { LoadingIndicator, LoadingIndicatorManager } from "../../db/types/indicator.js";
import { DatabaseInfo } from "../../db/managers/user.js";
import { Utils } from "../../util/utils.js";
import { Response } from "../response.js";
import { Bot } from "../../bot/bot.js";

const BasePhrases: string[] = [
    "Stealing your job",
    "Thinking"
]

interface LoadingResponseOptions {
    /** Additional phrases to choose from */
    phrases?: string[] | string;

    /** Whether generic phrases should be shown */
    generic?: boolean;

    /** Which color to use for the message */
    color?: ColorResolvable;

    /** Additional database instances & bot manager */
    db?: DatabaseInfo;
    bot: Bot;
}

export class LoadingResponse extends Response {
    constructor(options: LoadingResponseOptions) {
        super();

        /* Random phrases to display */
        const phrases: string[] = options.phrases ? Array.isArray(options.phrases) ? options.phrases : [ options.phrases ] : [];
        if (options.generic ?? true) phrases.unshift(...BasePhrases);

        let indicator: LoadingIndicator | null = options.bot && options.db
            ? LoadingIndicatorManager.getFromUser(options.bot, options.db.user)
            : null;

        this.addEmbed(builder => builder
            .setTitle(`${Utils.random(phrases)} **...** ${indicator !== null ? LoadingIndicatorManager.toString(indicator) : "🤖"}`) 
            .setColor(options.color ?? options.bot.branding.color)
        );
    }
}