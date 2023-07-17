import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, Interaction, InteractionUpdateOptions, ModalBuilder, ModalSubmitInteraction, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

import { InteractionHandlerResponse, InteractionHandlerRunOptions } from "../interaction/handler.js";
import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { APIInteractionHandlerData } from "../interactions/api.js";
import { ErrorResponse } from "../command/response/error.js";
import { UserPlanAPIExpense } from "../db/managers/plan.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { TuringAPIKey, TuringAPIKeyData } from "../turing/types/key.js";
import { Response } from "../command/response.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";
import { randomUUID } from "crypto";

export default class APICommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
                .setName("api").setDescription("...")

				.addSubcommand(builder => builder
					.setName("overview").setDescription("View all of your expenses & how to use the API")
				)

				.addSubcommand(builder => builder
					.setName("keys").setDescription("Manage your API keys")
				)
		, {
			restriction: [ "api", "owner" ]
		});
    }

	private buildKeysOverview(db: DatabaseInfo, keys: TuringAPIKey[]): Response {
		const rows: ActionRowBuilder<ButtonBuilder>[] = [];

		for (const key of keys) {
			rows.push(new ActionRowBuilder<ButtonBuilder>()
				.addComponents(
					new ButtonBuilder()
						.setLabel(key.name).setEmoji("🔐")
						.setStyle(ButtonStyle.Primary)
						.setCustomId(`api:info:${key.id}`),

					new ButtonBuilder()
						.setEmoji("🗑️").setStyle(ButtonStyle.Danger)
						.setCustomId(`api:delete:${key.id}`)
				)
			);
		}

		rows.push(new ActionRowBuilder<ButtonBuilder>()
			.addComponents(
				new ButtonBuilder()
					.setLabel("Create a new key").setEmoji("✅")
					.setStyle(ButtonStyle.Success)
					.setCustomId("api:create"),

				new ButtonBuilder()
					.setEmoji("🔄").setStyle(ButtonStyle.Secondary)
					.setCustomId("api:refresh:keys")
			)
		);

		const response: Response = new Response()
			.addEmbed(builder => builder
				.setDescription(`*Manage your **Turing API <:turing_logo:1114952278483411095>** keys here*`)
				.setColor(this.bot.branding.color)
			)
			.setEphemeral(true);
		
		rows.forEach(
			row => response.addComponent(ActionRowBuilder<ButtonBuilder>, row)
		);

		return response;
	}

	public displayKeyData(data: TuringAPIKeyData, full: boolean = false): Response {
		const fields = [
			{ name: "API key", value: data.apiToken },
			{ name: "Captcha key", value: data.captchaToken }
		];

		/* How many characters to show, if the full key should not be shown */
		const length: number = 10;

		return new Response()
			.addEmbed(builder => builder
				.setTitle(``)
				.setDescription(full ? "**Make sure to never share these keys with someone else!**\n*Find out how & where to use these keys for the API **[here](https://docs.turing.sh)***." : null)
				.addFields(fields.map(f => ({
					name: f.name, value: `\`${full ? f.value : `${f.value.slice(undefined, length)}${"*".repeat(15)}${f.value.slice(-length)}`}\``
				})))
				.setColor(this.bot.branding.color)
			)
			.setEphemeral(true);
	}

	public async handleInteraction({ data, db, raw, interaction }: InteractionHandlerRunOptions<ButtonInteraction, APIInteractionHandlerData>): InteractionHandlerResponse {
		raw.shift();

		if (data.action === "refresh") {
			const action: "overview" | "keys" = raw[0] as any;
			
			await interaction.update(
				(await this.display(action, db)).get() as InteractionUpdateOptions
			);

		} else if (data.action === "create") {
            const customID: string = randomUUID();

            const input: TextInputBuilder = new TextInputBuilder()
                .setCustomId("value")
                .setRequired(true)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Really cool API key")
                .setLabel("Name of the key")
                .setMinLength(1).setMaxLength(32);

            const builder: ModalBuilder = new ModalBuilder()
				.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))
                .setCustomId(customID).setTitle("API key");

            /* Show the model to the user, then waiting for their input. */
            await interaction.showModal(builder);

            /* New, updated value */
            let modal: ModalSubmitInteraction = null!;
			let name: string = null!;

            /* Wait for the user to submit the modal. */
            await new Promise<void>(resolve => {
                const clean = () => {
                    this.bot.client.off("interactionCreate", listener);
                    clearTimeout(timer);
                    resolve();
                }

                const timer = setTimeout(() => {
                    clean();
                }, 60 * 1000);

                const listener = async (modalInteraction: Interaction) => {
                    if (!modalInteraction.isModalSubmit() || modalInteraction.user.id !== db.user.id || modalInteraction.customId !== customID) return;

                    name = modalInteraction.fields.getTextInputValue("value");
                    modal = modalInteraction;

                    clean();
                };

                this.bot.client.on("interactionCreate", listener);
            });

			if (!name) return;
			await modal.deferUpdate();

			const key = await this.bot.turing.keys.create(db.user, name);
			return this.display("keys", db, this.displayKeyData(key, true).embeds[0]);

		} else if (data.action === "delete" || data.action === "info") {
			const keys = await this.bot.turing.keys.list(db.user);
			const key: TuringAPIKey = keys.find(k => k.id === raw[0])!;

			if (data.action === "info") {
				const data: TuringAPIKeyData = await this.bot.turing.keys.info(db.user, key);
				return this.displayKeyData(data);

			} else if (data.action === "delete") {
				await this.bot.turing.keys.delete(db.user, key);		

				await interaction.update(
					(await this.display("keys", db)).get() as InteractionUpdateOptions
				);
			}
		}
	}

	public async display(action: "overview" | "keys", db: DatabaseInfo, embed?: EmbedBuilder): Promise<Response> {
		const plan = this.bot.db.plan.get(db.user);

		if (plan === null) return new ErrorResponse({
			message: "You need to have **Pay-as-you-go 📊** credits to use the API; *purchase some credits below*.", color: "Orange", emoji: null
		}).addComponent(ActionRowBuilder<ButtonBuilder>, new ActionRowBuilder<ButtonBuilder>()
			.addComponents(new ButtonBuilder()
				.setStyle(ButtonStyle.Link)
				.setURL(Utils.shopURL())
				.setLabel("Visit our shop")
				.setEmoji("💸")
			)
		);

		if (action === "overview") {
			/* All recent expenses using the API */
			const expenses: UserPlanAPIExpense[] = plan.expenses
				.filter(e => e.type === "api").slice(undefined, 10) as UserPlanAPIExpense[];

			return new Response()
				.addEmbed(builder => builder
					.setTitle("Turing API <:turing_logo:1114952278483411095>")
					.setDescription("*You can find documentation regarding the API **[here](https://docs.turing.sh)***.")
					.setColor(this.bot.branding.color)
				)
				.addEmbed(builder => builder
					.setTitle("Expenses 💸")
					.setColor(this.bot.branding.color)
					.addFields(expenses.map(e => ({
						name: `\`${e.data.type}/${e.data.model}\` — **$${Math.round(e.used * Math.pow(10, 5)) / Math.pow(10, 5)}**`,
						value: `*<t:${Math.floor(e.time / 1000)}:F>*`
					})))
				)
				.addComponent(ActionRowBuilder<ButtonBuilder>, new ActionRowBuilder<ButtonBuilder>()
					.addComponents(
						new ButtonBuilder()
							.setEmoji("🔄").setStyle(ButtonStyle.Secondary)
							.setCustomId("api:refresh:overview")
					)
				)
				.setEphemeral(true);

		} else if (action === "keys") {
			const keys = await this.bot.turing.keys.list(db.user);

			const response = this.buildKeysOverview(db, keys);
			if (embed) response.addEmbed(embed);

			return response;
		}

		return new Response().setContent("hi").setEphemeral(true);
	}

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
		const action: "overview" | "keys" = interaction.options.getSubcommand(true) as any;
		return this.display(action, db);
    }
}