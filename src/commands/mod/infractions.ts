import { SlashCommandBuilder, SlashCommandSubcommandGroupBuilder } from "discord.js";
import dayjs from "dayjs";

import { Command, CommandInteraction, CommandResponse } from "../../command/command.js";
import { DatabaseInfraction } from "../../moderation/types/infraction.js";
import { ErrorResponse } from "../../command/response/error.js";
import { DatabaseEntry } from "../../db/managers/user.js";
import { Response } from "../../command/response.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

export const BanDurationOptions = [
	dayjs.duration({ minutes: 1 }),
	dayjs.duration({ hours: 1 }),
	dayjs.duration({ days: 1 }),
	dayjs.duration({ days: 3 }),
	dayjs.duration({ days: 7 }),
	dayjs.duration({ days: 14 }),
	dayjs.duration({ months: 1 }),
	dayjs.duration({ months: 3 }),
	dayjs.duration({ years: 1 }),
	dayjs.duration({ years: 99 })
]

export default class InfractionsCommand extends Command {
    constructor(bot: Bot) {
		const builder = new SlashCommandBuilder()
			.setName("infractions").setDescription("...");

		for (const type of [ "guild", "user" ]) {
			const group = new SlashCommandSubcommandGroupBuilder()
				.setName(type).setDescription("...")
				.addSubcommand(builder => builder
					.setName("warn")
					.setDescription(`Give a warning to a ${type}`)
					.addStringOption(builder => builder
						.setName("id")
						.setDescription(`ID or name of the ${type} to give a warning`)
						.setRequired(true)
					)
					.addStringOption(builder => builder
						.setName("reason")
						.setDescription("Reason for the warning")
						.setRequired(false)
					)
				)
				.addSubcommand(builder => builder
					.setName("ban")
					.setDescription(`Ban a ${type}`)
					.addStringOption(builder => builder
						.setName("id")
						.setDescription(`ID or name of the ${type} to ban`)
						.setRequired(true)
					)
					.addStringOption(builder => builder
						.setName("reason")
						.setDescription("Reason for the ban")
						.setRequired(false)
					)
					.addStringOption(builder => builder
						.setName("duration")
						.setDescription(`For how long to ban the ${type}`)
						.setRequired(false)
						.addChoices(...BanDurationOptions.map(duration => ({
							name: `${duration.humanize()}`,
							value: duration.asMilliseconds().toString()
						})))
					)
				)
				.addSubcommand(builder => builder
					.setName("unban")
					.setDescription(`Un-ban a ${type}`)
					.addStringOption(builder => builder
						.setName("id")
						.setDescription(`ID or name of the ${type} to un-ban`)
						.setRequired(true)
					)
					.addStringOption(builder => builder
						.setName("reason")
						.setDescription("Reason for the ban")
						.setRequired(false)
					)
				)
				.addSubcommand(builder => builder
					.setName("remove")
					.setDescription(`Remove an infraction from a ${type}`)
					.addStringOption(builder => builder
						.setName("id")
						.setDescription(`ID or name of the ${type} to remove the warning of`)
						.setRequired(true)
					)
					.addStringOption(builder => builder
						.setName("which")
						.setDescription("ID of the infraction to remove")
						.setRequired(true)
					)
				);

			builder.addSubcommandGroup(group);
		}

        super(
			bot, builder, { restriction: [ "moderator" ] }
		);
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		/* Whether a guild or user is targetted */
		const location: "guild" | "user" = interaction.options.getSubcommandGroup(true) as any;

		/* Which action to perform */
		const action: "warn" | "ban" | "unban" | "remove" = interaction.options.getSubcommand(true) as any;

		/* ID of the user */
		const id: string = interaction.options.getString("id", true);
		const target = await Utils.findType(this.bot, location, id);

		/* Reason for the warning */
		const reason: string | undefined = interaction.options.getString("reason") !== null ? interaction.options.getString("reason", true) : undefined;
		
		if (target === null) return new ErrorResponse({
			message: `The specified ${location} does not exist`
		});

		/* Get the database entry of the user, if applicable. */
		let db: DatabaseEntry | null = location === "guild"
			? await this.bot.db.users.getGuild(target.id)
			: await this.bot.db.users.getUser(target.id);

		if (db === null) return new ErrorResponse({
			message: `The specified ${location} hasn't interacted with the bot`
		});

		if (action === "warn") {
			/* Send the warning to the user. */
			db = await this.bot.moderation.warn(db, {
				by: interaction.user.id, reason
			});

			return new Response()
				.addEmbed(builder => builder
					.setAuthor({ name: target.name, iconURL: target.icon ?? undefined })
					.setDescription(`\`\`\`\n${db!.infractions[db!.infractions.length - 1].reason}\n\`\`\``)
					.setTitle("Warning given ✉️")
					.setColor("Yellow")
					.setTimestamp()
				);

		} else if (action === "ban" || action === "unban") {
			if (location === "user" && target.id === interaction.user.id) return new ErrorResponse({
				message: `You can't perform this action on yourself`, emoji: "🙄"
			});

			else if (location === "guild" && target.id === interaction.guildId) return new ErrorResponse({
				message: `You can't perform this action on this guild`, emoji: "🙄"
			});

			else if (!this.bot.moderation.banned(db) && action === "unban") return new ErrorResponse({
				message: `The specified ${location} is not banned`, emoji: "🙄"
			});

			/* Whether the entry should be banned / unbanned */
			const status: boolean = action === "ban";

			/* Reason for the ban */
			const reason: string | undefined = interaction.options.getString("reason") !== null
				? interaction.options.getString("reason", true)
				: status ? "Inappropriate use of the bot" : "Appealed";

			/* For how long to ban the entry for */
			const rawDuration: string | undefined = interaction.options.getString("duration") ?? undefined;
			const duration: number | undefined = rawDuration && status ? parseInt(rawDuration) : undefined;
			const until: number | undefined = duration ? Math.floor((Date.now() + duration) / 1000) : undefined;

			/* The existing ban infraction, if applicable */
			const overwrite: DatabaseInfraction | null = action === "ban" ? this.bot.moderation.banned(db) : null;
			if (overwrite) db = await this.bot.moderation.removeInfraction(db, overwrite);

			db = await this.bot.moderation.ban(db, {
				by: interaction.user.id, duration, status: status, reason
			});

			const infraction: DatabaseInfraction = db.infractions[db.infractions.length - 1];

			return new Response()
				.addEmbed(this.bot.moderation.buildInfractionEmbed(db, infraction)
					.setAuthor({ name: target.name, iconURL: target.icon ?? undefined })
					.setTitle(status ? overwrite ? "Ban updated 🔨" : "Banned 🔨" : "Un-banned 🙌")
					.setColor(status && !overwrite ? "Red" : "Yellow")
				);

		} else if (action === "remove") {
			/* ID of the infraction to remove */
			const which: string = interaction.options.getString("which", true);
			const infraction: DatabaseInfraction | null = db.infractions.find(i => i.id === which) ?? null;

			if (infraction === null) return new ErrorResponse({
				message: "The specified infraction does not exist"
			});

			if (infraction.type === "moderation" || infraction.type === "ban" || infraction.type === "warn") return new ErrorResponse({
				message: `You cannot remove infractions of type \`${infraction.type}\``
			});

			db = await this.bot.moderation.removeInfraction(db, infraction);

			return new Response()
				.addEmbed(builder => builder
					.setAuthor({ name: target.name, iconURL: target.icon ?? undefined })
					.setTitle("Infraction removed ✉️")
					.setDescription(`\`\`\`\n${infraction.reason}\n\`\`\``)
					.setColor("Green")
					.setTimestamp()
				);
		}
    }
}