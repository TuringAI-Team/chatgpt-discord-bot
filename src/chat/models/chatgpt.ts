import { ComponentEmojiResolvable } from "discord.js";

import { ChatSettingsPlugin, ChatSettingsPluginIdentifier, ChatSettingsPlugins } from "../../conversation/settings/plugin.js";
import { ChatModel, ConstructorModelOptions, ModelCapability, ModelType } from "../types/model.js";
import { TuringOpenAIPartialResult, TuringOpenAIResult } from "../../turing/types/openai/chat.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../../error/generation.js";
import { TuringChatPluginsModel, TuringChatPluginsResult } from "../../turing/api.js";
import { MultipleChoiceSettingsOption } from "../../db/managers/settings.js";
import { getPromptLength } from "../../conversation/utils/length.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatClient, PromptData } from "../client.js";
import { Emoji } from "../../util/emoji.js";
import { Utils } from "../../util/utils.js";

export class ChatGPTModel extends ChatModel {
    constructor(client: ChatClient, options?: ConstructorModelOptions) {
        super(client, options ?? {
            name: "ChatGPT", type: ModelType.OpenAI,
            capabilities: [ ModelCapability.ImageViewing, ModelCapability.UserLanguage ]
        });
    }

    private processPlugins(options: ModelGenerationOptions, prompt: PromptData, data: TuringChatPluginsResult): PartialResponseMessage | null {
        if (data.result.length === 0) return null;

        /* Which plugin was used, if applicable */
        const plugin: ChatSettingsPlugin | null = data.tool !== null
            ? ChatSettingsPlugins.find(p => p.id === data.tool) ?? null : null;

        /* Whether the raw tool result should be shown */
        const raw: boolean = this.client.manager.bot.db.settings.get(options.db.user, "plugins:debug");

        return {
            text: data.result,

            raw: {
                cost: data.cost,
                finishReason: data.finishReason === "length" ? "length" : "stop",
                    
                usage: {
                    completion: getPromptLength(data.result),
                    prompt: prompt.length
                }
            },

            buttons: data.tool !== null ? [
                {
                    label: "Used plugin", emoji: "🛠️", disabled: true
                },

                {
                    label: plugin !== null ? plugin.options.name : Utils.titleCase(data.tool),
                    emoji: plugin !== null && plugin.options.emoji !== null ? Emoji.display(plugin.options.emoji, true) as ComponentEmojiResolvable : undefined,
                    id: "settings:menu:user:plugins"
                }
            ] : [],

            embeds: [
                ...data.toolResult !== null && data.toolResult.image ? [
                    {
                        image: data.toolResult.image,
                        color: this.client.manager.bot.branding.color
                    }
                ] : [],
                
                ...raw && data.toolResult !== null && data.toolInput !== null ? [
                    {
                        description: `\`\`\`${Utils.truncate(JSON.stringify(data.toolInput, undefined, 2), 500).replaceAll("`", "\\`")}\`\`\`\n\`\`\`${Utils.truncate(JSON.stringify(data.toolResult, undefined, 2), 1000).replaceAll("`", "\\`")}\`\`\``,
                        color: this.client.manager.bot.branding.color
                    }
                ] : []
            ]
        };
    }

    /**
     * Make the actual call to the OpenAI API, to generate a response for the given prompt.
     * This always concatenates the history & starting prompt.
     * 
     * @param options Generation options
     * @returns Generated response
     */
    protected async chat(options: ModelGenerationOptions, prompt: PromptData, progress: (response: TuringOpenAIPartialResult) => Promise<void> | void): Promise<TuringOpenAIResult> {
        const data = await this.client.manager.bot.turing.openAI({
            model: options.settings.options.settings.model ?? "gpt-3.5-turbo",
            temperature: options.settings.options.settings.temperature ?? 0.5,
            messages: prompt.all, max_tokens: prompt.max
        }, progress);

        if (data === null || data.result.trim().length === 0) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Empty
        });

        return data;
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const prompt = await this.client.buildPrompt(options);

        const identifiers: ChatSettingsPluginIdentifier[] = MultipleChoiceSettingsOption
            .which(this.client.manager.bot.db.settings.get(options.db.user, "plugins:list"));

        if (identifiers.length > 0) {
            /* All of the user's plugins */
            const plugins: ChatSettingsPlugin[] = identifiers.map(id => 
                ChatSettingsPlugins.find(p => p.id === id)!
            );

            /* Which model to use */
            const model: TuringChatPluginsModel = options.model.settings.name.includes("ChatGPT") ? "gpt-3.5-turbo" : "gpt-4";

            /* Fix various plugins that provide up-to-date information past the knowledge cut-off date. */
            prompt.parts.Initial.content += "\nI do not have a knowledge cut-off, I have access to up-to-date news and information using plugins.";

            /* Generate a response for the user's prompt using the Turing API. */
            const result: TuringChatPluginsResult = await this.client.manager.bot.turing.openAIPlugins({
                messages: prompt.all, tokens: prompt.max,
                user: options.db.user, model, plugins,

                progress: result => {
                    const formatted = this.processPlugins(options, prompt, result);
                    if (formatted !== null) options.progress(formatted);
                }
            });

            const final = this.processPlugins(options, prompt, result);
            if (final === null) throw new GPTGenerationError({ type: GPTGenerationErrorType.Empty });

            return final;

        /* No plugins are selected */
        } else {
            const data = await this.chat(
                options, prompt, response => options.progress({ text: response.result })
            );
    
            return {
                raw: {
                    finishReason: data.finishReason === "length" ? "length" : "stop",
                    
                    usage: {
                        completion: getPromptLength(data.result),
                        prompt: prompt.length
                    }
                },
    
                text: data.result
            };
        }
    }
}