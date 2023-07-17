import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, GuildMember, InteractionReplyOptions } from "discord.js";

import { RunPodMusicGenResult } from "../../runpod/models/musicgen.js";
import { ChatInteraction } from "../../conversation/conversation.js";
import { DatabaseManager, DatabaseManagerBot } from "../manager.js";
import { DatabaseDescription } from "../../image/description.js";
import { ErrorResponse } from "../../command/response/error.js";
import { CommandInteraction } from "../../command/command.js";
import { SummaryPrompt } from "../../commands/summarize.js";
import { DatabaseImage } from "../../image/types/image.js";
import { UserSubscriptionType } from "../schemas/user.js";
import { DatabaseEntry, DatabaseInfo } from "./user.js";
import { ProgressBar } from "../../util/progressBar.js";
import { ClusterDatabaseManager } from "../cluster.js";
import { YouTubeVideo } from "../../util/youtube.js";
import { Response } from "../../command/response.js";
import { AppDatabaseManager } from "../app.js";
import { SubDatabaseManager } from "../sub.js";
import { Utils } from "../../util/utils.js";

type UserPlanExpenseType = "image" | "api" | "summary" | "chat" | "describe" | "translate" | "music"

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
    data: T;
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
    model: string;
}>

export type UserPlanDallEExpense = UserPlanExpense<{
    count: number;
}>

export type UserPlanImageDescribeExpense = UserPlanExpense<{
    duration: number;
}>

