import dotenv from "dotenv";
dotenv.config();

import { Collection, createLogger } from "@discordeno/utils";
import RabbitMQ from "rabbitmq-client";
import { parentPort, workerData } from "worker_threads";
import type { WorkerCreateData, WorkerMessage } from "./types/worker.js";

import { DiscordenoShard } from "@discordeno/gateway";
import { BOT_TOKEN, INTENTS, RABBITMQ_URI, TOTAL_SHARDS } from "../config.js";

if (!parentPort) throw new Error("Parent port is null");

const parent = parentPort!;
const data: WorkerCreateData = workerData;

const logger = createLogger({ name: `[WORKER #${data.workerId}]` });
const identifyPromises = new Map<number, () => void>();

const connection = new RabbitMQ(RABBITMQ_URI);
const publisher = connection.createPublisher();

const shards = new Collection<number, DiscordenoShard>();

parent.on("message", async (data: WorkerMessage) => {
	switch (data.type) {
		case "IDENTIFY_SHARD": {
			logger.info(`[Shard] identifying ${shards.has(data.shardId) ? "existing" : "new"} shard (${data.shardId})`);
			const shard =
				shards.get(data.shardId) ??
				new DiscordenoShard({
					id: data.shardId,
					connection: {
						compress: false,
						intents: INTENTS,
						properties: {
							os: "linux",
							device: "Discordeno",
							browser: "Discordeno",
						},
						token: BOT_TOKEN,
						totalShards: TOTAL_SHARDS,
						url: "wss://gateway.discord.gg",
						version: 10,
					},
					events: {
						async message(shrd, payload) {
							publisher
								.send("gateway", {
									payload,
									shardId: shrd.id,
								})
								.catch(logger.error);
						},
					},
				});

			shards.set(shard.id, shard);
			await shard.identify();

			break;
		}

		case "ALLOW_IDENTIFY": {
			identifyPromises.get(data.shardId)?.();
			identifyPromises.delete(data.shardId);

			break;
		}
	}
});
