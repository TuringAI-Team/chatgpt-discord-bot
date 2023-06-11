import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, GuildMember, InteractionReplyOptions } from "discord.js";

import { MidjourneyResult, TuringVideoModel, TuringVideoModelName, TuringVideoResult } from "../../turing/api.js";
import { DatabaseGuild, DatabaseInfo, DatabaseUser, UserSubscriptionType } from "./user.js";
import { DescribeSummary, ImageDescription } from "../../image/description.js";
import { StableHordeGenerationResult } from "../../image/types/image.js";
import { ChatInteraction } from "../../conversation/conversation.js";
import { ErrorResponse } from "../../command/response/error.js";
import { CommandInteraction } from "../../command/command.js";
import { SummaryPrompt } from "../../commands/summarize.js";
import { ProgressBar } from "../../util/progressBar.js";
import { ClientDatabaseManager } from "../cluster.js";
import { YouTubeVideo } from "../../util/youtube.js";
import { Response } from "../../command/response.js";
import { Utils } from "../../util/utils.js";

type DatabaseEntry = DatabaseUser | DatabaseGuild

type UserPlanExpenseType = "image" | "dall-e" | "midjourney" | "video" | "summary" | "chat" | "describe" | "translate"

type UserPlanExpenseData = {
    [key: string]: string | number | boolean | UserPlanExpenseData;
}

interface UserPlanExpense<T extends UserPlanExpenseData = UserPlanExpenseData> {
    /* Type of expense */
    type: UserPlanExpenseType;

    /* When this expense was made */
    time: number;

    /* How much was used for this expense, e.g. 0.000342) */
    used: number;

    /* Other information about this expense, e.g. for Chat expenses it contains `model`, `completionTokens` and `promptTokens` */
    data: T | null;
}

export type UserPlanChatExpense = UserPlanExpense<{
    model: string;

    tokens?: {
        prompt: number;
        completion: number;
    };

    duration?: number;
}>

export type UserPlanImageExpense = UserPlanExpense<{
    kudos: number;
}>

export type UserPlanDallEExpense = UserPlanExpense<{
    count: number;
}>

export type UserPlanMidjourneyExpense = UserPlanExpense<{
    prompt: string;
}>

export type UserPlanImageDescribeExpense = UserPlanExpense<{
    duration: number;
}>

export type UserPlanVideoExpense = UserPlanExpense<{
    model: TuringVideoModelName;
    duration: number;
}>

export type UserPlanSummaryExpense = UserPlanExpense<{
    tokens: number;
    url: string;
}>

export type UserPlanTranslateExpense = UserPlanExpense<{
    tokens: {
        prompt: number;
        completion: number;
    };

    source: string;
}>

type UserPlanCreditType = "web" | "grant"
type UserPlanCreditGateway = "BITCOIN" | "ETHEREUM" | "BINANCE_COIN" | "MONERO" | "STRIPE" | "PAYPAL" | "BINANCE"

interface UserPlanCredit {
    /* What type of charge-up this is */
    type: UserPlanCreditType;

    /* Which gateway was used */
    gateway: UserPlanCreditGateway | null;

    /* When this charge-up was done */
    time: number;

    /* How much was charged up, e.g. 5.00 (5,00 USD) */
    amount: number;
}

export type UserPlanCreditBonusAmount = 0.05 | 0.10 | 0.15 | 0.20

/* How many expense entries can be in the history, maximum */
export const PLAN_MAX_EXPENSE_HISTORY: number = 500

export interface UserPlan {
    /* How much credit the user has charged up, e.g. 17.80 (17,80 USD)  */
    total: number;

    /* How much credit the user has already used, e.g. 3.38834 (~3,38 USD) */
    used: number;

    /* Each expense the user makes is logged here */
    expenses: UserPlanExpense[];

    /* Each charge-up the user makes is logged here */
    history: UserPlanCredit[];
}

export type GuildPlan = UserPlan

enum PlanLocation {
    Guild = "guild",
    User = "user"
}

