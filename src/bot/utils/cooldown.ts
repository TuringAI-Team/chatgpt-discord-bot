import { Collection, type Embed } from "discordeno";

import { EmbedColor, type MessageResponse } from "./response.js";
import type { CustomInteraction } from "../types/discordeno.js";
import type { Conversation } from "../types/conversation.js";
import { advertisement } from "../campaign.js";

type CooldownTarget = Conversation | CustomInteraction

/** Global command cool-downs */
const cooldowns: Collection<string, number> = new Collection();

export function cooldownNotice(target: CooldownTarget): MessageResponse {
	const cooldown = getCooldown(target);
	const ad = advertisement();

	const response: MessageResponse = {
		ephemeral: true
	};

	const embeds: Embed[] = [
		{
			title: "Whoa-whoa... slow down ⌛",
			description: `This action is currently on cool-down; you can use it again <t:${Math.floor(cooldown!.when / 1000)}:R>.`,
			color: EmbedColor.Yellow
		}
	];

	if (ad) {
		embeds.push(ad.response.embed);
		response.components = [ ad.response.row ];
	}

	response.embeds = embeds;
	return response;
}

export function getCooldown(target: CooldownTarget) {
	const existing = cooldowns.get(cooldownKey(target)) ?? null;
	if (!existing || existing < Date.now()) return null;

	return {
		remaining: existing - Date.now(), when: existing
	};
}

export function hasCooldown(target: CooldownTarget) {
	return getCooldown(target) !== null;
}

export function setCooldown(target: CooldownTarget, duration: number) {
	cooldowns.set(cooldownKey(target), Date.now() + duration);
}

function cooldownKey(target: CooldownTarget) {
	if (isConversationTarget(target)) return target.id;
	else return `${target.user.id}-${target.data?.name}`;
}

function isConversationTarget(target: CooldownTarget): target is Conversation {
	return !!(target as Conversation).history;
}