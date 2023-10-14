import {
	Interaction,
	Camelize,
	DiscordEmbed,
	CreateMessageOptions,
	InteractionResponseTypes,
	InteractionResponse,
	Bot,
	BigString,
	MessageComponents,
	MessageComponentTypes,
	ButtonStyles,
	Message,
} from "@discordeno/bot";
import { UUID, randomUUID } from "node:crypto";

export class EmbedPaginator {
	private message: Message | null = null;
	private components: MessageComponents;
	public id: UUID;
	private idx = 0;
	constructor(private data: EmbedPagesData) {
		this.id = randomUUID() as UUID;
		this.components = [
			{
				type: MessageComponentTypes.ActionRow,
				components: [
					{
						customId: `paginated_back_${this.id}`,
						label: "Back",
						style: ButtonStyles.Danger,
						type: MessageComponentTypes.Button,
					},
					{
						customId: `paginated_next_${this.id}`,
						label: "Next",
						style: ButtonStyles.Success,
						type: MessageComponentTypes.Button,
					},
				],
			},
		];
	}

	get by(): BigString {
		return this.data.ctx.id.toString();
	}

	get index() {
		return this.idx;
	}

	set index(idx: number) {
		if (idx > this.data.pages.length || idx < 0) idx = 0;
		this.idx = idx;
	}

	get from() {
		return this.message?.id;
	}

	handleButton(action: HandleAction) {
		switch (action) {
			case "next":
				return this.showPage((this.index += 1));
			case "back":
				return this.showPage((this.index -= 1));
		}
	}

	showPage(index = this.index) {
		const actual = this.data.pages[index];

		// why discordeno dont have interaction.udpate
		return interactionUpdate(this.data.ctx.bot, this.data.ctx.id, this.data.ctx.token, {
			type: InteractionResponseTypes.UpdateMessage,
			data: {
				embeds: actual.embeds,
				content: actual.content,
				components: actual.components.concat(this.components),
			},
		});
	}

	async init() {
		await this.editOrReply({ embeds: this.data.pages[0].embeds, components: this.components }).then(
			(m) => (this.message = m as Message),
		);
		this.data.ctx.bot.pages.set(this.id, this);
	}

	async editOrReply(data: CreateMessageOptions) {
		if (this.data.ctx.acknowledged) return this.data.ctx.edit(data);
		return (await this.data.ctx.respond(data)) ?? (await fetchReply(this.data.ctx.bot, this.data.ctx.token));
	}
}

export function interactionUpdate(bot: Bot, id: BigString, token: string, data: InteractionResponse) {
	return bot.helpers.sendInteractionResponse(id, token, data);
}

export function fetchReply(bot: Bot, token: string) {
	return bot.helpers.getOriginalInteractionResponse(token);
}

export interface EmbedPagesData {
	ctx: Interaction;
	pages: EmbedPage[];
}

export type EmbedPage = { embeds: SendEmbed[]; content: string; components: MessageComponents };

export type HandleAction = "next" | "back";

export type SendEmbed = Camelize<DiscordEmbed>;
