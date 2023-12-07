import { GenericModel } from "./index.js";
import { Api } from "../api.js";
export type GenericParam = Parameters<Api["image"]["fast_sdxl"]>[0];

export default {
	id: "fast_sdxl",
	name: "Fast SDXL",
	from: {
		width: 1024,
		height: 1024,
	},
	to: {
		width: 1024,
		height: 1024,
	},
	run: (api, data) => api.image.fast_sdxl(data),
} satisfies GenericModel<GenericParam>;
