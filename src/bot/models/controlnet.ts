import { ControlNetModel } from "./index.js";

export default {
	name: "ControlNet",
	run: (api, data) => api.image.controlnet(data),
} satisfies ControlNetModel;
