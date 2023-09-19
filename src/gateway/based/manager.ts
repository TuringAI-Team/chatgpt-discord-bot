import { ShardState, createGatewayManager, createLogger, delay } from "@discordeno/bot";
import { join } from "node:path";
import { Worker } from "worker_threads";
import config from "../../config.js";
import { rest } from "../rest.js";
import { WorkerCreateData } from "../types/worker.js";

/**
 * In case the current ws explodes, I will write this little by little
 */

const logger = createLogger({ name: "[GatewayManager]" });

const connection = await rest.getGatewayBot();

const workers = new Map<number, Worker>();
const pongs = new Map<string, (data: NonNullable<unknown>) => void>();

const concurrency = (shardId: number) => shardId % connection.sessionStartLimit.maxConcurrency;

const gateway = createGatewayManager({
	connection,
	compress: false,
	events: {},
	token: config.bot.token,
	intents: config.gateway.intents,
	totalShards: connection.shards,
	lastShardId: connection.shards - 1,
	shardsPerWorker: config.gateway.shardsPerWorker,
	totalWorkers: Math.ceil(connection.shards / config.gateway.shardsPerWorker),
});

gateway.tellWorkerToIdentify = async (workerId, shardId, bucketId) => {
	logger.info(`Tell worker #${workerId} with shard ${shardId} in bucket ${bucketId}`);

	let worker = workers.get(workerId);
	if (!worker) {
		worker = createWorker(workerId);
		workers.set(workerId, worker);
	}

	const bucket = gateway.buckets.get(concurrency(shardId));
	if (!bucket) return;

	return await new Promise((resolve) => {
		bucket.identifyRequests.push(resolve);
		worker?.postMessage({
			type: "IDENTIFY_SHARD",
			shardId,
			connection: {
				intents: gateway.intents,
				token: gateway.token,
				totalShards: gateway.totalShards,
				compress: false,
				url: gateway.connection.url,
				version: gateway.version,
				properties: gateway.properties,
			},
		});
	});
};

export function createWorker(workerId: number): Worker {
	const data: WorkerCreateData = {
		intents: config.gateway.intents,
		token: config.bot.token,
		path: `${join(process.cwd(), "dist", "gateway", "based", "worker")}.js`,
		totalShards: connection.shards,
		workerId,
	};

	const worker = new Worker(`${join(process.cwd(), "dist", "gateway", "based", "worker")}.js`, { workerData: data });

	worker.on("message", (data) => workerListener(worker, data));

	return worker;
}

export async function workerListener(worker: Worker, data: MessageFromWorker) {
	switch (data.type) {
		case "SHARD_ON":
			await delay(gateway.spawnShardDelay);
			logger.info(`Resolving ${data.shardId} shard ready`);
			gateway.buckets.get(concurrency(data.shardId))?.identifyRequests.shift()?.();
			logger.info(`Shard ${data.shardId} identify`);
			break;
		case "TO_IDENTIFY":
			logger.info("Rquest identify #", data.shardId);
			await gateway.requestIdentify(data.shardId);
			worker.postMessage({ type: "ALLOW_IDENTIFY", shardId: data.shardId });
			break;
		case "PONG_REPLY":
			pongs.get(data.pong)?.(data.data);
	}
}

gateway.spawnShards();

export type MessageFromWorker = ShardReady | RequestIdentify | PongReply<WorkerShardInfo[]>;

export interface ShardReady {
	type: "SHARD_ON";
	shardId: number;
}

export interface RequestIdentify {
	type: "TO_IDENTIFY";
	shardId: number;
}

export interface PongReply<T> {
	type: "PONG_REPLY";
	pong: string;
	data: T;
}

export interface WorkerShardInfo {
	workerId: number;
	shardId: number;
	rtt: number;
	state: ShardState;
}