export type UserPlanMusicExpense = UserPlanExpense<{
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

export type UserPlanAPIExpense = UserPlanExpense<{
    model: string;
    type: string;
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

export interface DatabasePlan {
    /* How much credit the user has charged up, e.g. 17.80 (17,80 USD)  */
    total: number;

    /* How much credit the user has already used, e.g. 3.38834 (~3,38 USD) */
    used: number;

    /* Each expense the user makes is logged here */
    expenses: UserPlanExpense[];

    /* Each charge-up the user makes is logged here */
    history: UserPlanCredit[];
}

export enum PlanLocation {
    Guild = "guild",
    User = "user"
}

export type PlanCreditVisibility = "detailed" | "full" | "used" | "percentage" | "hide"
export type PlanCreditViewer = (plan: DatabasePlan, interaction: ChatInteraction) => string | null

export const PlanCreditViewers: Record<PlanCreditVisibility, PlanCreditViewer> = {
    detailed: (plan, interaction) => `${interaction.output.raw?.usage ? `${interaction.output.raw.usage.completion} tokens •` : interaction.output.raw?.cost ? `$${interaction.output.raw.cost.toFixed(4)} •` : ""} $${plan.used.toFixed(2)} / $${plan.total.toFixed(2)}`,
    full: plan => `$${plan.used.toFixed(2)} / $${plan.total.toFixed(2)}`,
    used: plan => `$${plan.used.toFixed(2)}`,
    percentage: plan => plan.used > 0 ? `${(plan.used / plan.total * 100).toFixed(1)}%` : null,
    hide: () => null
}

export type PlanExpenseEntryViewer<T extends UserPlanExpense = any> = (
    (expense: T & { data: NonNullable<T["data"]> }, plan: DatabasePlan) => string | null
) | null

export const PlanExpenseEntryViewers: {
    image: PlanExpenseEntryViewer<UserPlanImageExpense>,
    summary: PlanExpenseEntryViewer<UserPlanSummaryExpense>,
    chat: PlanExpenseEntryViewer<UserPlanChatExpense>,
    describe: PlanExpenseEntryViewer<UserPlanImageDescribeExpense>,
    translate: PlanExpenseEntryViewer<UserPlanTranslateExpense>,
    music: PlanExpenseEntryViewer<UserPlanMusicExpense>
    api: PlanExpenseEntryViewer<UserPlanAPIExpense>
} = {
    image: null,
    summary: e => `used **${e.data.tokens}** tokens`,
    chat: e => `using \`${e.data.model}\`${e.data.tokens ? `, **${e.data.tokens.prompt}** prompt & **${e.data.tokens.completion}** completion tokens` : ""}`,
    describe: e => `took **${e.data.duration} ms**`,
    translate: e => `translated from **\`${e.data.source}\`**, used **${e.data.tokens.prompt}** prompt & **${e.data.tokens.completion}** completion tokens`,
    music: e => `took **${e.data.duration} ms**`,
    api: null
}

export class BasePlanManager<T extends DatabaseManager<DatabaseManagerBot>> extends SubDatabaseManager<T> {
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
    public get({ plan }: DatabaseEntry): DatabasePlan | null {
        if (plan === null) return null;

        return {
            expenses: typeof plan.expenses === "number" ? [] : plan.expenses ?? [],
            history: plan.history ?? [],
            total: plan.total ?? 0,
            used: plan.used ?? 0
        };
    }
}

export class AppPlanManager extends BasePlanManager<AppDatabaseManager> {

}

export class ClusterPlanManager extends BasePlanManager<ClusterDatabaseManager> {
    private functionName(entry: DatabaseEntry): "updateUser" | "updateGuild" {
        return this.db.users.updateType(entry);
    }

    public async expense<T extends UserPlanExpense = UserPlanExpense>(
        db: DatabaseInfo, { type, used, data, bonus }: Pick<T, "type" | "used" | "data"> & { bonus?: UserPlanCreditBonusAmount }
    ): Promise<T | null> {
        /* If no used amount of credit was actually specified, ignore this. */
        if (used === 0) return null;

        const userType = await this.db.users.type(db);
        const entry = db[userType.location]!;

        /* Check whether the user/guild has actually configured to use this plan. */
        if (!this.active(entry) || userType.type !== "plan") return null;

        /* The new expense */
        const expense: T = {
            type, used, data,
            time: Date.now()
        } as T;

        /* The entry's current plan */
        const plan: DatabasePlan = this.get(entry)!;

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
        entry: DatabaseInfo, result: DatabaseImage
    ): Promise<UserPlanImageExpense | null> {
        return this.expense(entry, {
            type: "image", used: result.cost, data: {
                model: result.model
            }, bonus: 0.10
        });
    }

    public async expenseForImageDescription(
        entry: DatabaseInfo, result: DatabaseDescription
    ): Promise<UserPlanImageDescribeExpense | null> {
        let cost: number = (Math.max(result.duration, 1000) / 1000) * 0.0004;

        return this.expense(entry, {
            type: "describe", used: cost, data: { duration: result.duration }, bonus: 0.10
        });
    }

    public async expenseForMusic(
        entry: DatabaseInfo, result: RunPodMusicGenResult
    ): Promise<UserPlanMusicExpense | null> {
        return this.expense(entry, {
            type: "music", used: (Math.max(result.raw.duration, 1000) / 1000) * 0.0004, data: { duration: result.raw.duration }, bonus: 0.10
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
            ? (db as DatabaseInfo)[(await this.db.users.type(db as DatabaseInfo)).location]!
            : db as DatabaseEntry;

        /* The entry's current plan */
        if (entry.plan === null) throw new Error("User/guild doesn't have a running plan");
        const plan: DatabasePlan = this.get(entry)!;

        /* Updated, total credit */
        const updatedCredit: number = plan.total + amount;

        await this.db.users[this.functionName(entry)](entry as any, {
            plan: {
                ...plan,

                history: [ ...plan.history, credit ],
                total: updatedCredit
            }
        });

        return credit;
    }

    public async create(entry: DatabaseEntry, amount?: number): Promise<DatabasePlan> {
        /* If the user already has a pay-as-you-go plan, just return that instead. */
        if (entry.plan !== null) return entry.plan;

        /* The user's new plan */
        const plan: DatabasePlan = {
            total: amount ?? 0, used: 0,
            expenses: [], history: []
        };

        await this.db.users[this.functionName(entry)](entry as any, {
            plan
        });

        return plan;
    }

    public async remove(entry: DatabaseEntry): Promise<void> {
        /* If the entry doesn't have a running plan, simply skip this. */
        if (entry.plan === null) return;

        await this.db.users[this.functionName(entry)](entry as any, {
            plan: null
        });
    }

    public async handleInteraction(interaction: ButtonInteraction): Promise<void> {
        /* Information about what action to perform, etc. */
        const data: string[] = interaction.customId.split(":");
        data.shift();

        /* Which action to perform */
        const action: "overview" = data.shift()! as any;

        /* Database instances, guild & user */
        const db: DatabaseInfo = await this.db.users.fetch(interaction.user, interaction.guild);

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
		const type: UserSubscriptionType = await this.db.users.type({ user, guild });

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
				const expenses = plan.expenses.filter(e => e.type !== "api").slice(-10);

				if (expenses.length > 0) response.addEmbed(builder => builder
					.setTitle("Previous expenses")
					.addFields(expenses.map(expense => {
                        /* Formatter for this expense type */
                        const viewer: PlanExpenseEntryViewer | null = PlanExpenseEntryViewers[expense.type] ?? null;
                        const formatted: string | null = viewer !== null ? viewer(expense, plan) : null;

                        return {
                            name: `${Utils.titleCase(expense.type)}${formatted !== null ? ` — *${formatted}*` : ""} — **$${Math.round(expense.used * Math.pow(10, 5)) / Math.pow(10, 5)}**`,
                            value: `*<t:${Math.floor(expense.time / 1000)}:F>*`
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