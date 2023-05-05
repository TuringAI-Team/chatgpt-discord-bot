import { ActionRowBuilder, ButtonInteraction, ComponentEmojiResolvable, InteractionUpdateOptions, StringSelectMenuBuilder, StringSelectMenuInteraction } from "discord.js";
import { ChatSettingsModel, ChatSettingsModels } from "./model.js";
import { ChatSettingsTone, ChatSettingsTones } from "./tone.js"
import { DatabaseInfo } from "../../db/managers/user.js";
import { Response } from "../../command/response.js";
import { Conversation } from "../conversation.js";
import { Emoji } from "../../util/emoji.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

type SwitcherType = "model" | "tone"

const SwitcherArrays: Record<SwitcherType, (ChatSettingsModel | ChatSettingsTone)[]> = {
    model: ChatSettingsModels,
    tone: ChatSettingsTones
} 

export class SwitcherBuilder {
    public static build<T extends ChatSettingsModel | ChatSettingsTone>(conversation: Conversation, db: DatabaseInfo, type: SwitcherType): Response {
        /* Entries for this switcher type */
        const array: T[] = SwitcherArrays[type] as T[];

        /* Current value */
        const current: T = conversation.setting<T>(type, array, db);

		const row = new ActionRowBuilder<StringSelectMenuBuilder>()
			.addComponents(
				new StringSelectMenuBuilder()
					.setCustomId(`${type}-switcher:${conversation.id}`)
					.setPlaceholder(`Choose a ${type}`)
					.addOptions(...array.map(e => ({
						label: `${e.options.name}${e.options.premium ? " (premium-only ✨)" : ""}`,
						value: e.id,
						emoji: Emoji.display(e.options.emoji, true) as ComponentEmojiResolvable,
						description: Utils.truncate(`${e.options.description}`, 80)
					})))
			);

		const response = new Response()
			.addEmbed(builder => builder
				.setTitle(Utils.titleCase(type))
				.setDescription(type === "tone" ? "*Want to change how the bot acts?*" : "*Want to change the language model?*")
				.setColor("Purple")
				.addFields(
					{
						name: `${Emoji.display(current.options.emoji, true)} ${current.options.name} ${current.options.premium ? "(premium-only ✨)" : ""}`,
						value: `*${current.options.description}*`
					}
				)
			)
			.addComponent(ActionRowBuilder<StringSelectMenuBuilder>, row)
            .setEphemeral(true);

		return response;
    }

    public static async handleInteraction(bot: Bot, interaction: StringSelectMenuInteraction): Promise<void> {
		if (interaction.message.author.id !== bot.client.user!.id) return;
		if (!interaction.customId.includes("switcher")) return;

        const data = interaction.customId.split(":");

        const type: "tone" | "model" = data[0].replaceAll("-switcher", "") as any;
        const id: string = data[1];

        const arr: (ChatSettingsModel | ChatSettingsTone)[] = SwitcherArrays[type];

		/* Get the user's conversation. */
		const conversation: Conversation = await bot.conversation.create(interaction.user);
		if (conversation.id !== id) return void await interaction.deferUpdate();

		/* Find the chosen setting to modify. */
		const updated: ChatSettingsModel | ChatSettingsTone | null = arr.find(e => e.id === interaction.values[0]) ?? null;
		if (updated === null) return void await interaction.deferUpdate();

		/* Get the subscription status of the user & guild. */
		const db = await bot.db.users.fetchData(interaction.user, interaction.guild);

		/* If the setting is restricted to Premium users and they aren't a subscribed memeber, send them a notice. */
		if (updated.options.premium && !bot.db.users.canUsePremiumFeatures(db)) return void await new Response()
			.addEmbed(builder => builder
				.setDescription(`✨ By buying **Premium**, you will be able to access exclusive ${type}s, like \`${updated.options.name}\` ${Emoji.display(updated.options.emoji)}.\n**Premium** *also includes further benefits, view \`/premium info\` for more*. ✨`)
				.setColor("Orange")
			)
			.setEphemeral(true)
		.send(interaction);

		/* Switch the setting. */
		if (updated.id === conversation[type](db).id) return void await interaction.deferUpdate();
		await conversation.changeSetting(type, db.user, updated);

		/* Update the original interaction. */
		await interaction.update(
            this.build(
                conversation, await bot.db.users.fetchData(interaction.user, interaction.guild), type
            ).get() as InteractionUpdateOptions
        );
    }
}