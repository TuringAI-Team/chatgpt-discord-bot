import { CreateApplicationCommand } from "discordeno";

import type { Command } from "../types/command.js";
import { bot } from "../index.js";

import Bot from "./bot.js";

export const COMMANDS: Command[] = [
    Bot
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