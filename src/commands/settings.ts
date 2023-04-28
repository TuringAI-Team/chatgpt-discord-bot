import { SlashCommandBuilder, EmbedBuilder, AutocompleteInteraction, CacheType, CommandInteractionOption } from "discord.js";

import { Command, CommandInteraction, CommandOptionChoice, CommandResponse } from "../command/command.js";
import { Response } from "../command/response.js";

import { AutocompleteChoiceSettingsOption, ChoiceSettingsOption, SettingsName, SettingsOptionType } from "../db/managers/settings.js";
import { DatabaseInfo, DatabaseUser } from "../db/managers/user.js";
import { Conversation } from "../conversation/conversation.js";
import { Bot } from "../bot/bot.js";

export default class SettingsCommand extends Command {
    constructor(bot: Bot) {
		const builder: SlashCommandBuilder =
			new SlashCommandBuilder()
				.setName("settings")
				.setDescription("Customize the bot to your liking");

		for (const option of bot.db.settings.options()) {
			/* Add the options' parameter to the /settings command. */
			option.addToCommand(bot, builder);
		}

        super(bot, builder, { cooldown: 5 * 1000 });
    }

	public format(db: DatabaseUser, conversation: Conversation, changes: Partial<Record<SettingsName, any>>): Response {
		const embed: EmbedBuilder = new EmbedBuilder()
			.setTitle("Settings ⚙️")
			.setColor(Object.values(changes).length > 0 ? "Orange" : this.bot.branding.color);

		for (const option of this.bot.db.settings.options()) {
			/* Whether this option was modified */
			const wasModified: boolean = changes[option.key] != undefined;

			const original = this.bot.db.settings.get(db, option);
			const modified = changes[option.key];

			embed.addFields({
				name: `${option.data.name} ${option.data.emoji.display ?? option.data.emoji.fallback} · *${option.data.description}*`,
				value: wasModified ? `*${option.display(this.bot, original)}* » ${option.display(this.bot, modified)}` : option.display(this.bot, original)
			});
		}

		if (Object.keys(changes).length === 0) embed.setFooter({ text: "Change the settings by specifying changes you want to make when running /settings" })
		return new Response().addEmbed(embed);
	}

	public async complete(interaction: AutocompleteInteraction<CacheType>): Promise<CommandOptionChoice<string | number>[]> {
		const param: CommandInteractionOption | null = interaction.options.data.filter(o => o.focused)[0] ?? null;
		if (param === null) return [];

		/* Name of the argument */
		const key: SettingsName = param.name as SettingsName;
		const value: string = param.value as string;

		/* Find the corresponding settings option. */
		const option: AutocompleteChoiceSettingsOption | null =
			this.bot.db.settings.options().find(s => s.key === key && s.data.type === SettingsOptionType.AutoComplete) as AutocompleteChoiceSettingsOption
			?? null;

		/* Try to complete this request. */
		return option.complete(this.bot, interaction, value);
	}

    public async run(interaction: CommandInteraction, { user }: DatabaseInfo): CommandResponse {
		/* Get the user's conversation. */
		const conversation: Conversation = await this.bot.conversation.create(interaction.user);

		/* If the conversation is currently busy, don't reset it. */
		if (conversation.generating || conversation.generatingImage) return new Response()
			.addEmbed(builder => builder
				.setDescription("You have a request running in your conversation, *wait for it to finish* 😔")
				.setColor("Red")
			)
			.setEphemeral(true);

		/* All changes done by the user */
		const changes: Partial<Record<SettingsName, any>> = {};

		for (const option of this.bot.db.settings.options()) {
			/* Get the value specified by the user. */
			const param = interaction.options.get(option.key, false);
			if (!param || !param.value) continue;

			/* If the chosen option is Premium-only, show a notice to the user. */
			if (option instanceof ChoiceSettingsOption) {
				/* Chosen choice from the list */
				const chosen = option.data.choices.find(c => c.value === param.value)!;
			
				if (chosen.premium) return new Response()
					.addEmbed(builder => builder
						.setDescription(`✨ The choice **${chosen.name}** for \`${option.data.name}\` is restricted to **Premium** users.\n**Premium** *also includes further benefits, view \`/premium info\` for more*. ✨`)
						.setColor("Orange")
					)
					.setEphemeral(true);
			}

			if (user.settings[option.key] != param.value) changes[option.key] = param.value;
		}

		/* Apply the modified settings, if any were actually changed. */
		if (Object.values(changes).length > 0) await this.bot.db.settings.apply(user, changes);

		return this.format(user, conversation, changes).setEphemeral(true);
    }
}