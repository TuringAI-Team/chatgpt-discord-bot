import { Bot, Interaction } from "@discordeno/bot";
import { CreateSlashApplicationCommand } from "@discordeno/types";
import { Environment } from "../../types/other";

export interface CommandCooldown {
	user: number;
	voter: number;
	subscription: number;
}

export interface Command {
	execute: (interaction: CommandContext) => Promise<void>;
	body: CreateSlashApplicationCommand;
	cooldown: CommandCooldown;
	isPrivate?: boolean;
}

export interface CommandContext {
	interaction: Interaction;
	bot: Bot;
	env: Environment;
}
