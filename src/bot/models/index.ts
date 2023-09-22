import EventEmitter from "node:events";
import { Api } from "../api.js";

interface Model {
    name: string;
    description: string;
}

interface ChatModel extends Model {
    emoji: { name: string; id: string };
    maxTokens: 2048 | 4096 | 8192;
}

export interface GPTModel extends ChatModel {
    run: (
        api: Api,
        data: {
            messages: { role: string; content: string }[];
            max_tokens?: number;
            temperature?: number;
            plugins?: string[];
        },
    ) => EventEmitter | NonNullable<unknown>;
}

export interface AnthropicModel extends ChatModel {
    run: (
        api: Api,
        data: {
            messages: { role: string; content: string }[];
            max_tokens?: number;
            temperature?: number;
        },
    ) => EventEmitter | NonNullable<unknown>;
}

export interface OpenChatModel extends ChatModel {
    run: (
        api: Api,
        data: {
            messages: { role: string; content: string }[];
            max_tokens?: number;
            temperature?: number;
        },
    ) => EventEmitter | NonNullable<unknown>;
}

type ImageModelFixed = Model & {
    fixedSize: { width: number, height: number }
    baseSize?: never;
    from?: never;
    to?: never;
    variableSizes?: never;
}

type ImageModelBase = Model & {
    fixedSize?: never;
    baseSize: { width: number, height: number };
    from?: never;
    to?: never;
    variableSizes?: never;
}

type ImageModelFromTo = Model & {
    fixedSize?: never;
    baseSize?: never;
    from: { width: number, height: number };
    to: { width: number, height: number };
    variableSizes?: never;
}

type Enumerate<N extends number, Acc extends number[] = []> = Acc['length'] extends N
    ? Acc[number]
    : Enumerate<N, [...Acc, Acc['length']]>

type Range<F extends number, T extends number> = Exclude<Enumerate<T>, Enumerate<F>>

type ImageModelVariable<T extends number> = Model & {
    fixedSize?: never;
    baseSize?: never;
    from?: never;
    to?: never;
    variableSizes: {
        [K in keyof Range<0, T>]: {
            width: number;
            height: number;
        }
    }
}

type ImageModel<T extends number> = ImageModelFixed | ImageModelBase | ImageModelFromTo | ImageModelVariable<T>;

export type DALLEModel = ImageModel & {
    run: (
        api: Api,
        data: {
            prompt: string,
            number: 1 | 2 | 3 | 4,
            size: "256x256" | "512x512" | "1024x1024",
            image: string
        }
    ) => EventEmitter | NonNullable<unknown>;
};