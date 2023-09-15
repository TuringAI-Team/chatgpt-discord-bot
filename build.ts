import fs from "node:fs";

const startTime = Date.now();
async function getFiles(dir: string): Promise<string[]> {
	const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		dirents.map((dirent) => {
			const res = dirent.name;
			const path = dir + "/" + res;
			return dirent.isDirectory() ? getFiles(path) : path;
		}),
	);
	return Array.prototype.concat(...files);
}

const result = await Bun.build({
	entrypoints: await getFiles("./src"),
	root: "./src",
	outdir: "./dist",
	target: "node",
	format: "esm",
});

let duration: string | number = Date.now() - startTime;
if (duration >= 1000) duration = `${duration / 1000}s`;
else duration = `${duration}ms`;

if (result.success) {
	console.log(`[${duration}] ✅ Build successful!`);
} else {
	console.log(result);
	console.log(`[${duration}] ❌ Build failed!`);
}
