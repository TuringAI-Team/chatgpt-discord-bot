import { EmojiIdentifierResolvable, MessageActionRowComponent, MessageComponentInteraction } from 'discord.js';

export type TriggerCallback<T extends MessageActionRowComponent> = (interaction: MessageComponentInteraction, ...components: (T)[]) => unknown;

export interface Trigger<T extends MessageActionRowComponent> {
    name: string;
    callback: TriggerCallback<T>;
}

export type TriggersMap = Map<EmojiIdentifierResolvable, TriggerCallback<any>>;