export type PlanCreditVisibility = "detailed" | "full" | "used" | "percentage" | "hide"
export type PlanCreditViewer = (plan: UserPlan, interaction: ChatInteraction) => string | null

export const PlanCreditViewers: Record<PlanCreditVisibility, PlanCreditViewer> = {
    detailed: (plan, interaction) => `${interaction.output.raw?.usage ? `${interaction.output.raw.usage.completion} tokens •` : interaction.output.raw?.cost ? `$${interaction.output.raw.cost.toFixed(4)} •` : ""} $${plan.used.toFixed(2)} / $${plan.total.toFixed(2)}`,
    full: plan => `$${plan.used.toFixed(2)} / $${plan.total.toFixed(2)}`,
    used: plan => `$${plan.used.toFixed(2)}`,
    percentage: plan => plan.used > 0 ? `${(plan.used / plan.total * 100).toFixed(1)}%` : null,
    hide: () => null
}

export type PlanExpenseEntryViewer<T extends UserPlanExpense = any> = (
    (expense: T & { data: NonNullable<T["data"]> }, plan: UserPlan) => string | null
) | null

export const PlanExpenseEntryViewers: {
    image: PlanExpenseEntryViewer<UserPlanImageExpense>,
    "dall-e": PlanExpenseEntryViewer<UserPlanDallEExpense>,
    midjourney: PlanExpenseEntryViewer<UserPlanMidjourneyExpense>,
    video: PlanExpenseEntryViewer<UserPlanVideoExpense>,
    summary: PlanExpenseEntryViewer<UserPlanSummaryExpense>,
    chat: PlanExpenseEntryViewer<UserPlanChatExpense>,
    describe: PlanExpenseEntryViewer<UserPlanImageDescribeExpense>,
    translate: PlanExpenseEntryViewer<UserPlanTranslateExpense>
} = {
    image: e => `used \`${e.data.kudos}\` kudos`,
    "dall-e": e => `**${e.data.count}** image${e.data.count > 1 ? "s" : ""}`,
    midjourney: e => `prompt \`${e.data.prompt}\``,
    video: e => `took **${e.data.duration} ms** using model \`${e.data.model}\``,
    summary: e => `used **${e.data.tokens}** tokens`,
    chat: e => `using \`${e.data.model}\`${e.data.tokens ? `, **${e.data.tokens.prompt}** prompt & **${e.data.tokens.completion}** completion tokens` : ""}`,
    describe: e => `took **${e.data.duration} ms**`,
    translate: e => `translated from **\`${e.data.source}\`**, used **${e.data.tokens.prompt}** prompt & **${e.data.tokens.completion}** completion tokens`
}

export class PlanManager {
    private db: ClientDatabaseManager;

    constructor(db: ClientDatabaseManager) {
        this.db = db;
    }

    public location(entry: DatabaseEntry): PlanLocation {
        if ((entry as any).roles != undefined) return PlanLocation.User;
        return PlanLocation.Guild;
    }

    /**
     * Check whether an entry's current plan is overdue and cannot be used anymore.
     * @param user Entry to check for
     * 
     * @returns Whether the plan is still "valid" and active
     */
    public active(entry: DatabaseEntry): boolean {
        if (entry.plan === null) return false;
        return entry.plan.total - entry.plan.used > 0;
    }

    /**
     * Get the user's active plan, if applicable.
     * @param user User to get the plan of
     * 
     * @returns The user's plan, or `null`
     */
    public get({ plan }: DatabaseEntry): UserPlan | null {
        if (plan === null) return null;

        return {
            expenses: typeof plan.expenses === "number" ? [] : plan.expenses ?? [],
            history: plan.history ?? [],
            total: plan.total ?? 0,
            used: plan.used ?? 0
        };
    }

