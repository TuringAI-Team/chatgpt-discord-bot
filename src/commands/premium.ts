import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionsBitField, SlashCommandBuilder, User } from "discord.js";
import dayjs from "dayjs";

import { DatabaseSubscriptionKey, DatabaseSubscription, DatabaseGuildSubscription, DatabaseInfo } from "../db/managers/user.js";
import { CONVERSATION_COOLDOWN_MODIFIER, CONVERSATION_DEFAULT_COOLDOWN } from "../conversation/conversation.js";
import { Command, CommandResponse } from "../command/command.js";
import { Response } from "../command/response.js";
import { PremiumRole } from "../util/roles.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

export default class PremiumCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
                .setName("premium")
                .setDescription("View all benefits and features of Premium")

				.addSubcommand(builder => builder
					.setName("info")
					.setDescription("View information about the benefits & perks of a subscription")
				)
				.addSubcommand(builder => builder
					.setName("redeem")
					.setDescription("Redeem a Premium subscription key")
					.addStringOption(builder => builder
						.setName("key")
						.setDescription("Key to redeem")
						.setRequired(true)
					)
				)
				.addSubcommand(builder => builder
					.setName("buy")
					.setDescription("Find out where to buy a Premium subscription key")
				)
		);
    }

    public async run(interaction: ChatInputCommandInteraction, { user, guild }: DatabaseInfo): CommandResponse {
		/* Which sub-command to execute */
		const action: "info" | "redeem" | "buy" = interaction.options.getSubcommand(true) as any;

		/* If the command was run on the support server, check whether the user already has their Premium role. */
		if (guild && guild.id === this.bot.app.config.channels.moderation.guild && interaction.member instanceof GuildMember) {
			await PremiumRole.checkRole(this.bot, interaction.member);
		}

		/* View information about the benefits & perks of a subscription */
		if (action === "info") {
			const fields = [
				{
					name: "Way lower cool-down ⏰",
					value: `Chat with **ChatGPT** for as long as you want - without being interrupted by an annoying cool-down! ⏰\nYour cool-down will be lowered to an amazing **${Math.floor((CONVERSATION_DEFAULT_COOLDOWN.time! * CONVERSATION_COOLDOWN_MODIFIER.UserPremium) / 1000)} seconds**, for all normal models.`
				},

				{
					name: "GPT-4 access 🤖",
					value: `Be part of the few people that have access to **GPT-4** - _while still being **cheaper** than **ChatGPT Plus**_.`
				},
	
				{
					name: "Earlier access to new features 👀",
					value: `As a **Premium** member, you get access to preview features that we may add in the future, before the rest.`
				},
	
				{
					name: "... a special place in our 💖",
					value: `Keeping this bot free is our top priority, but it wouldn't be possible without supporters like **you**. Feel free to become one of the supporters of the bot.`
				}
			];
	
			const builder: EmbedBuilder = new EmbedBuilder()
				.setTitle("Premium ✨")
				.setDescription(`*An even better experience to use **${this.bot.client.user!.username}** on Discord*`)
				.setColor("Orange")
	
				.addFields(fields.map(field => ({
					...field,
					inline: false
				})));
	
			const response = new Response()
				.addEmbed(builder);

			if (guild && guild.subscription !== null) {
				/* Fetch the user, who redeemed the Premium key. */
				const owner: User | null = guild.subscription.by ? await this.bot.client.users.fetch(guild.subscription.by) : null;

				response.addEmbed(builder => builder
					.setDescription(`This server has had a **Premium** subscription since <t:${Math.floor(guild.subscription!.since / 1000)}:R>${owner !== null ? `, redeemed by **${owner.tag}**` : ""} 🙏\n*The subscription will expire <t:${Math.floor(guild.subscription!.expires / 1000)}:R>.*`)
					.setColor("Purple")
				);
			}

			if (user.subscription !== null) response
				.addEmbed(builder => builder
					.setDescription(`You have been a **Premium** member since <t:${Math.floor(user.subscription!.since / 1000)}:R> 🙏\n*The subscription will expire <t:${Math.floor(user.subscription!.expires / 1000)}:R>.*`)
					.setColor("Purple")
				);

			if (!this.bot.db.users.canUsePremiumFeatures({ user, guild })) response
				.addEmbed(builder => builder
					.setDescription(`To buy **Premium**, visit **[our shop](${Utils.shopURL()})** and acquire a **Premium subscription key** there. Then, run **\`/premium redeem\`** with the subscription key you got.`)
					.setColor("Purple")
				);

			return response;

		/* Find out where to buy a Premium subscription key */
		} else if (action === "buy") {
			return new Response()
				.addEmbed(builder => builder
					.setDescription(`You can get a **Premium** subscription key **[here](${Utils.shopURL()})**.\n*Once you got your subscription key, run \`/premium redeem\` with the received **key**.*`)
					.setColor("Orange")
				);

		/* Redeem a Premium subscription key */
		} else if (action === "redeem") {
			/* Key to redeem */
			const key: string = interaction.options.getString("key", true);

			/* Find the key in the database. */
			const db: DatabaseSubscriptionKey | null = await this.bot.db.users.getSubscriptionKey(key);

			if (db === null) return new Response()
				.addEmbed(builder => builder
					.setDescription("You specified an invalid subscription key ❌")
					.setColor("Red")
				)
				.setEphemeral(true);

			if (db.redeemed !== null) return new Response()
				.addEmbed(builder => builder
					.setDescription("The specified subscription key was already redeemed ❌")
					.setColor("Red")
				)
				.setEphemeral(true);

			/* If the command wasn't executed on a guild, show an error. */
			if ((!guild && db.type === "guild")) return new Response()
				.addEmbed(builder => builder
					.setDescription("You can only redeem **Premium** server keys on guilds ❌")
					.setColor("Red")
				)
				.setEphemeral(true);

			/* Either the current guild or user subscription */
			const subscription: DatabaseGuildSubscription | DatabaseSubscription | null =
				(db.type === "user" ? user.subscription : guild!.subscription);

			/* Whether the subscription can be "ovewritten" */
			const overwrite: boolean = subscription !== null ?
				subscription!.expires - Date.now() < 7 * 24 * 60 * 60 * 1000
				: false;
			
			if (((guild?.subscription && db.type === "guild") || (user.subscription !== null && db.type === "user")) && !overwrite) return new Response()
				.addEmbed(builder => builder
					.setDescription(db.type === "user" ? "You already have a **Premium** subscription 🎉" : "This server already has a **Premium** subscription 🎉")
					.setFooter({ text: "You can redeem a new subscription key, when the subscription expires in less than 7 days." })
					.setColor("Purple")
				)
				.setEphemeral(true);

			if (db.type === "guild") {
				/* Make sure that the user has Administrator permissions, if they want to redeem a server key. */
				const permissions: PermissionsBitField = interaction.memberPermissions!;

				/* If the user doesn't have the required permissions, show a notice. */
				if (!permissions.has("Administrator", true)) return new Response()
					.addEmbed(builder => builder
						.setDescription("You need to have the `Administrator` permission in order to redeem a **Premium** server key ❌")
						.setColor("Red")
					)
					.setEphemeral(true);
			}

			/* Try to redeem the key for the user. */
			if (db.type === "user") await this.bot.db.users.redeemSubscriptionKey(user, db);
			else if (db.type === "guild") await this.bot.db.users.redeemSubscriptionKey(guild!, db, interaction.user.id);

			await this.bot.db.metrics.changePremiumMetric({ redeemed: "+1" });

			return new Response()
				.addEmbed(builder => builder
					.setDescription(`Thank you for buying **Premium** for **${dayjs.duration(db.duration).humanize()}** 🎉${overwrite && subscription !== null ? `\n\n*The previous **Premium** subscription hadn't expired yet; the remaining **${dayjs.duration(subscription!.expires - Date.now()).humanize()}** have been added to the new one*.` : ""}`)
					.setFooter({ text: `View /premium info for ${db.type === "user" ? "your current subscription status" : "the server's current subscription status"}` })
					.setColor("Purple")
				)
				.setEphemeral(true);
		}
    }
}