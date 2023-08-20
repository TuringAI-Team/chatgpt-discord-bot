import type { RestrictionType } from "../utils/restriction.js";
import type { DBEnvironment } from "../../db/types/mod.js";
import type { MessageResponse } from "../utils/response.js";
import type { CustomInteraction } from "./discordeno.js";
import type { CommandCooldown } from "./command.js";
import type { DiscordBot } from "../mod.js";

enum InteractionHandlerType {
	Button
}

export interface InteractionHandlerOptions {
	bot: DiscordBot;
	interaction: CustomInteraction;
	args: string[];
	env: DBEnvironment;
}

export interface InteractionHandler {
    /** Name of the interaction */
    name: string;

	/** Restrictions of the interaction */
	restrictions?: RestrictionType[];

    /** Type of the interaction */
    type?: InteractionHandlerType;

    /** Cool-down of the interaction */
    cooldown?: CommandCooldown;

    /** Handler of the interaction */
    handler: (
        options: InteractionHandlerOptions
    ) => Promise<MessageResponse | void> | MessageResponse | void;
}