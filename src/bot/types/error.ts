import { EmbedColor } from "../utils/response.js";

interface ResponseErrorOptions {
	/** Which message to display */
	message: string;

	/** Which emoji to use */
	emoji?: string;

	/** Which embed color to use */
	color?: EmbedColor;
}

export class ResponseError extends Error {
	public readonly options: Required<ResponseErrorOptions>;

	constructor(options: ResponseErrorOptions) {
		super(options.message);

		this.options = {
			color: EmbedColor.Red, emoji: "❌",
			...options
		};
	}
}