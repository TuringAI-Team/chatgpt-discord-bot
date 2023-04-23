import { Awaitable, User } from "discord.js";

import { DatabaseInfo } from "../../db/managers/user.js";
import { Bot } from "../../bot/bot.js";
import chalk from "chalk";

interface BotDetectionTest {
    /* Name of the test */
    name: string;

    /* Function to execute to run this test */
    execute: (options: Pick<BotDetectionOptions, "user">) => Awaitable<boolean>;
}

interface BotDetectionOptions {
    user: User;
    db: DatabaseInfo;
}

export interface BotDetectionResult {
    /* Whether the user was detected as an automated account */
    blocked: boolean;

    /* Number value between 0-1, showing how many tests were failed / total amount of tests */
    score: number;
}

/* List of tests to run */
const BotDetectionTests: BotDetectionTest[] = [
    {
        name: "Check account age",
        execute: ({ user }) => Date.now() - user.createdTimestamp > 7 * 24 * 60 * 60 * 1000
    }
]

/**
 * Detect whether a user is classified as an automated account, using a defined set of rules.
 * @param options Information about the given user
 * 
 * @returns Information about the detection
 */
export const executeBotDetection = async (bot: Bot, { user }: BotDetectionOptions): Promise<BotDetectionResult | null> => {
    const total: number = BotDetectionTests.length;
    let passed: number = 0;

    for (const [ index, test ] of BotDetectionTests.entries()) {
        try {
            const result: boolean = await test.execute({ user });
            if (result) passed++;

        } catch (error) {
            bot.logger.warn(`Failed to execute bot detection test ${chalk.bold(test.name)} for ${chalk.bold(user.tag)}`);
        }
    }

    /* Total calculated score */
    const score: number = passed !== 0 ? passed / total : 0;

    /* Whether the request should be blocked */
    const blocked: boolean = score < 0.5;

    return {
        score, blocked
    };
}