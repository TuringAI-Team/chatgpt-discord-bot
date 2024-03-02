import { ImageVisionModel } from "./index.js";

export default {
	id: "vision",
	name: "Image Vision",
	premium: false,
	run: (api, data) =>
		api.image.vision({
			...data,
			model: ["gemini"],
		}),
} satisfies ImageVisionModel;
