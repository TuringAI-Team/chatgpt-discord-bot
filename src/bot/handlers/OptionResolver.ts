import {
	ApplicationCommandOptionTypes,
	Attachment,
	BigString,
	ChannelTypes,
	InteractionDataOption,
	InteractionDataResolved,
	Member,
	Role,
	User,
} from "@discordeno/bot";

export class OptionResolver {
	hoistedOptions: ReturnType<OptionResolver["transformOption"]>[];
	options: ReturnType<OptionResolver["transformOption"]>[];
	group: string | null = null;
	subCommand: string | null = null;
	constructor(options: InteractionDataOption[], public resolved: InteractionDataResolved) {
		this.options = options.map((op) => this.transformOption(op, resolved));
		this.hoistedOptions = this.options;

		if (this.hoistedOptions[0]?.type === ApplicationCommandOptionTypes.SubCommandGroup) {
			this.group = this.hoistedOptions[0].name;
			this.hoistedOptions = this.hoistedOptions[0].options ?? [];
		}

		if (this.hoistedOptions[0]?.type === ApplicationCommandOptionTypes.SubCommand) {
			this.subCommand = this.hoistedOptions[0].name;
			this.hoistedOptions = this.hoistedOptions[0].options ?? [];
		}
	}

	get(name: string) {
		return this.hoistedOptions.find((opt) => opt.name === name);
	}

	getSubCommand() {
		return this.subCommand;
	}

	getSubCommandGroup() {
		return this.group;
	}

	private getTypedOption(name: string, allow: ApplicationCommandOptionTypes[]) {
		const option = this.get(name);
		if (!option) return;
		if (!option) return;
		if (!allow.includes(option.type)) return;
		return option;
	}

	getBoolean(name: string, required?: true): boolean;
	getBoolean(name: string): boolean | null {
		const option = this.getTypedOption(name, [ApplicationCommandOptionTypes.Boolean]);
		return (option?.value as boolean) ?? null;
	}

	getChannel<T extends ChannelTypes = ChannelTypes>(name: string, required?: true): ChannelResolved<T>;
	getChannel<T extends ChannelTypes = ChannelTypes>(name: string): ChannelResolved<T> | null {
		const option = this.getTypedOption(name, [ApplicationCommandOptionTypes.Channel]);
		return (option?.channel as ChannelResolved<T>) ?? null;
	}

	getString(name: string, required?: true): string;
	getString(name: string): string | null {
		const option = this.getTypedOption(name, [ApplicationCommandOptionTypes.String]);
		return (option?.value as string) ?? null;
	}

	getNumber(name: string, required?: true): number;
	getNumber(name: string): number | null {
		const option = this.getTypedOption(name, [ApplicationCommandOptionTypes.Number]);
		return (option?.value as number) ?? null;
	}

	getUser(name: string, required?: true): User;
	getUser(name: string): User | null {
		const option = this.getTypedOption(name, [ApplicationCommandOptionTypes.Mentionable, ApplicationCommandOptionTypes.User]);
		return option?.user ?? null;
	}
	getMember(name: string, required?: true): Member;
	getMember(name: string): Member | null {
		const option = this.getTypedOption(name, [ApplicationCommandOptionTypes.Mentionable, ApplicationCommandOptionTypes.User]);
		return option?.member ?? null;
	}
	getRole(name: string, required?: true): Role;
	getRole(name: string): Role | null {
		const option = this.getTypedOption(name, [ApplicationCommandOptionTypes.Mentionable, ApplicationCommandOptionTypes.Role]);
		return option?.role ?? null;
	}
	getAttachment(name: string, required?: true): Attachment;
	getAttachment(name: string): Attachment | null {
		const option = this.getTypedOption(name, [ApplicationCommandOptionTypes.Mentionable, ApplicationCommandOptionTypes.User]);
		return option?.attachment ?? null;
	}

	// biome-ignore lint/nursery/noExcessiveComplexity: owo
	transformOption(option: InteractionDataOption, resolved: InteractionDataResolved): OptionResult {
		const result: OptionResult = {
			name: option.name,
			type: option.type,
		};

		if ("value" in option) result.value = option.value;
		if ("options" in option) result.options = option.options?.map((opt) => this.transformOption(opt, resolved));

		if (resolved) {
			const user = resolved.users?.get(option.value as unknown as bigint);
			if (user) result.user = user;

			const member = resolved.members?.get(option.value as unknown as bigint);
			if (member) result.member = member;

			const channel = resolved.channels?.get(option.value as unknown as bigint);
			if (channel) result.channel = channel;

			const role = resolved.roles?.get(option.value as unknown as bigint);
			if (role) result.role = role;

			const attachment = resolved.attachments?.get(option.value as unknown as bigint);
			if (attachment) result.attachment = attachment;
		}

		return result;
	}
}

export interface OptionResult {
	name: string;
	type: ApplicationCommandOptionTypes;
	value?: string | number | boolean;
	options?: OptionResult[];
	user?: User;
	member?: Member;
	attachment?: Attachment;
	channel?: ChannelResolved<ChannelTypes>;
	role?: Role;
}

export interface ChannelResolved<T extends ChannelTypes> {
	id: BigString;
	name: string;
	type: T;
	permissions: BigString;
}
