import { CreateApplicationCommand } from "discordeno";

import type { Command } from "../types/command.js";
import { bot } from "../index.js";

import Settings from "./settings.js";
import Test from "./test.js";

export const COMMANDS: Command[] = [
	Test, Settings
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