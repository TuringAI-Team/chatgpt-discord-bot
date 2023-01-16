import { ShardingManager } from "discord.js";
import "dotenv/config";
import { initTokens } from "./modules/loadbalancer";

const manager = new ShardingManager("./dist/bot.js", {
  token: process.env.TOKEN,
});

manager.on("shardCreate", (shard) => console.log(`Launched shard ${shard.id}`));
manager.spawn();
initTokens();
