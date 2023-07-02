import { ActionRowBuilder, Awaitable, ButtonBuilder, ButtonStyle, ComponentEmojiResolvable, EmbedBuilder, MessageEditOptions, StringSelectMenuBuilder, StringSelectMenuInteraction, StringSelectMenuOptionBuilder, User } from "discord.js";

import { ConversationCooldownModifier, ConversationDefaultCooldown } from "../conversation/conversation.js";
import { Cooldown } from "../conversation/utils/cooldown.js";
import { Response } from "../command/response.js";
import { Bot } from "../bot/bot.js";
import { Utils } from "./utils.js";

interface IntroductionPageBuilderOptions {
    bot: Bot;
    author: User;
}

interface IntroductionPageDesign {
    /* Name of the page */
    title: string;

    /* Emoji for the page */
    emoji: ComponentEmojiResolvable;

    /* Description of the page */
    description: string;

    /* Whether to display the title in the embed */
    displayTitle?: boolean;
}

export interface IntroductionPage {
    /* Explicit index of the page in the selector */
    index: number;

    /* Design for the introduction page */
    design: IntroductionPageDesign;

    /* Callback to execute to build this embed */
    build: (builder: EmbedBuilder, options: IntroductionPageBuilderOptions) => Awaitable<EmbedBuilder>;
}

export const IntroductionPages: IntroductionPage[] = [
    {
        index: 0,
        design: { title: "Introduction", displayTitle: false, description: "Overview of the bot's functionality", emoji: "👋" },

        build: (builder, { author, bot }) => builder
            .setTitle("Hey there 👋")
            .setDescription(`Hey <@${author.id}>, my name is **${bot.client.user.username}**, and I'm the ultimate AI-powered Discord bot. 🚀\n*Below you can see some of my features, and benefits over other bots you might find on Discord*.`)
            .addFields([
                {
                    name: "Completely free ✨",
                    value: "The bot does not require you to sign up for anything, you can simply start using it - *for completely free*."
                },

                {
                    name: "All AIs in one place 🤖",
                    value: "No more wasting time searching for AI models on various websites; use them all through a single Discord bot. 🔥"
                },

                {
                    name: "Competitive features 📈",
                    value: "We offer a fair cool-down and amazing message length limit to free users, and an additional **Premium** tier for even more perks & higher limits; view `/premium` for more."
                },

                {
                    name: "and more ...",
                    value: "Add the bot to your Discord server or try it out here, to see for yourself."
                }
            ])
    },

    {
        index: 1,
        design: { title: "Image generation", emoji: "🖼️", description: "Overview of the image generation features in the bot" },

        build: (builder, { bot }) => builder
            .setDescription(`${bot.client.user.username} isn't just meant for chatting; you can also generate images using \`/imagine\` & \`/mj\`.`)
            .addFields([
                {
                    name: "Come up with a good prompt 🤔",
                    value: "Think of a good **Stable Diffusion** prompt; or use `/imagine ai` to let ChatGPT do it for you!"
                },

                {
                    name: "Select an awesome model 🖥️",
                    value: "We have an exhaustive list of **Stable Diffusion** models thanks to **[Stable Horde](https://stablehorde.net)**; scroll through them using `/imagine models`."
                },

                {
                    name: "Wait for the results ⏰",
                    value: "In case you change your mind, you can just **cancel** the image generation at any time, by clicking the `Cancel` button."
                }
            ])
    },

    {
        index: 2,
        design: { title: "Various LLMs", emoji: "💬", description: "Information about the growing list of language models the bot supports" },

        build: (builder, { bot }) => builder
            .setDescription(`${bot.client.user.username} isn't only limited to **ChatGPT**; we also offer various other language models, including **GPT-4**, **Claude** and **Alpaca**.`)
            .addFields([
                {
                    name: "Constantly growing selection 📈",
                    value: "Whenever a new LLM comes out, we'll for sure be the first to add it to our bot."
                },

                {
                    name: "Easy to switch 🔁",
                    value: "Simply switch the current model using `/tone`, and select one of your choice."
                }
            ])
    },

    {
        index: 3,
        design: { title: "Premium tier", emoji: "✨", description: "Perks of being a Premium user" },

        build: (builder, { bot }) => builder
            .setDescription(`All of this wouldn't be possible without our **Premium** supporters. **Premium ✨** gives you additional benefits and incredibly useful features for the bot.`)
            .addFields([
                {
                    name: "Longer messages 🆙",
                    value: `With **Premium**, ${bot.client.user.username} will be able to generate way longer messages; so that you can generate even more creative stories!`
                },

                {
                    name: "Way lower cool-down ⏰",
                    value: `Chat with **ChatGPT** for as long as you want - without being interrupted by an annoying cool-down! ⏰\nYour cool-down will be lowered to an amazing **${Math.floor(Cooldown.calculate(ConversationDefaultCooldown.time, ConversationCooldownModifier.subscription) / 1000)} seconds**, for all normal models.`
                },

                {
                    name: "Image viewing for all models 📸",
                    value: `Something that even **OpenAI** doesn't offer yet; with **Premium** almost all available models will be able to **understand** & **view** images you attach to your messages!`
                }
            ])
    },

    {
        index: 4,
        design: { title: "Terms of Service", emoji: "📜", description: "Terms of Service for Turing" },

        build: (builder) => {
            const lines: string[] = [
                "The ChatGPT/TuringAI bot is provided by the TuringAI organization \"as is\" without any warranties or guarantees of any kind. We make no promises about the accuracy or reliability of the bot, and we reserve the right to modify or terminate the bot at any time without notice.",
                "By using the ChatGPT/TuringAI bot, you agree to the following guidelines:\n- You will not use the bot for any illegal, malicious, or harmful purposes.\n- You will not harass, threaten, or abuse other users or the bot.\n- You will not attempt to reverse engineer, modify, or exploit the bot or its underlying technology.\n- You will not use the bot to distribute spam, malware, or other harmful content.\n- You will comply with all applicable laws and regulations.",
                "The ChatGPT/TuringAI bot stores conversations and user data for the purpose of improving the bot's performance and functionality. By using the bot, you agree to the storage and use of your conversations and user data by the TuringAI organization. We may use this data to train machine learning models and improve our products and services.",
                "The ChatGPT/TuringAI bot has the ability to ban users for any reason without notice. We reserve the right to ban users who violate these terms of service or engage in abusive or harmful behavior.",
                "The TuringAI organization is not responsible for any damages, losses, or liabilities that may arise from the use of the ChatGPT/TuringAI bot. You use the bot at your own risk.",
                "These terms of service may be updated at any time without notice. Your continued use of the ChatGPT/TuringAI bot constitutes acceptance of any changes to these terms.",
                "The TuringAI organization is not affiliated with OpenAI or any other organization or company. The ChatGPT/TuringAI bot is developed by the TuringAI organization and is not associated with any other product or service.",
                "All results generated by the ChatGPT/TuringAI bot are the property of the TuringAI organization and are stored in our database. We reserve the right to use, modify, or distribute these results for any purpose, including but not limited to improving our products and services.",
                "If you have any questions or concerns about these terms of service, please contact the TuringAI organization at contact@turingai.tech.",
                "These terms of service were created on March 5th, 2023, and apply to all users who access or use the ChatGPT/TuringAI bot on or after this date."
            ];

            return builder
                .setDescription(`By using this bot, you agree to Turing's **Terms of Service**, which can be found [online](https://turing.sh/botterms) or listed below.`)
                .addFields(lines.map((line, index) => ({
                    name: `${index + 1}.`,
                    value: line
                })));
        }
    }
]


