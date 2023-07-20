import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder } from "discord.js";

import { InteractionHandler, InteractionHandlerBuilder, InteractionHandlerResponse, InteractionHandlerRunOptions, InteractionType } from "../interaction/handler.js";
import { Response } from "../command/response.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

interface PremiumInteractionHandlerData {
    action: "overview" | "ads" | "purchase";
}

export class PremiumInteractionHandler extends InteractionHandler<ButtonInteraction, PremiumInteractionHandlerData> {
    constructor(bot: Bot) {
        super(
            bot,
            
            new InteractionHandlerBuilder()
                .setName("premium")
                .setDescription("View the Premium plan")
                .setType([ InteractionType.Button ]),

            {
                action: "string"
            }
        );
    }

    public async run({ data: { action }, interaction, db }: InteractionHandlerRunOptions<ButtonInteraction, PremiumInteractionHandlerData>): InteractionHandlerResponse {
        if (action === "overview") {
            return this.bot.db.plan.buildOverview(interaction, db);

        } else if (action === "purchase") {
            const row: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Link)
                        .setURL(Utils.shopURL())
                        .setLabel("Visit our shop")
                        .setEmoji("💸")
                );

            return new Response()
                .addComponent(ActionRowBuilder<ButtonBuilder>, row)
                .setEphemeral(true);

        } else if (action === "ads") {
            /* Whether the shop buttons should be shown */
		    const showButtons: boolean = db.user.metadata.email != undefined;

            const perks: string[] = [
                "Way lower cool-down for chatting",
                "Bigger token (character) limit for chatting",
                "Early access to new features"
            ];

            const embed: EmbedBuilder = new EmbedBuilder()
                .setTitle("Want to get rid of annoying ads? ✨")
                .setDescription(`**Premium** gets rid of all ads in the bot & also gives you additional benefits, such as\n\n${perks.map(p => `- ${p}`).join("\n")}`)
                .setColor("Orange");

            const row: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Link)
                        .setURL(Utils.shopURL())
                        .setLabel("Visit our shop")
                        .setEmoji("💸")
                );

            if (showButtons) row.components.unshift(
                new ButtonBuilder()
                    .setCustomId(`premium:purchase:subscription`).setEmoji("🛍️")
                    .setLabel("Subscribe")
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId(`premium:purchase:plan`).setEmoji("🛍️")
                    .setLabel("Purchase credits")
                    .setStyle(ButtonStyle.Secondary)
            );

            return new Response()
                .addComponent(ActionRowBuilder<ButtonBuilder>, row)
                .addEmbed(embed).setEphemeral(true);
        }
    }
}