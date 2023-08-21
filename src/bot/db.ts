import RabbitMQ from "rabbitmq-client";

import { CollectionName, DBEnvironment, DBObject, DBRequestData, DBRequestType, DBRequestUpdate, DBResponse, DBType } from "../db/types/mod.js";
import { RABBITMQ_URI } from "../config.js";

import type { DBGuild } from "../db/types/guild.js";
import { DBRole, DBUser } from "../db/types/user.js";

import { getSettingsValue } from "./settings.js";

export function createDB() {
	const connection = new RabbitMQ.Connection(RABBITMQ_URI);

	const rpc = connection.createRPCClient({
		confirm: true
	});

	const execute = async <T>(type: DBRequestType, body: Omit<DBRequestData, "type">): Promise<T> => {
		const data = await rpc.send("db", {
			type, ...body
		});

		const response: DBResponse = data.body;

		if (!response.success && response.error) throw new Error(response.error);
		return response.data;
	};

	const get = async<T = DBType> (collection: CollectionName, id: string | bigint): Promise<T | null> => {
		return await execute("get", {
			collection, id: id.toString()
		});
	};

	const fetch = async<T = DBType> (collection: CollectionName, id: string | bigint): Promise<T> => {
		return await execute("fetch", {
			collection, id: id.toString()
		});
	};

	const update = async<T = DBType> (collection: CollectionName, id: string | bigint | DBObject, updates: Partial<Omit<T, "id">>): Promise<T> => {
		return await execute("update", {
			collection, id: typeof id === "bigint" ? id.toString() : id, updates
		} as DBRequestUpdate);
	};

	const premium = (env: DBEnvironment): { type: "subscription" | "plan", location: "guild" | "user" } | null => {
		/* In which order to use the plans in */
		const locationPriority: "guild" | "user" = getSettingsValue(env.user, "premium:location_priority");

		/* Whether to prefer the Premium of the guild or user itself */
		const typePriority: "plan" | "subscription" = getSettingsValue(
			env.guild ? env[locationPriority]! : env.user, "premium:type_priority"
		);

		const checks: Record<typeof typePriority, (entry: DBGuild | DBUser) => boolean> = {
			subscription: entry => entry.subscription !== null && Date.now() > entry.subscription.expires,
			plan: entry => entry.plan !== null && entry.plan.total > entry.plan.used
		};

		const locations: typeof locationPriority[] = [ "guild", "user" ];
		const types: typeof typePriority[] = [ "plan", "subscription" ];

		if (locationPriority !== locations[0]) locations.reverse();
		if (typePriority !== types[0]) types.reverse();

		for (const type of types) {
			for (const location of locations) {
				const entry = env[location];
				if (!entry) continue;

				if (checks[type](entry)) return {
					location, type
				};
			}
		}

		return null;
	};

	const voted = (user: DBUser) => {
		if (!user.voted) return null;
		if (Date.now() - Date.parse(user.voted) > 12.5 * 60 * 60 * 1000) return null;

		return Date.parse(user.voted);
	};

	return { 
		rpc, execute, get, fetch, update, premium, voted,

		env: async (user: bigint, guild?: bigint): Promise<DBEnvironment> => {
			const data: Partial<DBEnvironment> = {};

			await Promise.all([
				new Promise<void>(resolve => {
					fetch<DBUser>("users", user).then(user => {
						data.user = user;
						resolve();
					});
				}),

				new Promise<void>(resolve => {
					if (guild) fetch<DBGuild>("guilds", guild).then(guild => {
						data.guild = guild;
						resolve();
					});
					else resolve();
				})
			]);

			return data as DBEnvironment;
		},

		icon: (env: DBEnvironment) => {
			if (env.user.roles.includes(DBRole.Moderator)) return "⚒️";
			const p = premium(env);

			if (p) {
				if (p.type === "plan" && p.location === "user") return "📊";
				if (p.type === "subscription" && p.location === "user") return "✨";
				if (p.location === "guild") return "💫";
			}

			const votedAt = voted(env.user);

			if (votedAt) {
				if ((votedAt + 12.5 * 60 * 60 * 1000) - Date.now() < 30 * 60 * 1000) return "📩";
				else return "✉️";
			}

			return "👤";
		}
	};
}