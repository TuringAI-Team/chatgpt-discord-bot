import { AttachmentBuilder, Guild, SlashCommandBuilder, User } from "discord.js";
import dayjs from "dayjs";

import { Command, CommandInteraction, CommandPrivateType, CommandResponse } from "../../command/command.js";
import { DatabaseSubscriptionKey, DatabaseSubscriptionType } from "../../db/managers/user.js";
import { SUBSCRIPTION_DURATION_OPTIONS } from "./grant.js";
import { Response } from "../../command/response.js";
import { Bot } from "../../bot/bot.js";

export default class KeysCommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("keys")
			.setDescription("Do stuff with keys")
			.addSubcommand(builder => builder
				.setName("generate")
				.setDescription("Generate Premium subscription keys")
				.addStringOption(builder => builder
					.setName("type")
					.setDescription("Which type of keys they should be")
					.setChoices(
						{ name: "Guild 💻", value: "guild" },
						{ name: "User 👤", value: "user" }
					)
				)
				.addIntegerOption(builder => builder
					.setName("count")
					.setMaxValue(1000)
					.setMinValue(1)
					.setDescription("How many keys to generate")
					.setRequired(false)
				)
				.addStringOption(builder => builder
					.setName("duration")
					.setDescription("How long the keys should grant Premium for")
					.addChoices(...SUBSCRIPTION_DURATION_OPTIONS.map(duration => ({
						name: `${duration.humanize()}`,
						value: duration.asMilliseconds().toString()
					})))
					.setRequired(false)
				)
			)

			.addSubcommand(builder => builder
				.setName("info")
				.setDescription("Get information about a subscription key")
				.addStringOption(builder => builder
					.setName("id")
					.setDescription("Which key to get information about")
				)
			)

			.addSubcommand(builder => builder
				.setName("revoke")
				.setDescription("Revoke a subscription key")
				.addStringOption(builder => builder
					.setName("id")
					.setDescription("Which key to revoke")
				)
			)

		, { private: CommandPrivateType.OwnerOnly });
	}

    public async run(interaction: CommandInteraction): CommandResponse {
		/* Which sub-command to execute */
		const action: "generate" | "info" | "revoke" = interaction.options.getSubcommand(true) as any;

		/* Generate Premium subscription keys */
		if (action === "generate") {
			/* How many keys to generate */
			const count: number = interaction.options.getInteger("count") ?? 5;

			/* Duration of the granted subscription */
			const rawDuration: string | null = interaction.options.getString("duration") ? interaction.options.getString("duration", true) ?? null : null;
			const duration: number | undefined = rawDuration !== null ? parseInt(rawDuration) : undefined;

			/* Which type of key to generate */
			const type: DatabaseSubscriptionType = interaction.options.getString("type") as DatabaseSubscriptionType;

			/* Generate the subscription keys. */
			const keys: DatabaseSubscriptionKey[] = await this.bot.db.users.generateSubscriptionKeys(count, type, duration);
			const data: string = keys.map(key => key.id).join("\n");

			return new Response()
				.addEmbed(builder => builder
					.setDescription(`Generated **${count}** ${type} subscription key${count > 1 ? "s" : ""}${duration !== undefined ? ` with a duration of **${dayjs.duration({ milliseconds: duration }).humanize()}**` : ""} 🙏`)
					.setColor("Orange")
				)
				.addAttachment(new AttachmentBuilder(Buffer.from(data)).setName("keys.txt"));

		/* Get information about a subscription key */
		} else if (action === "info") {
			/* Key to redeem */
			const id: string = interaction.options.getString("id", true);

			/* Find the key in the database. */
			const key: DatabaseSubscriptionKey | null = await this.bot.db.users.getSubscriptionKey(id);

			if (key === null) return new Response()
				.addEmbed(builder => builder
					.setDescription("The specified subscription key is invalid ❌")
					.setColor("Red")
				)
				.setEphemeral(true);

			/* Fetch the user who redeemed the key. */
			const user: User | null = key.redeemed !== null ? await this.bot.client.users.fetch(key.redeemed.who) : null;

			/* Fetch the guild the key was redeemed for, in case it is a guild subscription key. */
			const guild: Guild | null = key.redeemed !== null && key.redeemed.guild ? await this.bot.client.guilds.fetch(key.redeemed.guild) : null;

			/* Formatted response to send */
			const response = new Response()
				.addEmbed(builder => builder
					.setTitle("Subscription key 🔐")
					.setDescription(`\`${key.id}\``)
					.addFields([
						{
							name: "Type",
							value: key.type === "user" ? "User 👤" : "Guild 💻"
						},

						{
							name: "Created",
							value: `<t:${Math.floor(key.created / 1000)}:f>`
						}
					])
				);
			
			if (user === null) {
				response.embeds[0]
					.setFooter({ text: "This key has not been redeemed yet." })
					.setColor("Grey");

			} else if (user !== null && key.redeemed) {
				response.embeds[0]
					.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
					.addFields([
						{
							name: "Redeemed",
							value: `<t:${Math.floor(key.redeemed.when / 1000)}:f>, by **${user.tag}**`
						}
					])
					.setColor("#e4b400");
			}

			if (guild !== null) {
				response.embeds[0]
					.addFields([{
						name: "Guild",
						value: `\`${guild.name}\``
					}])
			}

			return response;

		/* Revoke a subscription key */
		} else if (action === "revoke") {
			/* Key to revoke */
			const id: string = interaction.options.getString("id", true);

			/* Find the key in the database. */
			const key: DatabaseSubscriptionKey | null = await this.bot.db.users.getSubscriptionKey(id);

			if (key === null) return new Response()
				.addEmbed(builder => builder
					.setDescription("The specified subscription key is invalid ❌")
					.setColor("Red")
				)
				.setEphemeral(true);

			if (key.redeemed) return new Response()
				.addEmbed(builder => builder
					.setDescription("The specified subscription key was already redeemed ❌")
					.setFooter({ text: "Redeemed keys cannot be deleted, in order to prevent abuse." })
					.setColor("Red")
				)
				.setEphemeral(true);

			/* Delete the key permanently. */
			await this.bot.db.client
				.from(this.bot.db.collectionName("keys")).delete()
				.eq("id", id).select("*");

			await this.bot.db.cache.delete("keys", id);
			this.bot.db.users.updates.keys.delete(id);

			return new Response()
				.addEmbed(builder => builder
					.setDescription(`Deleted **${key.type}** subscription key \`${key.id}\` ✅`)
					.setColor("#e4b400")	
				);
		}
    }
}