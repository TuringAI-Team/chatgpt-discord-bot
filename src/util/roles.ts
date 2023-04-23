import { GuildMember, Snowflake } from "discord.js"

import { DatabaseUser } from "../db/managers/user.js";
import { Bot } from "../bot/bot.js";
import chalk from "chalk";

/* ID of the Premium role */
export const PREMIUM_ROLE_ID: Snowflake = "1085376863670644756"

enum PremiumRoleStatus {
    /* The user is not a Premium meber */
    NoSubscription,

    YesWithoutSubscription,
    NoWithoutSubscription,

    YesWithSubscription,
    NoWithSubscription
}

export class PremiumRole {
    private static async db(bot: Bot, member: GuildMember): Promise<DatabaseUser> {
        return await bot.db.users.fetchUser(member.user);
    }

    public static async hasRole(bot: Bot, member: GuildMember, existing?: DatabaseUser): Promise<PremiumRoleStatus> {
        /* Database instance of the member */
        const user: DatabaseUser = existing ?? await this.db(bot, member);

        /* Whether the user has Premium */
        const premium: boolean = bot.db.users.canUsePremiumFeatures({ user });

        /* Whether the user has the role */
        const hasRole: boolean = member.roles.cache.find(r => r.id === PREMIUM_ROLE_ID) != undefined;

        if (!premium) return hasRole ? PremiumRoleStatus.YesWithoutSubscription : PremiumRoleStatus.NoWithoutSubscription;
        return hasRole ? PremiumRoleStatus.YesWithSubscription : PremiumRoleStatus.NoWithSubscription;
    }

    public static async grantRole(bot: Bot, member: GuildMember): Promise<void> {
        /* Give the user their role. */
        await member.roles.add(PREMIUM_ROLE_ID);
    }

    public static async revokeRole(bot: Bot, member: GuildMember): Promise<void> {
        /* Revoke the user their role. */
        await member.roles.remove(PREMIUM_ROLE_ID);
    }

    public static async checkRole(bot: Bot, member: GuildMember): Promise<PremiumRoleStatus> {
        /* Database instance of the member */
        const user: DatabaseUser = await this.db(bot, member);

        /* Whether the user has their role */
        const hasRole: PremiumRoleStatus = await this.hasRole(bot, member, user);

        if (hasRole === PremiumRoleStatus.YesWithoutSubscription) {
            bot.logger.debug(`User ${chalk.bold(member.user.tag)} was revoked their Premium role.`);
            await this.revokeRole(bot, member);
        } else if (hasRole === PremiumRoleStatus.NoSubscription || hasRole === PremiumRoleStatus.NoWithoutSubscription) return hasRole;

        if (hasRole === PremiumRoleStatus.NoWithSubscription) {
            bot.logger.debug(`User ${chalk.bold(member.user.tag)} was given their Premium role.`);
            await this.grantRole(bot, member);
        } else if (hasRole === PremiumRoleStatus.YesWithSubscription) return hasRole;

        return PremiumRoleStatus.NoSubscription;
    }
}