    public async expense<T extends UserPlanExpense = UserPlanExpense>(
        db: DatabaseInfo, { type, used, data, bonus }: Pick<T, "type" | "used" | "data"> & { bonus?: UserPlanCreditBonusAmount }
    ): Promise<T | null> {
        /* If no used amount of credit was actually specified, ignore this. */
        if (used === 0) return null;

        const userType = this.db.users.type(db);
        const entry = db[userType.location]!;

        /* Check whether the user/guild has actually configured to use this plan. */
        if (!this.active(entry)) return null;

        /* The new expense */
        const expense: T = {
            type, used, data,
            time: Date.now()
        } as T;

        /* The entry's current plan */
        const plan: UserPlan = this.get(entry)!;

        let additional: number = used;
        if (bonus) additional += additional * bonus;

        /* Updated, total usage; limit their usage their minimum usage to 0 */
        const updatedUsage: number = Math.max(plan.used + additional, 0);

        await this.db.users[userType.location === "guild" ? "updateGuild" : "updateUser"](entry as any, {
            plan: {
                ...plan,

                expenses: [ ...plan.expenses.slice(-(PLAN_MAX_EXPENSE_HISTORY - 1)), expense ],
                used: updatedUsage
            }
        });

        return expense;
    }

    public async expenseForChat(
        entry: DatabaseInfo, { used, data, bonus }: Pick<UserPlanChatExpense, "used" | "data"> & { bonus?: UserPlanCreditBonusAmount }
    ): Promise<UserPlanChatExpense | null> {
        return this.expense(entry, {
            type: "chat", used, data, bonus
        });
    }

    public async expenseForImage(
        entry: DatabaseInfo, result: StableHordeGenerationResult
    ): Promise<UserPlanImageExpense | null> {
        return this.expense(entry, {
            type: "image", used: result.kudos / 4500, data: { kudos: result.kudos }, bonus: 0.10
        });
    }

    public async expenseForDallEImage(
        entry: DatabaseInfo, count: number
    ): Promise<UserPlanDallEExpense | null> {
        return this.expense(entry, {
            type: "dall-e", used: count * 0.02, data: { count }, bonus: 0.10
        });
    }

    public async expenseForMidjourneyImage(
        entry: DatabaseInfo, result: MidjourneyResult
    ): Promise<UserPlanMidjourneyExpense | null> {
        return this.expense(entry, {
            type: "midjourney", used: result.credits, data: { prompt: result.prompt }, bonus: 0.15
        });
    }

    public async expenseForImageDescription(
        entry: DatabaseInfo, result: ImageDescription, summary: DescribeSummary | null
    ): Promise<UserPlanImageDescribeExpense | null> {
        let cost: number = 0;

        /* Cost for the BLIP image description */
        cost += (Math.max(result.duration, 1000) / 1000) * 0.0004;

        /* Cost for the ChatGPT summary */
        if (summary !== null) cost += ((summary.tokens.prompt + summary.tokens.completion) / 1000) * 0.0015;

        return this.expense(entry, {
            type: "describe", used: (Math.max(result.duration, 1000) / 1000) * 0.0023, data: { duration: result.duration }, bonus: 0.10
        });
    }

    public async expenseForVideo(
        entry: DatabaseInfo, video: TuringVideoResult, model: TuringVideoModel
    ): Promise<UserPlanVideoExpense | null> {
        return this.expense(entry, {
            type: "video", used: (Math.max(video.duration, 1000) / 1000) * 0.0023, data: { duration: video.duration, model: model.id }, bonus: 0.05
        });
    }

    public async expenseForSummary(
        entry: DatabaseInfo, video: YouTubeVideo, prompt: SummaryPrompt, tokens: number
    ): Promise<UserPlanSummaryExpense | null> {
        /* Total amount of tokens used and generated */
        const total: number = prompt.tokens + tokens;

        return this.expense(entry, {
            type: "summary", used: (total / 1000) * 0.0015, data: { tokens: total, url: video.url }, bonus: 0.10
        });
    }

    public async expenseForTranslation(
        entry: DatabaseInfo, tokens: Record<"prompt" | "completion", number>, source: string
    ): Promise<UserPlanTranslateExpense | null> {
        /* Total amount of tokens used and generated */
        const total: number = tokens.prompt + tokens.completion;

        return this.expense(entry, {
            type: "translate", used: (total / 1000) * 0.0015, data: { tokens, source }, bonus: 0.10
        });
    }

