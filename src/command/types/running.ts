import { Snowflake } from "discord.js";

export interface RunningData {
    /* When the command started running */
    since: number;

    /* Which channel ID the command is running in */
    channel: Snowflake | null;
}