/**
 * In case the current ws explodes, I will write this little by little
 */
import { createLogger, ShardState, delay, createRestManager, createGatewayManager } from "@discordeno/bot";
import { rest } from "../rest.js";
import { Worker } from "worker_threads";
import config from "../../config.js";
import { WorkerCreateData } from "../types/worker.js";
import { join } from "node:path";

const logger = createLogger({ name: "[GatewayManager]" });

const connection = await rest.getGatewayBot();

const workers = new Map<number, Worker>();
const pongs = new Map<string, (data: NonNullable<unknown>) => void>();

const gateway = createGatewayManager({
    connection, compress: false,
    events: {},
    token: config.bot.token,
    intents: config.gateway.intents,
    totalShards: connection.shards,
    lastShardId: connection.shards - 1,
    shardsPerWorker: config.gateway.shardsPerWorker,
    totalWorkers: Math.ceil(connection.shards / config.gateway.shardsPerWorker),
});

gateway.tellWorkerToIdentify = async (workerId, shardId, bucketId) => {
    logger.debug("Tell worker", { workerId, shardId, bucketId });

    let worker = workers.get(workerId);
    if (!worker) {
        worker = createWorker(workerId);
        workers.set(worker);
    }
};

export function createWorker(workerId: number): Worker {
    const data: WorkerCreateData = {
        intents: config.gateway.intents,
        token: config.bot.token,
        path: "./worker.ts",
        totalShards: connection.shards,
        workerId,
    };

    const worker = new Worker(`${join(process.cwd(), "dist", "src", "gateway", "based", "worker")}.js`, { workerData: data });

    worker.on('message', (data) => workerListerner(worker, data));

    return worker;
}

export async function workerListerner(worker: Worker, data: MessageFromWorker) {
    switch (data.type) {
        case "SHARD_ON":
            await delay(gateway.spawnShardDelay);
            logger.info('Resolving shard ready');
            gateway.buckets.get(data.shardId % connection.sessionStartLimit.maxConcurrency)!.identifyRequests.shift()?.();
            break;
        case "TO_IDENTIFY":
            logger.info('Rquest identify #', data.shardId);
            await gateway.requestIdentify(data.shardId);
            worker.postMessage({ type: 'ALLOW_IDENTIFY', shardId: data.shardId });
            break;
        case "PONG_REPLY":
            pongs.get(data.pong)?.(data.data);
    }
}

export type MessageFromWorker = ShardReady | RequestIdentify | PongReply<WorkerShardInfo[]>;

export interface ShardReady {
    type: 'SHARD_ON',
    shardId: number;
}

export interface RequestIdentify {
    type: 'TO_IDENTIFY',
    shardId: number;
}

export interface PongReply<T> {
    type: 'PONG_REPLY',
    pong: string;
    data: T;
}

export interface WorkerShardInfo {
    workerId: number;
    shardId: number;
    rtt: number;
    state: ShardState;
}
