import { ShardingManager } from "discord.js";
import "dotenv/config";
//import "./telegram/index.js";
const manager = new ShardingManager("./dist/bot.js", {
  token: process.env.TOKEN,
  respawn: true,
});

manager.on("shardCreate", (shard) => {
  let isRespawn = false;
  console.log(`Launched shard ${shard.id}`);
  // on error respawn
  shard.on("death", async (process) => {
    console.log(`Shard ${shard.id} died`);
    if (isRespawn) return;
    isRespawn = true;
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
manager.spawn({ amount: 64, timeout: 60000, delay: 5500 });
import "./whatsapp/index.js";
