import RabbitMQ from "rabbitmq-client";

import { CollectionName, DBEnvironment, DBObject, DBRequestData, DBRequestType, DBRequestUpdate, DBResponse, DBType } from "../db/types/mod.js";
import { RABBITMQ_URI } from "../config.js";

import type { DBGuild } from "../db/types/guild.js";
import type { DBUser } from "../db/types/user.js";

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

	return {
		rpc, execute, get, fetch, update,

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

		premium: (entry: DBUser | DBGuild) => {
			if (entry.subscription !== null && Date.now() > entry.subscription.expires) return "subscription";
			if (entry.plan !== null && entry.plan.total > entry.plan.used) return "plan";

			return null;
		},

		settings: (entry: DBUser | DBGuild) => {
			return entry.settings;
		}
	};
}