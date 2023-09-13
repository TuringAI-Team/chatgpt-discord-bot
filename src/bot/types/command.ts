import { Interaction } from "@discordeno/bot";
import { CreateSlashApplicationCommand } from "@discordeno/types";

export type Command = {
	cooldown: {
		user: number;
		voter: number;
		subscription: number;
	};
	execute: (interaction: Interaction) => Promise<void>;
} & CreateSlashApplicationCommand;