    public async credit(
        db: DatabaseEntry | DatabaseInfo, { type, amount, gateway }: Pick<UserPlanCredit, "type" | "amount"> & Partial<Pick<UserPlanCredit, "gateway">>
    ): Promise<UserPlanCredit> {
        /* The new credit */
        const credit: UserPlanCredit = {
            type, amount,
            
            gateway: gateway ?? null,
            time: Date.now()
        };

        const entry: DatabaseEntry = (db as any).guild
            ? (db as DatabaseInfo)[this.db.users.type(db as DatabaseInfo).location]!
            : db as DatabaseEntry;

        /* The entry's current plan */
        if (entry.plan === null) throw new Error("User/guild doesn't have a running plan");
        const plan: UserPlan = this.get(entry)!;

        /* Updated, total credit */
        const updatedCredit: number = plan.total + amount;

        await this.db.users[this.location(entry) === PlanLocation.Guild ? "updateGuild" : "updateUser"](entry as any, {
            plan: {
                ...plan,

                history: [ ...plan.history, credit ],
                total: updatedCredit
            }
        });

        return credit;
    }

    public async create(entry: DatabaseEntry, amount?: number): Promise<UserPlan> {
        /* If the user already has a pay-as-you-go plan, just return that instead. */
        if (entry.plan !== null) return entry.plan;

        /* The user's new plan */
        const plan: UserPlan = {
            total: amount ?? 0, used: 0,
            expenses: [], history: []
        };

        await this.db.users[this.location(entry) === PlanLocation.Guild ? "updateGuild" : "updateUser"](entry as any, {
            plan
        });

        return plan;
    }

    public async handleInteraction(interaction: ButtonInteraction): Promise<void> {
        /* Information about what action to perform, etc. */
        const data: string[] = interaction.customId.split(":");
        data.shift();

        /* Which action to perform */
        const action: "overview" = data.shift()! as any;

        /* Database instances, guild & user */
        const db: DatabaseInfo = await this.db.users.fetchData(interaction.user, interaction.guild);

        if (action === "overview") {
            const response = await this.buildOverview(interaction, db);
            await interaction.reply(response.get() as InteractionReplyOptions);
            
        } else {
            await interaction.deferUpdate();
        }
    }

