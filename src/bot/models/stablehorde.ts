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
		return api.image.sh(data);
	},
};

const OpenJourneyDiffussion: GenericModel<GenericParam> = {
	id: "openjourney_diffusion",
	name: "OpenJourney Diffusion",
	from: {
		width: 512,
		height: 512,
	},
	to: {
		width: 1024,
		height: 1024,
	},
	run(api, data) {
		return api.image.sh(data);
	},
};

const Deliberate: GenericModel<GenericParam> = {
	id: "deliberate",
	name: "Deliberate",
	from: {
		width: 512,
		height: 512,
	},
	to: {
		width: 1024,
		height: 1024,
	},
	run(api, data) {
		return api.image.sh(data);
	},
};

const majicMIXR: GenericModel<GenericParam> = {
	id: "majicMIX_realistic",
	name: "majicMIX realistic",
	from: {
		width: 512,
		height: 512,
	},
	to: {
		width: 1024,
		height: 1024,
	},
	run(api, data) {
		return api.image.sh(data);
	},
};

export { majicMIXR, Deliberate, OpenJourneyDiffussion, sdxl };
