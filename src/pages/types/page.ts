import { EmbedBuilder } from 'discord.js';

export type EmbedPage = EmbedBuilder;
export type FunctionPage = () => EmbedPage | Promise<EmbedPage>;

export type Page = EmbedPage | FunctionPage;

export interface AutoGeneratePagesOptions {
    items: string[];
    countPerPage?: number;
}