    public async buildOverview(interaction: CommandInteraction | ButtonInteraction, { user, guild }: DatabaseInfo): Promise<Response> {
        /* Current subscription & plan */
		const subscriptions = {
			user: this.db.users.subscription(user),
			guild: guild ? this.db.users.subscription(guild) : null
		};

		const plans = {
			user: this.db.plan.get(user),
			guild: guild ? this.db.plan.get(guild) : null
		};

		/* Subscription type of the user */
		const type: UserSubscriptionType = this.db.users.type({ user, guild });

		/* The user's permissions */
		const permissions = interaction.member instanceof GuildMember ? interaction.member.permissions : null;

		/* Whether the "Recharge" button should be shown */
		const showShopButton: boolean = user.metadata.email != undefined && (type.location === "guild" ? permissions !== null && permissions.has("ManageGuild") : true);

		const builder: EmbedBuilder = new EmbedBuilder()
			.setColor("Orange");

		const buttons: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(
				new ButtonBuilder()
					.setStyle(ButtonStyle.Link)
					.setURL(Utils.shopURL())
					.setLabel("Visit our shop")
					.setEmoji("💸")
			);

		const response = new Response()
			.setEphemeral(true);

		if (type.premium) {
			if (type.type === "plan") {
				if (type.location === "guild") {
					/* Check whether the user has the "Manage Server" permission. */
					if (!permissions || !permissions.has("ManageGuild")) return new ErrorResponse({
						interaction, message: "You must have the `Manage Server` permission to view & manage the server's plan", emoji: "😔"
					});
				}

				/* The user's (or guild's) plan */
				const plan = plans[type.location]!;

				/* Previous plan expenses */
				const expenses = plan.expenses.slice(-10);

				if (expenses.length > 0) response.addEmbed(builder => builder
					.setTitle("Previous expenses")
					.addFields(expenses.map(expense => {
                        /* Formatter for this expense type */
                        const viewer: PlanExpenseEntryViewer | null = PlanExpenseEntryViewers[expense.type];

                        const formatted: string | null = viewer !== null
                            ? viewer(expense, plan) : null;

                        return {
                            name: `${Utils.titleCase(expense.type)}${formatted !== null ? `— *${formatted}*` : ""}`,
                            value: `**$${Math.round(expense.used * Math.pow(10, 5)) / Math.pow(10, 5)}** — *<t:${Math.floor(expense.time / 1000)}:F>*`
                        };
                    }))
				);

				/* Previous plan purchase history */
				const history = plan.history.slice(-10);

				if (history.length > 0) response.addEmbed(builder => builder
					.setTitle("Previous charge-ups")
					.addFields(history.map(credit => ({
						name: `${Utils.titleCase(credit.type)}${credit.gateway ? `— *using **\`${credit.gateway}\`***` : ""}`,
						value: `**$${credit.amount.toFixed(2)}** — *<t:${Math.floor(credit.time / 1000)}:F>*`
					})))
				);

				const percentage = plan.used / plan.total;
				const size: number = 25;
				
				/* Whether the user has exceeded the limit */
				const exceededLimit: boolean = plan.used >= plan.total;

				/* Final, formatted diplay message */
				const displayMessage: string = !exceededLimit
					? `**$${plan.used.toFixed(2)}** \`${ProgressBar.display({ percentage, total: size })}\` **$${plan.total.toFixed(2)}**`
					: `_You ran out of credits for the **Pay-as-you-go** plan; re-charge credits ${showShopButton ? `using the **Purchase credits** button below` : `in **[our shop](${Utils.shopURL()})**`}_.`;

				builder.setTitle(`${type.location === "guild" ? "The server's" : "Your"} pay-as-you-go plan 📊` );
				builder.setDescription(displayMessage);

			} else if (type.type === "subscription") {
				const subscription = subscriptions[type.location]!;
				builder.setTitle(`${type.location === "guild" ? "The server's" : "Your"} Premium subscription ✨`);

				builder.addFields(
					{
						name: "Premium subscriber since", inline: true,
						value: `<t:${Math.floor(subscription.since / 1000)}:F>`,
					},

					{
						name: "Subscription active until", inline: true,
						value: `<t:${Math.floor(subscription.expires / 1000)}:F>, <t:${Math.floor(subscription.expires / 1000)}:R>`,
					}
				);
			}

			if (type.premium) buttons.components.unshift(
				new ButtonBuilder()
					.setCustomId(`settings:menu:${type.location}:premium`)
					.setLabel("Settings").setEmoji("⚙️")
					.setStyle(ButtonStyle.Secondary)
			);

			/* Add the `Buy credits` button, if applicable. */
			if (showShopButton) buttons.components.unshift(
				new ButtonBuilder()
					.setCustomId(`premium:purchase:${type.type}`).setEmoji("🛍️")
					.setLabel(type.type === "subscription" ? "Extend your subscription" : "Purchase credits")
					.setStyle(ButtonStyle.Success)
			);

		} else {
			builder.setDescription("You can buy a **Premium** subscription or **Premium** credits for the plan below.");

			if (showShopButton) buttons.components.unshift(
				new ButtonBuilder()
					.setCustomId(`premium:purchase:plan`).setEmoji("🛍️")
					.setLabel("Purchase credits")
					.setStyle(ButtonStyle.Success),

				new ButtonBuilder()
					.setCustomId(`premium:purchase:subscription`).setEmoji("🛍️")
					.setLabel("Subscribe")
					.setStyle(ButtonStyle.Success)
			);
		}

		response
			.addComponent(ActionRowBuilder<ButtonBuilder>, buttons)
			.addEmbed(builder);

		return response;
    }
}