import { ShardingManager } from "discord.js";
import "dotenv/config";
//import "./telegram/index.js";

const manager = new ShardingManager("./dist/bot.js", {
  token: process.env.TOKEN,
});

manager.on("shardCreate", (shard) => console.log(`Launched shard ${shard.id}`));
manager.spawn();

import "./whatsapp/index.js";
