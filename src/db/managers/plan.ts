import { StableHordeGenerationResult } from "../../image/types/image.js";
import { DatabaseGuild, DatabaseInfo, DatabaseUser } from "./user.js";
import { ChatInteraction } from "../../conversation/conversation.js";
import { TuringVideoResult } from "../../turing/api.js";
import { ClientDatabaseManager } from "../cluster.js";
import { ImageDescription } from "./description.js";

type DatabaseEntry = DatabaseUser | DatabaseGuild

type UserPlanExpenseType = "image" | "dall-e" | "video" | "summarize" | "chat" | "describe"

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

export type UserPlanImageDescribeExpense = UserPlanExpense<{
    duration: number;
}>

export type UserPlanVideoExpense = UserPlanExpense<{
    duration: number;
}>

type UserPlanCreditType = "web" | "grant"
type UserPlanCreditGateway = "paypal" | "card" | "bitcoin" | "ethereum" | "monero" | "binance"

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

export type UserPlanCreditBonusAmount = 0.05 | 0.10 | 0.15

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

export type PlanCreditVisility = "detailed" | "full" | "used" | "percentage" | "hide"

export const PlanCreditViewers: Record<PlanCreditVisility, (plan: UserPlan, interaction: ChatInteraction) => string | null> = {
    detailed: (plan, interaction) => `${interaction.output.raw!.usage!.completion} tokens • $${plan.used.toFixed(2)} / $${plan.total.toFixed(2)}`,
    full: plan => `$${plan.used.toFixed(2)} / $${plan.total.toFixed(2)}`,
    used: plan => `$${plan.used.toFixed(2)}`,
    percentage: plan => plan.used > 0 ? `${(plan.used / plan.total * 100).toFixed(1)}%` : null,
    hide: () => null
}

export class PlanManager {
    private db: ClientDatabaseManager;

    constructor(db: ClientDatabaseManager) {
        this.db = db;
    }

    public location(entry: DatabaseEntry): PlanLocation {
        if ((entry as any).voted != undefined) return PlanLocation.User;
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
            expenses: plan.expenses ?? [],
            history: plan.history ?? [],
            total: plan.total ?? 0,
            used: plan.used ?? 0
        };
    }

    public async expense<T extends UserPlanExpense = UserPlanExpense>(
        db: DatabaseEntry | DatabaseInfo, { type, used, data, bonus }: Pick<T, "type" | "used" | "data"> & { bonus?: UserPlanCreditBonusAmount }
    ): Promise<T | null> {
        /* The new expense */
        const expense: T = {
            type, used, data,
            time: Date.now()
        } as T;

        const entry: DatabaseEntry = (db as any).user
            ? (db as DatabaseInfo)[this.db.users.type(db as DatabaseInfo).location]!
            : db as DatabaseEntry;

        /* The entry's current plan */
        if (entry.plan === null) return null;
        const plan: UserPlan = this.get(entry)!;

        let additional: number = used;
        if (bonus) additional += additional * bonus;

        /* Updated, total usage; limit their usage their minimum usage to 0 */
        const updatedUsage: number = Math.max(plan.used + additional, 0);

        await this.db.users[this.location(entry) === PlanLocation.Guild ? "updateGuild" : "updateUser"](entry as any, {
            plan: {
                ...plan,

                expenses: [ ...plan.expenses, expense ],
                used: updatedUsage
            }
        });

        return expense;
    }

    public async expenseForChat(
        entry: DatabaseEntry | DatabaseInfo, { used, data }: Pick<UserPlanChatExpense, "used" | "data"> & { bonus?: UserPlanCreditBonusAmount }
    ): Promise<UserPlanChatExpense | null> {
        return this.expense(entry, {
            type: "chat", used, data
        });
    }

    public async expenseForImage(
        entry: DatabaseEntry | DatabaseInfo, result: StableHordeGenerationResult
    ): Promise<UserPlanImageExpense | null> {
        return this.expense(entry, {
            type: "image", used: result.kudos / 4000, data: { kudos: result.kudos }, bonus: 0.10
        });
    }

    public async expenseForDallEImage(
        entry: DatabaseEntry | DatabaseInfo, count: number
    ): Promise<UserPlanDallEExpense | null> {
        return this.expense(entry, {
            type: "dall-e", used: count * 0.02, data: { count }, bonus: 0.10
        });
    }

    public async expenseForImageDescription(
        entry: DatabaseEntry | DatabaseInfo, result: ImageDescription
    ): Promise<UserPlanImageDescribeExpense | null> {
        return this.expense(entry, {
            type: "describe", used: (result.duration / 1000) * 0.0023, data: { duration: result.duration }, bonus: 0.10
        });
    }

    public async expenseForVideo(
        entry: DatabaseEntry | DatabaseInfo, video: TuringVideoResult
    ): Promise<UserPlanVideoExpense | null> {
        return this.expense(entry, {
            type: "video", used: (video.duration / 1000) * 0.0023, data: { duration: video.duration }, bonus: 0.05
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

                history: [ ...plan.history.slice(-(PLAN_MAX_EXPENSE_HISTORY - 1)), credit ],
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

    public display(entry: DatabaseEntry): { used: string, total: string, all: string } {
        if (entry.plan === null) throw new Error("User/guild doesn't have a running plan");

        const used: string = `$${entry.plan.used.toFixed(2)}`;
        const total: string = `$${entry.plan.total.toFixed(2)}`;

        return {
            used, total, all: `${used} / ${total}`
        };
    }
}