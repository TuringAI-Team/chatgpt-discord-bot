import { GenericModel } from "./index.js";
import { Api } from "../api.js";

export type GenericParam = Parameters<Api["image"]["sh"]>[0];

const sdxl: GenericModel<GenericParam> = {
	id: "sdxl",
	name: "SDXL",
	from: {
		width: 1024,
		height: 1024,
	},
	to: {
		width: 1024,
		height: 1024,
	},
	run(api, data) {
		return api.image.sh({
			...data,
			model: "SDXL 1.0",
		});
	},
};

const albedobase: GenericModel<GenericParam> = {
	id: "albedobase",
	name: "AlbedoBase XL",
	from: {
		width: 1024,
		height: 1024,
	},
	to: {
		width: 1024,
		height: 1024,
	},
	run(api, data) {
		return api.image.sh({
			...data,
			model: "AlbedoBase XL (SDXL)",
		});
	},
};
const icbinp: GenericModel<GenericParam> = {
	id: "icbinp",
	name: "ICBINP XL",
	from: {
		width: 1024,
		height: 1024,
	},
	to: {
		width: 1024,
		height: 1024,
	},
	run(api, data) {
		return api.image.sh({
			...data,
			model: "ICBINP XL",
		});
	},
};

const turbo: GenericModel<GenericParam> = {
	id: "turboxl",
	name: "TURBO XL",
	from: {
		width: 1024,
		height: 1024,
	},
	to: {
		width: 1024,
		height: 1024,
	},
	run(api, data) {
		return api.image.sh({
			...data,
			model: "TURBO XL",
		});
	},
};
const fustercluck: GenericModel<GenericParam> = {
	id: "fustercluck",
	name: "Fustercluck",
	from: {
		width: 1024,
		height: 1024,
	},
	to: {
		width: 1024,
		height: 1024,
	},
	run(api, data) {
		return api.image.sh({
			...data,
			model: "Fustercluck",
			prompt: `${data.prompt}`,
		});
	},
};

export { sdxl, albedobase, icbinp, turbo, fustercluck };
