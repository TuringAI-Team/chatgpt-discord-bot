import { EmbedBuilder, ComponentBuilder, Message, InteractionReplyOptions, TextChannel, AttachmentBuilder, MessageCreateOptions, CommandInteraction, MessageComponentInteraction, DMChannel, InteractionResponse, ThreadChannel, MessageEditOptions, InteractionUpdateOptions, ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import { APIActionRowComponent, APIActionRowComponentTypes } from "discord-api-types/v10";

type Component = APIActionRowComponentTypes | APIActionRowComponent<APIActionRowComponentTypes>

export enum ResponseType {
	FollowUp,
	Edit,
    Send
}

export type ResponseSendClass = MessageComponentInteraction | CommandInteraction | ModalSubmitInteraction | Message | TextChannel | DMChannel | ThreadChannel

export class Response {
	/* Content of the message */
	public content: string | null;

	/* Embed of the message */
	public embeds: EmbedBuilder[];

	/* Attachments of the message */
	public attachments: AttachmentBuilder[];

	/* Components of the message */
	public components: Component[];

	/* Type of the response */
	public type: ResponseType;

    /* Whether the response is only visible to the user */
    public ephemeral: boolean;

	constructor(type: ResponseType = ResponseType.Send) {
        this.ephemeral = false;
		this.attachments = [];
		this.components = [];
		this.content = null;
		this.embeds = [];
		this.type = type;
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

	public addAttachment(attachment: AttachmentBuilder | null): this {
		if (!attachment) return this;
		this.attachments.push(attachment);

		return this;
	}

	public addComponent<T extends ComponentBuilder>(type: { new(): T }, builder: ((component: T) => T) | T | null): this {
		if (builder === null) return this;
		
		this.components.push((typeof builder === "function" ? builder(new type()) : builder).toJSON());
		return this;
	}

	public setType(type: ResponseType): this {
		this.type = type;
		return this;
	}

	public setEphemeral(ephemeral: boolean): this {
		this.ephemeral = ephemeral;
		return this;
	}

	/* Get the formatted embed. */
	public get(): InteractionReplyOptions | InteractionUpdateOptions | MessageCreateOptions | MessageEditOptions {
		return {
			content: this.content !== null ? this.content : undefined,
			embeds: this.embeds ? this.embeds : [],
			components: this.components as any,
			ephemeral: this.ephemeral,
			files: this.attachments,
			allowedMentions: { repliedUser: true, parse: [] }
		};
	}

	/* Edit the original interaction reply. */
	public async send(interaction: ResponseSendClass): Promise<InteractionResponse | Message | null> {
		try {
			if (interaction instanceof MessageComponentInteraction || interaction instanceof CommandInteraction || interaction instanceof ButtonInteraction || interaction instanceof ModalSubmitInteraction) {
				/* Whether the interaction has already been replied to */
				const replied: boolean = interaction.replied || interaction.deferred;

				/* Edit the original reply. */
				if (this.type === ResponseType.Send && !replied) return await interaction.reply(this.get() as InteractionReplyOptions);
				else if (this.type === ResponseType.Edit || replied) return await interaction.editReply(this.get() as InteractionReplyOptions);
				else if (this.type === ResponseType.FollowUp) return await interaction.followUp(this.get() as InteractionReplyOptions);

			} else if (interaction instanceof TextChannel || interaction instanceof DMChannel || interaction instanceof ThreadChannel) {
				/* Send the message to the channel. */
				return await interaction.send(this.get() as MessageCreateOptions);

			} else if (interaction instanceof Message) {
				/* Send the reply to the message. */
				return interaction.reply(this.get() as MessageCreateOptions);
			}
		} catch (_) {}

		return null;
	}
}