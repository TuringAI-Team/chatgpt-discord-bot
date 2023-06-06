import { InteractionResponse, Message } from "discord.js";

import { ErrorResponse, ErrorType } from "../command/response/error.js";
import { Response, ResponseSendClass } from "../command/response.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

export interface ErrorHandlingOptions {
    error: Error | unknown;
    notice?: string;
    original?: ResponseSendClass;
    title?: string;
}

export class ErrorManager {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    /**
     * Build a formatted reply for the original invocation, to be shown to the users.
     */
    public build(options: ErrorHandlingOptions & Required<Pick<ErrorHandlingOptions, "notice">>): Response {
        return new ErrorResponse({
            message: options.notice, type: ErrorType.Error
        });
    }

    public async handle(options: ErrorHandlingOptions & Required<Pick<ErrorHandlingOptions, "notice" | "original">>): Promise<Message | InteractionResponse | null>;
    public async handle(options: ErrorHandlingOptions & Required<Pick<ErrorHandlingOptions, "notice">>): Promise<Response>;
    public async handle(options: ErrorHandlingOptions): Promise<void>;

    public async handle({ error: err, title, notice, original }: ErrorHandlingOptions): Promise<Message | InteractionResponse | Response | null | void> {
        /* Get the moderation channel. */
        const channel = await this.bot.moderation.channel("error");

        /* The actual error that occured */
        const error: Error = err as Error;

        /* Formatted & display error + stack trace */
        const formatted: string = this.formatStacktrace(error);

        const response = new Response()
            .addEmbed(builder => builder
                .setTitle("An error occurred ⚠️")
                .setDescription(`${title !== undefined ? `*${title}*\n\n` : ""}${formatted}`)
                .setFooter({ text: `Cluster #${this.bot.data.id + 1}` })
                .setTimestamp()
                .setColor("Red")
            );

        /* Send the error message to the logging channel. */
        await response.send(channel);

        /* Build a formatted response for the user, if requested. */
        if (notice && original) {
            const response = this.build({ error: err, title, notice, original });
            return await response.send(original);
        } else if (notice) {
            return this.build({ error: err, title, notice });
        }
    }

    private formatStacktrace(error: Error): string {
        const stack: string = error.stack!.split("\n").slice(1).join("\n");
        return `
\`\`\`
${Utils.truncate(error.toString(), 300)}

${stack}
\`\`\``.trim();
    }
}