export class Introduction {
    public static buttons(bot: Bot): ActionRowBuilder<ButtonBuilder> {
        return new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setURL(Utils.inviteLink(bot))
                        .setLabel("Add me to your server")
                        .setStyle(ButtonStyle.Link),
    
                    new ButtonBuilder()
                        .setURL(Utils.supportInvite(bot))
                        .setLabel("Support server")
                        .setStyle(ButtonStyle.Link),
    
                    new ButtonBuilder()	
                        .setURL("https://github.com/TuringAI-Team/chatgpt-discord-bot")
                        .setEmoji("<:github:1097828013871222865>")
                        .setStyle(ButtonStyle.Link)
                );
    }

    public static buildPageSelector(bot: Bot, author: User, page: IntroductionPage): StringSelectMenuBuilder {
        return new StringSelectMenuBuilder()
            .setCustomId(`general:docs:${author.id}`)
            .setPlaceholder("Select a page...")
            .addOptions(
                IntroductionPages
                    .map(page => new StringSelectMenuOptionBuilder()
                        .setLabel(`${page.design.title} [#${page.index + 1}]`)
                        .setDescription(page.design.description)
                        .setEmoji(page.design.emoji)
                        .setValue(`${page.index}`)
                    )
            );
    }

    public static async buildPage(bot: Bot, author: User, page: IntroductionPage = IntroductionPages[0], standalone: boolean = false): Promise<Response> {
        /* Action component rows to add to the message */
        const rows: ActionRowBuilder<any>[] = [
            new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    ...this.buttons(bot).components,
    
                    new ButtonBuilder()
                        .setEmoji("🗑️")
                        .setStyle(ButtonStyle.Danger)
                        .setCustomId(`general:delete:${author.id}`)
                )
        ];
    
        if (!standalone) rows.push(new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(this.buildPageSelector(bot, author, page))
        );
    
        /* Build the page embed itself. */
        const embed: EmbedBuilder = await page.build(new EmbedBuilder(), { author, bot });
    
        /* Set some other values for the embed. */
        if (page.design.displayTitle ?? true) embed.setTitle(`${page.design.title} ${page.design.emoji}`);
    
        if (!standalone) embed.setFooter({ text: `${page.index + 1} / ${IntroductionPages.length}` });
        embed.setColor(bot.branding.color);
    
        /* Final response */
        const response: Response = new Response()
            .addEmbed(embed);
    
        /* Add the selection menu for the pages. */
        rows.forEach(row => response.addComponent(ActionRowBuilder<any>, row));
    
        return response;
    }

    public static at(index: number | string): IntroductionPage {
        const page: IntroductionPage | null = IntroductionPages.find(p => p.design.title === index) ?? null;
        if (page !== null) return page;
    
        /* Actually parse the index into an integer. */
        index = typeof index === "string" ? parseInt(index) : index;
        return IntroductionPages[index];
    }

    public static async handleInteraction(bot: Bot, interaction: StringSelectMenuInteraction): Promise<void> {    
        /* Index of the new page */
        const index: number = parseInt(interaction.values[0]);
    
        /* The new introduction page itself */
        const page: IntroductionPage = IntroductionPages[index];
    
        /* Build the introduction page. */
        const response: Response = await this.buildPage(bot, interaction.user, page);
    
        await Promise.all([
            interaction.deferUpdate(),
            interaction.message.edit(response.get() as MessageEditOptions)
        ]).catch(() => {});
    }
}