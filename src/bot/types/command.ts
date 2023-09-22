import { Bot, Interaction, Message } from "@discordeno/bot";
import { CreateSlashApplicationCommand } from "@discordeno/types";

export interface CommandCooldown {
	user: number;
	voter: number;
	subscription: number;
}

export interface Command {
	interaction: (interaction: CommandContext) => Promise<void>;
	message?: (message: MessageContext) => Promise<void>;
	body: CreateSlashApplicationCommand;
	cooldown: CommandCooldown;
	isPrivate?: boolean;
}

export interface CommandContext {
	interaction: Interaction;
}

export interface MessageContext extends Omit<CommandContext, "interaction"> {
	message: Message;
	bot: Bot;
}
