import { InteractionResponse, Message } from "discord.js";
import words from "random-words";

import { Response, ResponseSendClass } from "../command/response.js";
import { Bot } from "../bot/bot.js";

export interface ErrorHandlingOptions {
    error: Error | unknown;
    notice?: string;
    original?: ResponseSendClass;
    title?: string;
    raw?: boolean;
    partial?: boolean;
}

export interface DatabaseError {
    /* Identifier of the error */
    id: string;

    /* When the error occurred */
    when: string;

    /* Base class of the error */
    class: string;

    /* The error message itself */
    message: string;

    /* The stack trace of the error */
    stack: string;
}

export class ErrorManager {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    /**
     * Build a formatted reply for the original invocation, to be shown to the users.
     */
    public build(options: ErrorHandlingOptions & Required<Pick<ErrorHandlingOptions, "notice">> & { db: DatabaseError }): Response {
        const response: Response = new Response();
        
        response.addEmbed(builder => builder
            .setTitle("Uh-oh... 😬")
            .setDescription(`${options.notice}${!options.partial ? ` *The developers have been notified*.` : ""}`)
            .setFooter({ text: `discord.gg/${this.bot.app.config.discord.inviteCode} • ${options.db.id}` })
            .setColor(options.partial ? "Orange" : "Red")
        );

        response.setEphemeral(true);
        return response;
    }

    public async handle(options: ErrorHandlingOptions & Required<Pick<ErrorHandlingOptions, "notice" | "original">>): Promise<Message | InteractionResponse | null>;
    public async handle(options: ErrorHandlingOptions & Required<Pick<ErrorHandlingOptions, "raw">>): Promise<DatabaseError>;
    public async handle(options: ErrorHandlingOptions & Required<Pick<ErrorHandlingOptions, "notice">>): Promise<Response>;
    public async handle(options: ErrorHandlingOptions): Promise<void>;

    public async handle(options: ErrorHandlingOptions): Promise<Message | InteractionResponse | Response | DatabaseError | null | void> {
        const { error, title, notice, original, raw } = options;        
        const channel = await this.bot.moderation.channel("error");

        /* Add the error to the database. */
        const db: DatabaseError = await this.addToDatabase(options);

        /* Formatted & display error + stack trace */
        const formatted: string = this.formattedResponse(db);

        const response = new Response()
            .addEmbed(builder => builder
                .setTitle("An error occurred ⚠️")
                .setDescription(`${title !== undefined ? `*${title}*\n\n` : ""}${formatted}`)
                .setFooter({ text: `${db.id} • Cluster #${this.bot.data.id + 1}` })
                .setTimestamp()
                .setColor("Red")
            );

        /* Send the error message to the logging channel. */
        await response.send(channel);

        /* Build a formatted response for the user, if requested. */
        if (notice && original) {
            const response = this.build({ error, title, notice, original, db });
            return await response.send(original);

        } else if (notice) {
            return this.build({ error, title, notice, db });
            
        } else if (raw) {
            return db;
        }
    }

    /**
     * Add the given occurred error to the database.
     * @param options Error options
     * 
     * @returns The error, added to the database
     */
    private async addToDatabase(options: ErrorHandlingOptions): Promise<DatabaseError> {
        const error: Error = options.error as Error;

        /* Unique identifier for this error */
        const id: string = this.generateIdentifier();

        const data: DatabaseError = {
            class: error.name, id,
            when: new Date().toISOString(),
            message: this.formatMessage(error),
            stack: this.formatStacktrace(error)
        };

        /* Add the error data to the database. */
        await this.bot.db.users.updateError(data);

        return data;
    }

    /**
     * Generate a unique error identifier.
     */
    private generateIdentifier(): string {
        return (words as any)({
            join: "-", exactly: 4
        });
    }

    public formattedResponse(db: DatabaseError): string {
        return `
\`\`\`
${db.class} -> ${db.message}

${db.stack}
\`\`\``.trim();
    }

    private formatMessage(error: Error): string {
        return error.message;
    }

    private formatStacktrace(error: Error): string {
        const stack: string = error.stack!
            .split("\n").slice(1)
            .map(l => l.trim()).join("\n");

        return stack;
    }
}