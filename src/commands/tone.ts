import { ActionRowBuilder, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction, InteractionUpdateOptions, ComponentEmojiResolvable, ChatInputCommandInteraction } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { Response } from "../command/response.js";

import { DatabaseGuild, DatabaseInfo, DatabaseUser } from "../db/managers/user.js";
import { Conversation } from "../conversation/conversation.js";
import { ChatTone, ChatTones } from "../conversation/tone.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

export default class ToneCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
                .setName("tone")
                .setDescription("Change the personality & settings of the bot")
				.addStringOption(builder => builder
					.setName("which")
					.setDescription("Which tone to switch to")
					.setRequired(false)
					.addChoices(...ChatTones.map(tone => ({
						name: Utils.truncate(`${tone.name} ${tone.emoji.fallback} ${tone.settings.premium ? "(premium-only)" : ""} » ${tone.description}`, 90),
						value: tone.id
					}))))
		);
    }

	/**
	 * Format a tone selector message.
	 * @param conversation Conversation to format it for
	 * 
	 * @returns Response message
	 */
	public format(conversation: Conversation): Response {
		const row = new ActionRowBuilder<StringSelectMenuBuilder>()
			.addComponents(
				new StringSelectMenuBuilder()
					.setCustomId(`tone:${conversation.id}`)
					.setPlaceholder("Choose a personality & model")
					.addOptions(...ChatTones.map(tone => ({
						label: `${tone.name}${tone.settings.premium ? " (premium-only ✨)" : ""}`,
						value: tone.id,
						emoji: tone.emoji.display as ComponentEmojiResolvable ?? tone.emoji.fallback,
						description: Utils.truncate(`${tone.description}`, 80)
					})))
			);

		const response = new Response()
			.addEmbed(builder => builder
				.setTitle("Tone")
				.setDescription("*Want to change how the bot acts?*")
				.setColor("Purple")
				.addFields(
					{
						name: `${conversation.tone.emoji.display ?? conversation.tone.emoji.fallback} ${conversation.tone.name} ${conversation.tone.settings.premium ? "(premium-only)" : ""}`,
						value: `*${conversation.tone.description}*`
					}
				)
			)
			.addComponent(ActionRowBuilder<StringSelectMenuBuilder>, row);

		if (conversation.tone.settings.premium || conversation.tone.settings.displayName) response.embeds[0]
			.addFields({
				name: "Settings",
				value: `**[Premium](${Utils.shopURL()})-only** » ${conversation.tone.settings.premium ? "✅" : "❌"}${conversation.tone.settings.displayName ? `\n**Model** » \`${conversation.tone.settings.displayName}\`` : ""}`
			});

		return response;
	}

	/**
	 * Handle a select menu interaction.
	 * @param interaction Interaction to handle
	 */
	public async handleSelectionInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
		if (interaction.message.author.id !== this.bot.client.user!.id) return;
		if (!interaction.customId.startsWith("tone")) return;

		const id: string | null = interaction.customId.split(":").length > 1 ? interaction.customId.split(":")[1] : null;
		if (id === null) return;

		/* Get the user's conversation. */
		const conversation: Conversation = await this.bot.conversation.create(interaction.user);

		/* Make sure that this is the user's tone selector, and not anyone else's. */
		if (conversation.id !== id) return void await interaction.deferUpdate();

		/* Find the chosen tone to set. */
		const tone: ChatTone | null = ChatTones.find(t => t.id === interaction.values[0]) ?? null;
		if (tone === null) return void await interaction.deferUpdate();

		/* Get the subscription status of the user & guild. */
		const db = await this.bot.db.users.fetchData(interaction.user, interaction.guild);

		/* If the tone is restricted to Premium users, and they aren't subscribed, send them a notice. */
		if (tone.settings.premium && !this.bot.db.users.canUsePremiumFeatures(db)) return void await new Response()
			.addEmbed(builder => builder
				.setDescription(`✨ By buying **Premium**, you will be able to access exclusive personalities, like \`${tone.name}\` ${tone.emoji.display ?? tone.emoji.fallback}.\n**Premium** *also includes further benefits, view \`/premium info\` for more*. ✨`)
				.setColor("Orange")
			)
			.setEphemeral(true)
		.send(interaction);

		/* Switch the tone. */
		if (tone.id === conversation.tone.id) return void await interaction.deferUpdate();
		await conversation.changeTone(tone);

		/* Update the original interaction. */
		await interaction.update(this.format(conversation).get() as InteractionUpdateOptions);
	}

    public async run(interaction: ChatInputCommandInteraction): CommandResponse {
		/* Get the user's conversation. */
		const conversation: Conversation = await this.bot.conversation.create(interaction.user);

		/* If the conversation is currently busy, don't reset it. */
		if (conversation.generating) return new Response()
			.addEmbed(builder => builder
				.setDescription("You have a request running in your conversation, *wait for it to finish* 😔")
				.setColor("Red")
			)
			.setEphemeral(true);

		/* Tone specified by the user, optionally */
		const id: string | null = interaction.options.getString("which", false);
		const tone: ChatTone | null = id !== null ? ChatTones.find(tone => tone.id === id) ?? null : null;

		/* If the user specified a tone to switch to, switch directly to that one. */
		if (tone !== null) {
			/* Get the subscription status of the user & guild. */
			const db: DatabaseInfo = await this.bot.db.users.fetchData(interaction.user, interaction.guild);

			/* If the tone is restricted to Premium users, and they aren't subscribed, send them a notice. */
			if (tone.settings.premium && !this.bot.db.users.canUsePremiumFeatures(db)) return new Response()
				.addEmbed(builder => builder
					.setDescription(`✨ By buying **Premium**, you will be able to access exclusive personalities, like \`${tone.name}\` ${tone.emoji.display ?? tone.emoji.fallback}.\n**Premium** *also includes further benefits, view \`/premium info\` for more*. ✨`)
					.setColor("Orange")
				)
				.setEphemeral(true);

			/* Change the tone of the user's conversation. */
			await conversation.changeTone(tone);

			return new Response()
				.addEmbed(builder => builder
					.setDescription(`Tone & model changed to **${tone.name} ${tone.emoji.display ?? tone.emoji.fallback}**`)
					.setColor("Yellow")
				)
				.setEphemeral(true);
		}

		return this.format(conversation).setEphemeral(true);
    }
}