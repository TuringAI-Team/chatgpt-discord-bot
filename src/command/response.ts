import { EmbedBuilder, ComponentBuilder, Message, InteractionReplyOptions, TextChannel, AttachmentBuilder, MessageCreateOptions, CommandInteraction, MessageComponentInteraction, DMChannel, InteractionResponse, ThreadChannel, MessageEditOptions, InteractionUpdateOptions, ButtonInteraction, ModalSubmitInteraction, MessageReplyOptions } from "discord.js";
import { APIActionRowComponent, APIActionRowComponentTypes } from "discord-api-types/v10";

type Component = APIActionRowComponentTypes | APIActionRowComponent<APIActionRowComponentTypes>

export type ResponseSendClass = MessageComponentInteraction | CommandInteraction | ModalSubmitInteraction | Message | TextChannel | DMChannel | ThreadChannel
export type ResponseSendOptions = InteractionReplyOptions | InteractionUpdateOptions | MessageCreateOptions | MessageEditOptions | string

export class Response {
	/* Content of the message */
	public content: string | null;

	/* Embed of the message */
	public embeds: EmbedBuilder[];

	/* Attachments of the message */
	public attachments: AttachmentBuilder[];

	/* Components of the message */
	public components: Component[];

    /* Whether the response is only visible to the user */
    public ephemeral: boolean;

	constructor() {
        this.ephemeral = false;
		this.attachments = [];
		this.components = [];
		this.content = null;
		this.embeds = [];
	}

	public setContent(content: string | null): this {
		this.content = content;
		return this;
	}

	public addEmbed(builder: ((embed: EmbedBuilder) => EmbedBuilder) | EmbedBuilder): this {
		this.embeds.push(typeof builder === "function" ? builder(new EmbedBuilder()) : builder);
		return this;
	}

	public addEmbeds(builders: (((embed: EmbedBuilder) => EmbedBuilder) | EmbedBuilder)[]): this {
		this.embeds.push(
			...builders.map(builder => typeof builder === "function" ? builder(new EmbedBuilder()) : builder)
		);
		
		return this;
	}

	public addAttachment(attachment: AttachmentBuilder): this {
		this.attachments.push(attachment);
		return this;
	}

	public addComponent<T extends ComponentBuilder>(type: { new(): T }, builder: ((component: T) => T) | T): this {		
		this.components.push((typeof builder === "function" ? builder(new type()) : builder).toJSON());
		return this;
	}

	public setEphemeral(ephemeral: boolean): this {
		this.ephemeral = ephemeral;
		return this;
	}

	public get<T extends ResponseSendOptions = ResponseSendOptions>(): T {
		return {
			content: this.content !== null ? this.content : undefined,
			embeds: this.embeds, components: this.components,
			ephemeral: this.ephemeral, files: this.attachments,
			allowedMentions: { repliedUser: true, parse: [] }
		} as any as T;
	}

	/* Edit the original interaction reply. */
	public async send(interaction: ResponseSendClass): Promise<InteractionResponse | Message | null> {
		try {
			if (interaction instanceof MessageComponentInteraction || interaction instanceof CommandInteraction || interaction instanceof ButtonInteraction || interaction instanceof ModalSubmitInteraction) {
				/* Whether the interaction has already been replied to */
				const replied: boolean = interaction.replied || interaction.deferred;

				if (replied) return await interaction.editReply(this.get());
				else return await interaction.reply(this.get());

			} else if (interaction instanceof TextChannel || interaction instanceof DMChannel || interaction instanceof ThreadChannel) {
				return await interaction.send(this.get<MessageCreateOptions>());

			} else if (interaction instanceof Message) {
				return interaction.reply(this.get<MessageReplyOptions>());
			}
		} catch (_) {}

		return null;
	}
}