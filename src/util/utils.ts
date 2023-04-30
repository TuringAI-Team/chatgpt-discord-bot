import { join, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { ImageBuffer } from "../chat/types/image.js";
import { Bot } from "../bot/bot.js";
import { User } from "discord.js";

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
	public static truncate(text: string, length: number): string {
		const suffix: string = "...";
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
			.replaceAll(`<@${bot.client.user!.id}>`, "")

			/* Remove any leading & trailing whitespace. */
			.trim();
	}

	/**
	 * Find a Discord user by their identifier or tag.
	 * @param id Identifier of tag of the user
	 */
	public static async findUser(bot: Bot, id: string): Promise<User | null> {
		const methods: ((id: string) => Promise<User | null>)[] = [
			/* Get the cached user. */
			async (id: string) => bot.client.users.cache.find(user => user.tag === id) ?? null,

			/* Fetch the user by their ID. */
			async (id: string) => await bot.client.users.fetch(id).catch(() => null)
		]

		/* Try all of the methods in the array above. */
		for (const method of methods) {
			const user: User | null = await method(id);
			
			if (user !== null) return user;
			else continue;
		}

		return null;
	}

	public static async fetchBuffer(url: string): Promise<ImageBuffer | null> {
		const response = await fetch(url);
		if (response.status !== 200) return null;

		return ImageBuffer.from(await response.arrayBuffer());
	}

	public static titleCase(content: string): string {
		return content
			.replaceAll("_", " ")
			.toLowerCase().split(" ")
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	}

	public static removeTrailing(content: string, trailing: string): string {
		return content.endsWith(trailing) ? content.slice(undefined, -trailing.length) : content;
	}

	public static inviteLink(bot: Bot): string {
		return `https://discord.com/api/oauth2/authorize?client_id=${bot.app.config.discord.id}&permissions=277025769536&scope=bot`;
	}

	public static supportInvite(bot: Bot): string {
		return `https://discord.gg/${bot.app.config.discord.inviteCode}`;
	}

	public static shopURL(): string {
		return "https://turingai.mysellix.io";
	}
}