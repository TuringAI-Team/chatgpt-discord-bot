import { Bot, Interaction, InteractionResponseTypes, Message } from "@discordeno/bot";
import { CreateSlashApplicationCommand } from "@discordeno/types";
import { Environment } from "../../types/other.js";
import { OptionResolver } from "../handlers/OptionResolver.js";
import { MakeRequired } from "./bot.js";

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
	interaction: MakeRequired<Interaction, "data">;
	options: OptionResolver;
	env: Environment;
	premium: {
		type: "plan" | "subscription";
		location: "user" | "guild";
	} | null;
}

export interface MessageContext extends Omit<CommandContext, "interaction" | "options"> {
	message: Message;
	args: string[];
	bot: Bot;
}

export interface ButtonResponse {
	run: (interaction: MakeRequired<Interaction, "data">, data: Record<string, string>) => Promise<void>;
	args: string[];
	id: string;
	deferType?: InteractionResponseTypes.DeferredChannelMessageWithSource | InteractionResponseTypes.DeferredUpdateMessage;
	isPrivate?: boolean;
}
