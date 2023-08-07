export type TuringChatPluginsToolResult = Record<any, any> & {
    image?: string;
}

export interface TuringChatPluginsTool {
    name: string | null;
    input: Record<any, any> | null;
    result: TuringChatPluginsToolResult | null;
    error: Record<any, any> | null;
}