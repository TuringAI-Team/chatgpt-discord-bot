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

interface RESTError {
	ok: boolean;
	status: number;
	error: string;
	body: string;
}

// @ts-expect-error Missing property
rest.convertRestError = (errorStack, data) => {
	if (!data) return { message: errorStack.message };
	return { ...data, message: errorStack.message };
};

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
		if (req.body.file) {
			req.body.file.blob = base64ToBlob(req.body.file.blob);
		}

		const result = await rest.runMethod(
			rest, req.method as RequestMethod, `${BASE_URL}${req.url}`, req.body
		);

		logger.info(req.method, req.url);

		if (result) res.status(200).json(result);
		else res.status(204).json();

	} catch (err) {
		const error = err as RESTError;

		logger.error(req.method, req.url, `status code ${error.status} ->`, error.error);
		res.status(error.status).json(error);
	}
});

function base64ToBlob(base64: string, contentType: string = "", sliceSize: number = 512): Blob {
	const byteCharacters = Buffer.from(base64, "base64").toString();
	const byteArrays = [];

	for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
		const slice = byteCharacters.slice(offset, offset + sliceSize);

		const byteNumbers = new Array(slice.length);
		for (let i = 0; i < slice.length; i++) {
			byteNumbers[i] = slice.charCodeAt(i);
		}

		const byteArray = new Uint8Array(byteNumbers);
		byteArrays.push(byteArray);
	}

	return new Blob(byteArrays, { type: contentType });
}

app.listen(REST_PORT, () => {
	logger.info("Started.");
});