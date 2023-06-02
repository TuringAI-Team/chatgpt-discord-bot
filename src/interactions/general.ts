import { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";

import { InteractionHandler, InteractionHandlerBuilder, InteractionHandlerResponse, InteractionHandlerRunOptions, InteractionType } from "../interaction/handler.js";
import { ErrorResponse, ErrorType } from "../command/response/error.js";
import { Introduction } from "../util/introduction.js";
import { Response } from "../command/response.js";
import { Bot } from "../bot/bot.js";

type GeneralInteractionAction = "delete" | "vote" | "docs"  

export interface GeneralInteractionHandlerData {
    /* Which action to perform */
    action: GeneralInteractionAction;

    /* Original author, the only user who can perform this action */
    id: string | null;
}

export class GeneralInteractionHandler extends InteractionHandler<ButtonInteraction | StringSelectMenuInteraction, GeneralInteractionHandlerData> {
    constructor(bot: Bot) {
        super(
            bot,
            
            new InteractionHandlerBuilder()
                .setName("general")
                .setDescription("Various useful interaction options")
                .setType([ InteractionType.Button ]),

            {
                action: "string",
                id: "string?"
            }
        );
    }

    public async run({ data, interaction, db }: InteractionHandlerRunOptions<ButtonInteraction | StringSelectMenuInteraction, GeneralInteractionHandlerData>): InteractionHandlerResponse {
        if (data.id !== null && db.user.id !== data.id) return void await interaction.deferUpdate();

        if (data.action === "delete") {
            await interaction.message.delete();

        } else if (data.action === "vote") {
			/* When the user already voted for the bot, if applicable */
			const when: number | null = this.bot.db.users.voted(db.user);

			if (when !== null) return new Response()
                .addEmbed(builder => builder
                    .setDescription(`You have already voted for the bot <t:${Math.round(when / 1000)}:R>, thank you for your support! 🎉`)
                    .setColor(this.bot.branding.color)
                )
                .setEphemeral(true);

			await interaction.deferReply({
				ephemeral: true
			});

			try {
				/* Try to check whether the user voted for the bot using the top.gg API. */
				const voted: boolean = await this.bot.vote.voted(interaction.user, db.user);

				if (!voted) return new ErrorResponse({
					interaction, message: "You haven't voted for the bot yet", emoji: "😕"
				});
				

				return new Response()
					.addEmbed(builder => builder
						.setDescription(`Thank you for voting for the bot! 🎉`)
						.setColor(this.bot.branding.color)
					)
					.setEphemeral(true);

			} catch (error) {
				await this.bot.moderation.error({
					error, title: "Failed to check whether the user has voted"
				});

				return new ErrorResponse({
					interaction, type: ErrorType.Error, message: "It seems like something went wrong while trying to check whether you've voted for the bot."
				});
			}

        } else if (data.action === "docs" && interaction instanceof StringSelectMenuInteraction) {
            return Introduction.handleInteraction(this.bot, interaction);
        }
    }
}