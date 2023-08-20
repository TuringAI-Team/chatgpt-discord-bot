export interface DBSubscription {
    /* Since when the user has an active subscription */
    since: number;

    /* When this premium subscription expires */
    expires: number;
}

type PlanExpenseType = "image" | "api" | "summary" | "chat" | "describe" | "translate" | "music";

type PlanExpenseData = {
    [key: string]: string | number | boolean | PlanExpenseData;
}

interface UserPlanExpense<T extends PlanExpenseData = PlanExpenseData> {
    /* Type of expense */
    type: PlanExpenseType;

    /* When this expense was made */
    time: number;

    /* How much was used for this expense, e.g. 0.000342) */
    used: number;

    /* Other information about this expense, e.g. for Chat expenses it contains `model`, `completionTokens` and `promptTokens` */
    data: T;
}

type PlanCreditType = "web" | "grant";
type PlanCreditGateway = "BITCOIN" | "ETHEREUM" | "BINANCE_COIN" | "MONERO" | "STRIPE" | "PAYPAL" | "BINANCE";

interface PlanCredit {
    /* What type of charge-up this is */
    type: PlanCreditType;

    /* Which gateway was used */
    gateway: PlanCreditGateway | null;

    /* When this charge-up was done */
    time: number;

    /* How much was charged up, e.g. 5.00 (5,00 USD) */
    amount: number;
}

export interface DBPlan {
    /* How much credit the user has charged up, e.g. 17.80 (17,80 USD)  */
    total: number;

    /* How much credit the user has already used, e.g. 3.38834 (~3,38 USD) */
    used: number;

    /* Each expense the user makes is logged here */
    expenses: UserPlanExpense[];

    /* Each charge-up the user makes is logged here */
    history: PlanCredit[];
}