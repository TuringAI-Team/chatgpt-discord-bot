import { Guild, Snowflake, User } from "discord.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { ImageBuffer } from "../chat/types/image.js";
import { Bot } from "../bot/bot.js";

type FindType = "guild" | "user"

export interface FindResult {
	name: string;
	id: Snowflake;
	created: number;
	icon: string | null;
}

type PartialFindResult = Pick<FindResult, "name" | "icon" | "created">

interface FindAction<T extends Guild | User> {
	handlers: ((id: Snowflake) => Promise<T | null>)[];
	process: (data: T) => PartialFindResult;
}

export abstract class Utils {
	/* Search for files with the specified extensions. */
	public static async search(path: string, extension: string, files: string[] = []): Promise<string[]> {
		const directory: string[] = await fs.promises.readdir(path);

		for(const i in directory) {
			const file: string = directory[i];

			if ((await fs.promises.stat(`${path}/${file}`)).isDirectory()) {
				files = await this.search(`${path}/${file}`, extension, files);

			} else {
				const __filename = fileURLToPath(import.meta.url);
				const __dirname = dirname(__filename);

				files.push(join(__dirname, "..", "..", path, "/", file));
			}
		}

		return files;
	}

	/* Get a random element from an array. */
	public static random<T>(array: T[]): T {
		return array[Math.floor(Math.random() * array.length)];
	}

	/* Shuffle the items of an array. */
	public static shuffle<T>(array: T[]): T[] {
		return array
			.map(value => ({ value, sort: Math.random() }))
			.sort((a, b) => a.sort - b.sort)
			.map(({ value }) => value);
	}

	/* Truncate a string. */
	public static truncate(text: string, length: number, suffix: string = "..."): string {
		return (text.length > length) ? text.slice(0, length - suffix.length) + suffix : text;
	}

	/**
	 * Get the suffix for a specific number.
	 * @param num Number to get the suffix for
	 * 
	 * @returns The suffix for the number
	 */
	public static ordinalForNumber(num: number): "st" | "rd" | "th" | "nd" {
		const arr: string[] = [ "th", "st", "nd", "rd" ];
		const v: number = num % 100;

		return (arr[(v - 20) % 10] || arr[v] || arr[0]) as any;
	}

	/* Clean up the content of a bot invocation message. */
	public static cleanContent(bot: Bot, content: string): string {
		return content
			/* Remove the bot mention. */ 
			.replaceAll(`<@${bot.client.user.id}>`, "")

			/* Remove any leading & trailing whitespace. */
			.trim();
	}

	/**
	 * Find a Discord user or guild by their identifier or tag.
	 * @param id Identifier or name of the user or guild
	 */
	public static async findType(bot: Bot, type: FindType, id: Snowflake): Promise<FindResult | null> {
		const methods: {
			guild: FindAction<Guild>,
			user: FindAction<User>
		} = {
			guild: {
				handlers: [
					async id => bot.client.guilds.cache.find(guild => guild.name === id) ?? null,
					async id => await bot.client.guilds.fetch(id).catch(() => null)
				],

				process: guild => ({
					name: guild.name,
					created: guild.createdTimestamp,
					icon: guild.iconURL()
				})
			},

			user: {
				handlers: [
					async id => bot.client.users.cache.find(user => user.tag === id || user.username === id || user.displayName === id) ?? null,
					async id => await bot.client.users.fetch(id).catch(() => null)
				],

				process: user => ({
					name: user.globalName ? `${user.displayName} (${user.username})` : user.username,
					created: user.createdTimestamp,
					icon: user.displayAvatarURL()
				})
			}
		};

		/* Which action to execute */
		const action = methods[type];

		for (const method of action.handlers) {
			const data = await method(id);
			if (data === null) continue;

			const final: PartialFindResult = action.process(data as any);
			const result: FindResult = { ...final, id: data.id };

			return result;
		}

		return null;
	}

	public static async findUser(bot: Bot, id: Snowflake): Promise<FindResult | null> {
		return this.findType(bot, "user", id);
	}

	public static async findGuild(bot: Bot, id: Snowflake): Promise<FindResult | null> {
		return this.findType(bot, "guild", id);
	}

	public static async fetchBuffer(url: string): Promise<ImageBuffer | null> {
		const response = await fetch(url);
		if (response.status !== 200) return null;

		return ImageBuffer.from(await response.arrayBuffer());
	}

	public static titleCase(content: string): string {
		return content
			.replaceAll("_", " ").split(" ")
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	}

	public static removeTrailing(content: string, trailing: string): string {
		return content.endsWith(trailing) ? content.slice(undefined, -trailing.length) : content;
	}

	public static fileExtension(name: string): string {
		return name.split(".").reverse()[0];
	}

	public static fileName(url: string): string {
		return url.split("/").reverse()[0];
	}

	public static baseName(name: string): string {
		return name.split(".")[0];
	}

	public static chunk<T>(arr: T[], size: number): T[][] {
		const chunks: T[][] = [];

		for (let i = 0; i < arr.length; i += size) {
			const chunk = arr.slice(i, i + size);
			chunks.push(chunk);
		}

		return chunks;
	}

	public static inviteLink(bot: Bot): string {
		return `https://discord.com/api/oauth2/authorize?client_id=${bot.app.config.discord.id}&permissions=277025769536&scope=bot`;
	}

	public static supportInvite(bot: Bot): string {
		return `https://discord.gg/${bot.app.config.discord.inviteCode}`;
	}

	public static shopURL(): string {
		return "https://app.turing.sh/pay";
	}
}