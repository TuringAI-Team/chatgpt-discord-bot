export interface RateAction {
	icon: string;
	value: number;
}

export const RateActions: RateAction[] = [
	{ icon: "😖", value: 0.2 },
	{ icon: "☹️",  value: 0.4 },
	{ icon: "😐", value: 0.6 },
	{ icon: "😀", value: 0.8 },
	{ icon: "😍", value: 1.0 }
]