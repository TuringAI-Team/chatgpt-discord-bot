import { ShardingManager } from "discord.js";
import "dotenv/config";
//import "./telegram/index.js";
const manager = new ShardingManager("./dist/bot.js", {
  token: process.env.TOKEN,
  respawn: true,
  totalShards: "auto",
});

manager.on("shardCreate", (shard) => console.log(`Launched shard ${shard.id}`));
manager.spawn({ amount: "auto", timeout: 60000, delay: 5500 });
import "./whatsapp/index.js";
