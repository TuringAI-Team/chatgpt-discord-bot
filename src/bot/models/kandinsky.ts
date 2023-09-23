import { KandinskyModel } from "./index.js";

export default {
	name: "Kandinsky",
	from: {
		width: 512,
		height: 512,
	},
	to: {
		width: 1024,
		height: 1024,
	},
	run: (api, data) => api.image.kandinsky(data),
} satisfies KandinskyModel;
