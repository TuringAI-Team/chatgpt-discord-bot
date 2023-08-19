import { Command, CommandOption } from "../types/command.js";

export function createCommand<T extends Record<string, CommandOption>>(
	command: Command<T>
): Command<T> {
	return command;
}