export const ProgressBlocks: Record<number, string> = {
	1: "█",
	0.875: "▉",
	0.75: "▊",
	0.625: "▋",
	0.5: "▌",
	0.375: "▍",
	0.25: "▎",
	0.125: "▏"
};

export interface BarDisplayOptions {
    /* Total amount of characters to display */
    total?: number;

    /* Percentage to display the bar for */
    percentage: number;
}

export function displayBar(options: BarDisplayOptions) {
	const { total, percentage }: Required<BarDisplayOptions> = {
		percentage: options.percentage,
		total: options.total ?? 20
	};

	/* Calculate how many full blocks to display. */
	const blocks: number = Math.min(total - 1, Math.floor(percentage * total));

	/* Which partial block to display, if any */
	const remainder = percentage * total - blocks;
	let partialBlock: string = "";

	for (const [ num, block ] of Object.entries(ProgressBlocks)) {
		if (remainder >= parseFloat(num)) partialBlock = block;
	}

	return `[${ProgressBlocks[1].repeat(blocks)}${partialBlock}${" ".repeat(total - blocks - partialBlock.length)}]`;
}