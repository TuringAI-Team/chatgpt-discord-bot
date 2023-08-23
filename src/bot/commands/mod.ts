import { CreateApplicationCommand } from "discordeno";

import type { Command } from "../types/command.js";
import { bot } from "../mod.js";

import Settings from "./settings.js";
import Imagine from "./imagine.js";
import Premium from "./premium.js";
import Reset from "./reset.js";

export const COMMANDS: Command[] = [
	Settings, Reset, Imagine, Premium
];

function transformCommand(command: Command): CreateApplicationCommand {
	return {
		name: command.name,
		description: command.description,
		type: command.type,

		options: command.options ?
			Object.entries(command.options).map(([ name, data ]) => ({
				name, ...data
			}))
			: undefined
	};
}

export async function registerCommands() {
	bot.helpers.upsertGlobalApplicationCommands(
		Object.values(COMMANDS).map(c => transformCommand(c))
	);
}