import { ComponentEmojiResolvable } from "discord.js";

import { ChatSettingsPlugin, ChatSettingsPluginIdentifier, ChatSettingsPlugins } from "../../conversation/settings/plugin.js";
import { ChatModel, ConstructorModelOptions, ModelCapability, ModelType } from "../types/model.js";
import { TuringOpenAIPartialResult, TuringOpenAIResult } from "../../turing/types/chat.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../../error/gpt/generation.js";
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
            name: "ChatGPT",
            type: ModelType.OpenAIChat,

            capabilities: [ ModelCapability.ImageViewing, ModelCapability.UserLanguage ]
        });
    }

    private processPlugins(prompt: PromptData, data: TuringChatPluginsResult): PartialResponseMessage | null {
        if (data.result.length === 0) return null;

        /* Which plugin was used, if applicable */
        const plugin: ChatSettingsPlugin | null = data.tool !== null
            ? ChatSettingsPlugins.find(p => p.id === data.tool) ?? null : null;

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
                    label: "Used plugin", emoji: "🛠️",
                    disabled: true
                },

                {
                    label: plugin !== null ? plugin.options.name : Utils.titleCase(data.tool),
                    emoji: plugin !== null && plugin.options.emoji !== null ? Emoji.display(plugin.options.emoji, true) as ComponentEmojiResolvable : undefined,
                    id: "settings:menu:user:plugins"
                }
            ] : []
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
            messages: Object.values(prompt.parts),
            max_tokens: prompt.max
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

            /* Generate a response for the user's prompt using the Turing API. */
            const result: TuringChatPluginsResult = await this.client.manager.bot.turing.chatPlugins({
                messages: Object.values(prompt.parts),
                tokens: prompt.max,

                user: options.db.user,

                progress: result => {
                    const formatted = this.processPlugins(prompt, result);
                    if (formatted !== null) options.progress(formatted);
                },

                model, plugins
            });

            const final = this.processPlugins(prompt, result);
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