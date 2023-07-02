export interface RateAction {
	emoji: string;
	value: number;
}

export const RateActions: RateAction[] = [
	{ emoji: "😖", value: 0.2 },
	{ emoji: "☹️",  value: 0.4 },
	{ emoji: "😐", value: 0.6 },
	{ emoji: "😀", value: 0.8 },
	{ emoji: "😍", value: 1.0 }
]