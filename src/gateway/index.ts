import dotenv from "dotenv";
dotenv.config();

import { Collection, createBot, createGatewayManager, createRestManager } from "discordeno";
import { createLogger } from "discordeno/logger";
import { Worker } from "worker_threads";

import { BOT_TOKEN, INTENTS, REST_AUTH, REST_URL, SHARDS_PER_WORKER, TOTAL_WORKERS } from "../config.js";
import type { WorkerCreateData, WorkerMessage } from "./worker.js";

const log = createLogger({ name: "[MANAGER]" });
const workers = new Collection<number, Worker>();

const bot = createBot({
	token: BOT_TOKEN
});

bot.rest = createRestManager({
	token: BOT_TOKEN,
	secretKey: REST_AUTH,
	customUrl: REST_URL
});

const gatewayBot = await bot.helpers.getGatewayBot();

const gateway = createGatewayManager({
	gatewayBot,

	gatewayConfig: {
		token: BOT_TOKEN, intents: INTENTS
	},

	shardsPerWorker: SHARDS_PER_WORKER,
	totalWorkers: TOTAL_WORKERS,

	handleDiscordPayload: () => {},

	tellWorkerToIdentify: async (_gateway, workerID, shardID, bucketID) => {
		let worker = workers.get(workerID);

		if (!worker) {
			worker = createWorker(workerID);
			workers.set(workerID, worker);
		}

		const identify: WorkerMessage = {
			type: "IDENTIFY_SHARD",
			shardID
		};

		worker.postMessage(identify);
	},
});

function createWorker(id: number) {
	if (id === 0) log.info(`Identifying with ${gateway.manager.totalShards} total shards`);
    log.info(`Tell to identify shard #${id}`);

	const workerData: WorkerCreateData = {
		token: BOT_TOKEN, intents: gateway.manager.gatewayConfig.intents ?? 0,
		totalShards: gateway.manager.totalShards,
		workerID: id, path: "./worker.ts"
	};

	const worker = new Worker("./build/gateway/worker.js", {
		workerData
	});

	worker.on("message", async (data: ManagerMessage) => {
		switch (data.type) {
			case "REQUEST_IDENTIFY": {
				log.info(`Requesting to identify shard #${data.shardID}`);
				await gateway.manager.requestIdentify(data.shardID);

				const allowIdentify: WorkerMessage = {
					type: "ALLOW_IDENTIFY",
					shardID: data.shardID
				};

				worker.postMessage(allowIdentify);
				break;
			}
		}
	});

	return worker;
}

gateway.spawnShards();

export type ManagerMessage = ManagerRequestIdentify

export interface ManagerRequestIdentify {
	type: "REQUEST_IDENTIFY";
	shardID: number;
}