import { ImageVisionModel } from "./index.js";

export default {
	name: "Image Vision",
	run: (api, data) => api.image.vision(data),
} satisfies ImageVisionModel;
