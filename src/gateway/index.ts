import { logger } from "@discordeno/utils";
import dotenv from "dotenv";
import express from "express";
import { gateway } from "./manager.js";
import { GATEWAY_AUTH, GATEWAY_PORT } from "../config.js";
dotenv.config();

const app = express();

app.use(
	express.urlencoded({
		extended: true,
	}),
);

app.use(express.json());

app.all("/*", async (req: any, res: any) => {
	if (!GATEWAY_AUTH || GATEWAY_AUTH !== req.headers.authorization) {
		return res.status(401).json({ error: "Invalid authorization key." });
	}

	try {
		switch (req.body.type) {
			case "REQUEST_MEMBERS": {
				return await gateway.requestMembers(req.body.guildId, req.body.options);
			}
			default:
				logger.error(`[Shard] Unknown request received. ${JSON.stringify(req.body)}`);
				return res.status(404).json({ message: "Unknown request received.", status: 404 });
		}
	} catch (error: any) {
		console.log(error);
		res.status(500).json(error);
	}
});

app.listen(GATEWAY_PORT, () => {
	logger.info("Gateway started");
});
