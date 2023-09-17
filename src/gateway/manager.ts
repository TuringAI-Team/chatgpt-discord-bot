import { createGatewayManager } from "@discordeno/gateway";
import { Intents } from "@discordeno/types";
import { Collection, logger } from "@discordeno/utils";
import { Worker } from "worker_threads";
import { BOT_TOKEN, SHARDS_PER_WORKER, TOTAL_WORKERS } from "../config.js";
import { rest } from "./rest.js";
import { ManagerMessage } from "./types/manager.js";
import { WorkerCreateData, WorkerMessage } from "./types/worker.js";

const workers = new Collection<number, Worker>();
export const gateway = createGatewayManager({
	token: BOT_TOKEN,
	intents: Intents.Guilds | Intents.GuildMessages,
	//shardsPerWorker: SHARDS_PER_WORKER,
	//totalWorkers: TOTAL_WORKERS,
	totalShards: 288,
	lastShardId: 287,
	connection: await rest.getSessionInfo(),
	events: {},
});

gateway.tellWorkerToIdentify = async (workerId, shardId) => {
	let worker = workers.get(workerId);

	if (!worker) {
		worker = createWorker(workerId);
		workers.set(workerId, worker);
	}

	const identify: WorkerMessage = {
		type: "IDENTIFY_SHARD",
		shardId,
	};
	worker.postMessage(identify);
};

function createWorker(id: number) {
	if (id === 0) logger.info(`Identifying with ${gateway.totalShards} total shards`);
	logger.info(`Tell to identify shard #${id}`);

	const workerData: WorkerCreateData = {
		token: BOT_TOKEN,
		intents: gateway.intents ?? 0,
		totalShards: gateway.totalShards,
		workerId: id,
		path: "./worker.ts",
	};

	const worker = new Worker("./dist/gateway/worker.js", {
		workerData,
	});

	worker.on("message", async (data: ManagerMessage) => {
		switch (data.type) {
			case "REQUEST_IDENTIFY": {
				logger.info(`Requesting to identify shard #${data.shardId}`);
				await gateway.requestIdentify(data.shardId);

				worker.postMessage({
					type: "ALLOW_IDENTIFY",
					shardId: data.shardId,
				});

				break;
			}

			case "READY": {
				logger.info(`Shard #${data.shardId} is ready`);
				break;
			}
		}
	});

	return worker;
}

gateway.spawnShards();
