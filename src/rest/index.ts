import dotenv from "dotenv";
dotenv.config();

import { BASE_URL, RequestMethod, createRestManager } from "discordeno";
import { createLogger } from "discordeno/logger";
import express from "express";

import { BOT_TOKEN, REST_URL, REST_PORT, HTTP_AUTH } from "../config.js";

const logger = createLogger({ name: "[REST]" });

const rest = createRestManager({
	token: BOT_TOKEN,
	secretKey: HTTP_AUTH,
	customUrl: REST_URL
});

const app = express();

app.use(
	express.urlencoded({
		extended: true
	})
);

app.use(express.json());

app.all("/*", async (req, res) => {
	if (HTTP_AUTH !== req.headers.authorization) {
		return res.status(401).json({ error: "Invalid authorization" });
	}

	try {
		const result = await rest.runMethod(
			rest, req.method as RequestMethod, `${BASE_URL}${req.url}`, req.body
		);

		logger.info(req.method, req.url);

		if (result) res.status(200).json(result);
		else res.status(204).json();

	} catch (error) {
		res.status(500).json(error);
	}
});

app.listen(REST_PORT, () => {
	logger.info("Started.");
});