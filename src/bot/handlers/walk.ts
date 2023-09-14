import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export type ResolveImport<T> = { default?: T };

export async function walk(path: string) {
	const files = await readdir(path);
	const fileList: string[] = [];
	for (const file of files) {
		const filePath = join(path, file);
		const dir = await stat(filePath);
		if (dir.isDirectory()) fileList.push(...(await walk(filePath)));
		else fileList.push(filePath);
	}
	return fileList;
}
