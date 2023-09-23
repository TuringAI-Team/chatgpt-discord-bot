import { UpscalerModel } from "./index.js";

export default {
	name: "Upscalers",
	run: (api, data) => api.image.upscale(data),
} satisfies UpscalerModel;
