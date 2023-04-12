import { ShardingManager } from "discord.js";
import "dotenv/config";
//import "./telegram/index.js";
const manager = new ShardingManager("./dist/bot.js", {
  token: process.env.TOKEN,
  respawn: true,
  totalShards: "auto",
});

manager.on("shardCreate", (shard) => {
  console.log(`Launched shard ${shard.id}`);
  // on error respawn
  shard.on("death", async () => {
    console.log(`Shard ${shard.id} died`);
    await shard.respawn();
  });
  shard.on("error", async (error) => {
    console.log(`Shard ${shard.id} error: ${error}`);
    await shard.respawn();
  });
  shard.on("disconnect", async () => {
    console.log(`Shard ${shard.id} disconnected`);
    await shard.respawn();
  });

  shard.on("ready", () => {
    console.log(`Shard ${shard.id} ready`);
  });
});
manager.spawn({ amount: "auto", timeout: 60000, delay: 5500 });
import "./whatsapp/index.js";
