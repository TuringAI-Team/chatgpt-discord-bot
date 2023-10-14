export interface Campaign {
	id: string;
	name: string;
	created: Date;
	active: boolean;
	members: string[];
	filters: {
		[key: string]: string[];
	};
	link: string;
	settings: {
		color?: string;
		image?: string;
		title?: string;
		thumbnail?: string;
		description?: string;
		buttons?: {
			id: string;
			emoji?: string;
			label: string;
			style?: string;
		}[];
	};
	stats: {
		views: {
			geo: {
				[country: string]: number;
			};
			total: number;
		};
		clicks: {
			geo: {
				[country: string]: number;
			};
			total: number;
		};
	};
	budget: {
		cost: number;
		type: "view" | "click";
		used: number;
		total: number;
	};
	logs: {
		who: string;
		data?: {
			active?: boolean;
			name?: string;
			newValue?: string;
			oldValue?: string;
		};
		when: number;
		action: "toggle" | "updateValue";
	};
}
