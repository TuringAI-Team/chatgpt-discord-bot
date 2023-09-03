import { CreateApplicationCommand } from "discordeno";

import type { Command } from "../types/command.js";
import { bot } from "../mod.js";

import Settings from "./settings.js";
import Imagine from "./imagine.js";
import Premium from "./premium.js";
import Reset from "./reset.js";
import Bot from "./bot.js";

export const COMMANDS: Command[] = [Settings, Reset, Imagine, Premium, Bot];

function transformCommand(command: Command): CreateApplicationCommand {
  return {
    name: command.name,
    description: command.description,
    type: command.type,

    options: command.options
      ? Object.entries(command.options).map(([name, data]) => ({
          name,
          ...data,
        }))
      : undefined,
  };
}

export async function registerCommands() {
  bot.helpers.upsertGlobalApplicationCommands(
    Object.values(COMMANDS).map((c) => transformCommand(c))
  );
}
