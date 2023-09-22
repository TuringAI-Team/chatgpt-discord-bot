export type MetricTypes = "guilds" | "users" | "credits" | "chat" | "image" | "vote" | "commands" | "cooldown"

export interface Metric {
    id: string;
    type: MetricTypes;
    time: number;
    data: any;
}