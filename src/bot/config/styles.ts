type ImageStyle = {
	name: string;
	emoji: string;
	tags: string[];
	id: string;
}[];

export const imageStyles: ImageStyle = [
	{
		name: "Cinematic",
		emoji: "🎥",
		tags: ["cinematic shot", "dramatic lighting", "vignette", "4k rtx"],
		id: "cinematic",
	},
	{
		name: "Anime",
		emoji: "😊",
		tags: ["anime style", "anime", "sharp edges"],
		id: "anime",
	},
	{
		name: "Comic book",
		emoji: "✏️",
		tags: ["comic book"],
		id: "comic-book",
	},
	{
		name: "Pixel Art",
		emoji: "🤖",
		tags: ["pixel art", "voxel", "pixel style"],
		id: "pixel-art",
	},
	{
		name: "Photographic",
		emoji: "📸",
		tags: ["photographic", "realism", "realistic", "rtx"],
		id: "photographic",
	},
	{
		name: "Digital Art",
		emoji: "🖥️",
		tags: ["digital art", "digital art style"],
		id: "digital-art",
	},
	{
		name: "Line Art",
		emoji: "✏️",
		tags: ["line art", "line art style"],
		id: "line-art",
	},
	{
		name: "Analog film",
		emoji: "🎥",
		tags: ["analog film", "grain"],
		id: "analog-film",
	},
	{
		name: "3D Model",
		emoji: "📊",
		tags: ["3d model", "game engine render", "unreal engine"],
		id: "3d-model",
	},
	{
		name: "Origami",
		emoji: "🧻",
		tags: ["origami", "origami style", "paper"],
		id: "origami",
	},
	{
		name: "Neon Punk",
		emoji: "🌈",
		tags: ["neon punk", "neon style"],
		id: "neon-punk",
	},
	{
		name: "Isometric",
		emoji: "👀",
		tags: ["isometric", "game engine render", "isometric style"],
		id: "isometric",
	},
];
