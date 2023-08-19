import { CreateApplicationCommand } from "discordeno";

import type { Command } from "../types/command.js";
import { bot } from "../index.js";

export const COMMANDS: Command[] = [
    
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