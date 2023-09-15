import { join } from "node:path";
import { Command } from "../types/command.js";
import { ResolveImport, walk } from "./walk.js";

export const commands = new Map<string, Command>();
export type CommandList = keyof typeof commands;

export async function loadCommands(): Promise<Command[]> {
	const result: Command[] = [];
	const paths = await walk(join(process.cwd(), "dist", "src", "bot", "commands"));
	for (const path of paths) {
		if (!path.endsWith("js")) continue;
		const cmd = (await import(path)) as ResolveImport<Command>;
		if (!cmd.default) continue;
		result.push(cmd.default);
	}

	return result;
}
