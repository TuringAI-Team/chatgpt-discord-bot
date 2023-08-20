import RabbitMQ from "rabbitmq-client";

import { CollectionName, DBObject, DBRequestData, DBRequestType, DBRequestUpdate, DBResponse, DBType } from "../../db/types/index.js";
import { RABBITMQ_URI } from "../../config.js";

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

	return {
		rpc, execute,

		get: async<T extends DBType> (collection: CollectionName, id: string | bigint): Promise<T | null> => {
			return await execute("get", {
				collection, id: id.toString()
			});
		},

		fetch: async<T extends DBType> (collection: CollectionName, id: string | bigint): Promise<T> => {
			return await execute("fetch", {
				collection, id: id.toString()
			});
		},

		update: async<T extends DBType> (collection: CollectionName, id: string | bigint | DBObject, updates: Partial<Omit<T, "id">>): Promise<T> => {
			return await execute("update", {
				collection, id: typeof id === "bigint" ? id.toString() : id, updates
			} as DBRequestUpdate);
		}
	};
}