import { Collection } from "@discordeno/utils";
import { Command } from "../types/command.js";

export const commands = new Collection<string, Command>();
export type CommandList = keyof typeof commands;
