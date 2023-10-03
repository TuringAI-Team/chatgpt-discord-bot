import { BigString, Camelize, DiscordEmbed } from "@discordeno/bot";
import { CollectionNames } from "../../types/collections.js";
import { Command, CommandCooldown } from "../types/index.js";
import { getCache, getCollectionKey, setCache } from "./db.js";

export async function checkCooldown(
	userId: BigString,
	command: Command,
	type: keyof CommandCooldown,
): Promise<Camelize<DiscordEmbed>[] | undefined> {
	const has = await getCooldown(userId, command.body.name);
	if (has) return [];
	await setCooldown(userId, command.body.name, command.cooldown[type]);
}

export function getCooldown(userId: BigString, command: string) {
	const collection = getCollectionKey(CollectionNames.cooldowns, `${userId}-${command}`);
	return getCache(collection);
}

export async function setCooldown(userId: BigString, command: string, time: number) {
	if (time <= 0) return;
	const collection = getCollectionKey(CollectionNames.cooldowns, `${userId}-${command}`);
	await setCache(collection, "", time);
}
