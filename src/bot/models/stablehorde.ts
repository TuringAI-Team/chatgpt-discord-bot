import { ImageModelFromTo, StableHordeModel } from "./index.js";

export default {
	name: "Stable Horde",
	models: {
		"majicMIX realistic": {
			id: "majicMIX_realistic",
			from: {
				width: 512,
				height: 512,
			},
			to: {
				width: 1024,
				height: 1024,
			},
		},
		Deliberate: {
			id: "deliberate",
			from: {
				width: 512,
				height: 512,
			},
			to: {
				width: 1024,
				height: 1024,
			},
		},
		"OpenJourney Diffusion": {
			id: "openjourney_diffusion",
			from: {
				width: 512,
				height: 512,
			},
			to: {
				width: 1024,
				height: 1024,
			},
		},
	},
	run: (api, data) => api.image.sh(data),
} satisfies StableHordeModel<{
	"majicMIX realistic": ImageModelFromTo;
	Deliberate: ImageModelFromTo;
	"OpenJourney Diffusion": ImageModelFromTo;
}>;
