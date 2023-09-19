import { Interaction } from "@discordeno/bot";
import { CreateSlashApplicationCommand } from "@discordeno/types";

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
}
