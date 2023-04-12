import { createClient, defineScript } from "redis";

const redisClient = createClient({
  password: process.env.REDIS_PASSWORD || "password",
  socket: {
    host: process.env.REDIS_HOST || "localhost",
    port: 15266,
  },
});

redisClient.on("error", (err) => console.log("Client error: Redis", err));

await redisClient.connect();

export default redisClient;
