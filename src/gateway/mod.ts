import dotenv from "dotenv";
dotenv.config();

import { Collection, createBot, createGatewayManager, createRestManager } from "discordeno";
import { createLogger } from "discordeno/logger";
import { Worker } from "worker_threads";
import express from "express";

import { BOT_TOKEN, INTENTS, HTTP_AUTH, REST_URL, SHARDS_PER_WORKER, TOTAL_WORKERS, GATEWAY_PORT } from "../config.js";
import { ManagerHTTPRequest, ManagerMessage } from "./types/manager.js";
import type { WorkerCreateData } from "./types/worker.js";

const logger = createLogger({ name: "[MANAGER]" });
const workers = new Collection<number, Worker>();

const app = express();

app.use(
	express.urlencoded({
		extended: true
	})
);

app.use(express.json());

const bot = createBot({
	token: BOT_TOKEN
});

bot.rest = createRestManager({
	token: BOT_TOKEN,
	secretKey: HTTP_AUTH,
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

	tellWorkerToIdentify: async (_gateway, workerID, shardID) => {
		let worker = workers.get(workerID);

		if (!worker) {
			worker = createWorker(workerID);
			workers.set(workerID, worker);
		}

		worker.postMessage({
			type: "IDENTIFY_SHARD",
			shardID
		});
	}
});

function createWorker(id: number) {
	if (id === 0) logger.info(`Identifying with ${gateway.manager.totalShards} total shards`);
	logger.info(`Tell to identify shard #${id}`);

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
				logger.info(`Requesting to identify shard #${data.shardID}`);
				await gateway.manager.requestIdentify(data.shardID);

				worker.postMessage({
					type: "ALLOW_IDENTIFY",
					shardID: data.shardID
				});

				break;
			}

			case "READY": {
				logger.info(`Shard #${data.shardID} is ready`);
				break;
			}
		}
	});

	return worker;
}

gateway.spawnShards();

app.all("/*", async (req, res) => {
	if (HTTP_AUTH !== req.headers.authorization) {
		return res.status(401).json({ error: "Invalid authorization" });
	}

	try {
		const data = req.body as ManagerHTTPRequest;

		switch (data.type) {
			case "SHARD_PAYLOAD": {
				for (const worker of workers.values()) {
					worker.postMessage(data);
				}
				
				break;
			}
		}

		return res.status(200).json({ processing: true });
	} catch (error) {
		return res.status(500).json({
			processing: false, error: (error as Error).toString()
		});
	}
});

app.listen(GATEWAY_PORT, () => {
	logger.info("Started HTTP server.");
});