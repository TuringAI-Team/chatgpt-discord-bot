import { ComponentEmojiResolvable } from "discord.js";

import { ChatSettingsPlugin, ChatSettingsPluginIdentifier, ChatSettingsPlugins } from "../../conversation/settings/plugin.js";
import { ChatModel, ConstructorModelOptions, ModelCapability, ModelType } from "../types/model.js";
import { TuringOpenAIPartialResult, TuringOpenAIResult } from "../../turing/types/openai/chat.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../../error/generation.js";
import { MultipleChoiceSettingsOption } from "../../db/managers/settings.js";
import { MessageType, PartialResponseMessage } from "../types/message.js";
import { getPromptLength } from "../../conversation/utils/length.js";
import { ModelGenerationOptions } from "../types/options.js";
import { ChatClient, PromptData } from "../client.js";
import { ChatEmbed } from "../types/embed.js";
import { Emoji } from "../../util/emoji.js";
import { Utils } from "../../util/utils.js";

export class ChatGPTModel extends ChatModel {
    constructor(client: ChatClient, options?: ConstructorModelOptions) {
        super(client, options ?? {
            name: "ChatGPT", type: ModelType.OpenAI,
            capabilities: [ ModelCapability.ImageViewing, ModelCapability.UserLanguage ]
        });
    }

    private displayResultEmbeds(options: ModelGenerationOptions, data: TuringOpenAIResult, plugin: ChatSettingsPlugin | null): ChatEmbed[] {
        if (!data.tool || data.tool.name === null) return [];
        const embeds: ChatEmbed[] = [];

        if (data.tool.result && data.tool.result.image) embeds.push({
            color: this.client.manager.bot.branding.color,
            image: data.tool.result.image
        });

        /* Whether the raw tool result should be shown */
        const raw: boolean = this.client.manager.bot.db.settings.get(options.db.user, "plugins:debug");
        
        if (raw && data.tool.result && data.tool.input) {
            let descriptions: { title: string, data: any }[] = [ { title: "Input", data: data.tool.input } ];
            if (!data.tool.error) descriptions.push({ title: "Output", data: data.tool.result });

            embeds.push({
                description: descriptions.map(e => `### ${e.title.toUpperCase()}\n\`\`\`${Utils.truncate(JSON.stringify(e.data), 500).replaceAll("`", "\\`")}\`\`\``).join("\n"),
                color: data.tool.error ? "Red" : this.client.manager.bot.branding.color
            });
        }

        return embeds;
    }

    protected process(options: ModelGenerationOptions, prompt: PromptData, data: TuringOpenAIResult): PartialResponseMessage | null {
        /* Which plugin was used, if applicable */
        const plugin: ChatSettingsPlugin | null = data.tool && data.tool.name !== null
            ? ChatSettingsPlugins.find(p => p.id === data.tool!.name) ?? null : null;

        if (data.result.length === 0 && data.tool && data.tool.name && plugin) return {
            text: `Executing plugin ${Emoji.display(plugin.options.emoji, true)} **${plugin.options.name}**`,
            type: MessageType.Notice
        };

        if (data.result.length === 0) return null;

        if (!data.tool) {
            return {
                text: data.result,

                raw: {
                    cost: data.cost, finishReason: data.finishReason === "length" ? "length" : "stop",
                    usage: { completion: getPromptLength(data.result), prompt: prompt.length }
                }
            };
        }

        return {
            text: data.result,

            raw: {
                cost: data.cost, finishReason: data.finishReason === "length" ? "length" : "stop",
                usage: { completion: getPromptLength(data.result), prompt: prompt.length }
            },

            buttons: plugin !== null ? [
                {
                    label: "Used plugin", emoji: "🛠️", disabled: true
                },

                {
                    label: plugin.options.name, id: "settings:menu:user:plugins",
                    emoji: Emoji.display<ComponentEmojiResolvable>(plugin.options.emoji, true)
                }
            ] : [],

            embeds: this.displayResultEmbeds(options, data, plugin)
        };
    }

    /**
     * Make the actual call to the OpenAI API, to generate a response for the given prompt.
     * This always concatenates the history & starting prompt.
     * 
     * @param options Generation options
     * @returns Generated response
     */
    protected async chat(options: ModelGenerationOptions, progress: (response: TuringOpenAIPartialResult) => Promise<void> | void, prompt: PromptData, plugins: ChatSettingsPlugin[] = []): Promise<TuringOpenAIResult> {
        const data = await this.client.manager.bot.turing.openAI({
            model: options.settings.options.settings.model ?? "gpt-3.5-turbo",
            temperature: options.settings.options.settings.temperature ?? 0.5,
            messages: prompt.all, tokens: prompt.max,
            progress, plugins
        });

        if (data === null || data.result.trim().length === 0) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Empty
        });

        return data;
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const prompt = await this.client.buildPrompt(options);

        const identifiers: ChatSettingsPluginIdentifier[] = MultipleChoiceSettingsOption
            .which(this.client.manager.bot.db.settings.get(options.db.user, "plugins:list"));

        /* All of the user's plugins */
        const plugins: ChatSettingsPlugin[] = identifiers.map(id => 
            ChatSettingsPlugins.find(p => p.id === id)!
        );

        if (identifiers.length > 0) {
            /* Fix various plugins that provide up-to-date information past the knowledge cut-off date. */
            prompt.parts.Initial.content += "\nI do not have a knowledge cut-off, I have access to up-to-date news and information using plugins.";
        }

        const data = await this.chat(
            options, data => {
                const response = this.process(options, prompt, data);
                if (response !== null) options.progress(response);
            }, prompt, plugins
        );

        const final = this.process(options, prompt, data);
        if (final === null) throw new GPTGenerationError({ type: GPTGenerationErrorType.Empty });

        return final;
    }
}