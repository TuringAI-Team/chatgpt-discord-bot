import { Guild, GuildMember, Role, Snowflake, User } from "discord.js";

import { DatabaseInfractionOptions, DatabaseInteractionStatistics, DatabaseInteractionType, DatabaseSubscription, DatabaseSubscriptionType, DatabaseUser, DatabaseUserInfraction, UserSchema, UserSubscriptionLocation, UserSubscriptionType } from "../schemas/user.js";
import { DatabaseConversation, DatabaseMessage } from "../schemas/conversation.js";
import { DatabaseGuild, DatabaseGuildSubscription } from "../schemas/guild.js";
import { DatabaseModerationResult } from "../../moderation/moderation.js";
import { Conversation } from "../../conversation/conversation.js";
import { DatabaseDescription } from "../../image/description.js";
import { DatabaseImage } from "../../image/types/image.js";
import { DatabaseError } from "../../moderation/error.js";
import { SubClusterDatabaseManager } from "../sub.js";
import { VoteDuration } from "../../util/vote.js";

export interface DatabaseInfo {
    user: DatabaseUser;
    guild?: DatabaseGuild | null;
}

export class UserManager extends SubClusterDatabaseManager {
    public async getUser(user: User | Snowflake): Promise<DatabaseUser | null> {
        return this.db.fetchFromCacheOrDatabase<User | Snowflake, DatabaseUser>(
            "users", user
        );
    }

    public async fetchUser(user: User): Promise<DatabaseUser> {
        return this.db.createFromCacheOrDatabase<string, DatabaseUser, User>(
            "users", user.id, user
        );
    }

    public async getGuild(guild: Guild | Snowflake): Promise<DatabaseGuild | null> {
        return this.db.fetchFromCacheOrDatabase<Guild | Snowflake, DatabaseGuild>(
            "guilds", guild
        );
    }

    public async fetchGuild(guild: Guild): Promise<DatabaseGuild> {
        return this.db.createFromCacheOrDatabase<string, DatabaseGuild, Guild>(
            "guilds", guild.id, guild
        );
    }

    public async updateUser(user: DatabaseUser, updates: Partial<DatabaseUser>): Promise<DatabaseUser> {
        return this.db.queue.update("users", user, updates);
    }

    public async updateGuild(guild: DatabaseGuild, updates: Partial<DatabaseGuild>): Promise<DatabaseGuild> {
        return this.db.queue.update("guilds", guild, updates);
    }

    public async fetch(user: User, guild: Guild | null | undefined): Promise<DatabaseInfo> {
        return {
            user: await this.fetchUser(user),
            guild: guild ? await this.fetchGuild(guild) : null
        };
    }

    public async getImage(id: string): Promise<DatabaseImage | null> {
        return this.db.fetchFromCacheOrDatabase("images", id);
    }

    public async voted(user: DatabaseUser,): Promise<number | null> {
        return await this.db.schema("users", user, async (_, schema: UserSchema, entry) => {
            return schema.voted(entry);
        });
    }

    public async infraction(user: DatabaseUser, options: DatabaseInfractionOptions): Promise<DatabaseUser> {
        return await this.db.schema("users", user, async (_, schema: UserSchema, entry, context) => {
            return schema.infraction(entry, context);
        }, options);
    }

    public async banned(user: DatabaseUser): Promise<DatabaseUserInfraction | null> {
        return await this.db.schema("users", user, async (_, schema: UserSchema, entry) => {
            return schema.banned(entry);
        });
    }

    public async flag(user: DatabaseUser, data: DatabaseModerationResult): Promise<DatabaseUser> {
        return this.infraction(user, { type: "moderation", moderation: data })
    }

    public async warn(user: DatabaseUser, { by, reason, automatic }: Pick<DatabaseInfractionOptions, "reason" | "by" | "automatic">): Promise<DatabaseUser> {
        return this.infraction(user, { by, reason: reason ?? "Inappropriate use of the bot", type: "warn", seen: false, automatic: automatic });
    }

    public async ban(user: DatabaseUser, { by, reason, status, automatic  }: Pick<DatabaseInfractionOptions, "reason" | "by" | "automatic"> & { status: boolean }): Promise<DatabaseUser> {
        const banned: boolean = await this.banned(user) !== null;
        if (banned === status) return user;

        return this.infraction(user, { by, reason: reason ?? "Inappropriate use of the bot", type: status ? "ban" : "unban", automatic });
    }

    /**
     * Mark the specified infractions as seen for the user.
     * 
     * @param user User to mark the infractions as seen for
     * @param marked Infractions to mark as seen
     */
    public async read(user: DatabaseUser, marked: DatabaseUserInfraction[]): Promise<DatabaseUser> {
        let arr: DatabaseUserInfraction[] = user.infractions;

        /* Loop through the user's infractions, and when the infractions that should be marked as read were found, change their `seen` status. */
        arr = arr.map(
            i => marked.find(m => m.when === i.when) !== undefined ? { ...i, seen: true } : i
        );

        return await this.db.queue.update("users", user, { infractions: arr });
    }

    /**
     * Get a list of unread infractions for the user.
     * @param user User to get unread infractions of
     * @returns 
     */
    public unread(user: DatabaseUser): DatabaseUserInfraction[] {
        return user.infractions.filter(i => i.type === "warn" && i.seen === false);
    }

    /**
     * Increment the user's amount of interactions with the bot.
     * @param user User to increment interaction count for
     */
    public async incrementInteractions(db: DatabaseInfo, key: DatabaseInteractionType, increment: number = 1): Promise<DatabaseUser> {
        const updated: DatabaseInteractionStatistics = db.user.interactions;
        updated[key] = (updated[key] ?? 0) + increment;

        return this.updateUser(db.user, { interactions: updated });
    }

    public async userIcon({ user, guild }: DatabaseInfo): Promise<"⚒️" | "📊" | "✨" | "💫" | "✉️" | "📩" | "👤"> {
        if (this.db.role.moderator(user)) return "⚒️";
        const sub = await this.type({ user, guild });
        
        if (sub.type === "plan" && sub.location === "user") return "📊";
        if (sub.type === "subscription" && sub.location === "user") return "✨";
        if (sub.location === "guild" && sub.premium) return "💫";

        const votedAt: number | null = await this.voted(user);

        if (votedAt !== null) {
            if ((votedAt + VoteDuration) - Date.now() < 30 * 60 * 1000) return "📩";
            else return "✉️";
        }

        return "👤";
    }

    public async type(db: DatabaseInfo): Promise<UserSubscriptionType> {
        /* In which order to use the plans in */
        const locationPriority: UserSubscriptionLocation = this.db.settings.get(db.user, "premium:locationPriority");
        const typePriority: "plan" | "subscription" = this.db.settings.get(db.guild != undefined ? db[locationPriority]! : db.user, "premium:typePriority");

        const checks: Record<typeof typePriority, (entry: DatabaseGuild | DatabaseUser, type: UserSubscriptionLocation) => boolean> = {
            subscription: entry => this.subscription(entry) !== null,
            plan: (entry, location) => {
                /* Whether the user has the set Premium role */
                let hasRestrictedRole: boolean = true;

                /* If this was called on a guild, get it from the cache. */
                const guild: Guild | null = db.guild && location === "guild"
                    ? this.db.bot.client.guilds.cache.get(db.guild.id) ?? null
                    : null;

                if (location === "guild" && db.guild && guild !== null) {
                    /* ID of the Premium-restricted role */
                    const restrictedRoleID: Snowflake = this.db.settings.get(db.guild, "premium:role");

                    /* If a role is actually set, make sure that the user has that role. */
                    if (restrictedRoleID !== "0") {
                        const member: GuildMember | null = guild.members.cache.get(db.user.id) ?? null;
                        const role: Role | null = guild.roles.cache.get(restrictedRoleID) ?? null;

                        if (member !== null && member.permissions.has("ManageGuild")) hasRestrictedRole = true;
                        else if (role !== null) hasRestrictedRole = role.members.has(db.user.id);
                    }
                }

                return entry.plan !== null && this.db.plan.active(entry) && hasRestrictedRole;
            }
        };

        const locations: UserSubscriptionLocation[] = [ "guild", "user" ];
        const types: typeof typePriority[] = [ "plan", "subscription" ];

        if (locationPriority !== locations[0]) locations.reverse();
        if (typePriority !== types[0]) types.reverse();

        for (const type of types) {
            for (const location of locations) {
                const entry = db[location];
                if (!entry) continue;

                if (checks[type](entry, location)) return {
                    location, type, premium: true
                };
            }
        }

        if (await this.voted(db.user)) return { type: "voter", location: "user", premium: false };
        return { type: "free", location: "user", premium: false };
    }

    public async canUsePremiumFeatures(db: DatabaseInfo): Promise<boolean> {
        return (await this.type(db)).premium;
    }

    /**
     * Get information about the user/guild's current subscription, if available.
     * @param db User/guild to get subscription for
     * 
     * @returns User/guild's current subscription, if available
     */
    public subscription<T extends DatabaseGuildSubscription | DatabaseSubscription>(db: DatabaseUser | DatabaseGuild): T | null {
        if (db.subscription === null) return null;
        if (db.subscription !== null && Date.now() > db.subscription.expires) return null;

        return {
            ...db.subscription as T,
            
            /* Handle an edge case where `since` and `expires` are actually a date string instead of a UNIX timestamp. */
            since: typeof db.subscription.since === "string" ? Date.parse(db.subscription.since) : db.subscription.since,
            expires: typeof db.subscription.expires === "string" ? Date.parse(db.subscription.expires) : db.subscription.expires
        };
    }

    /**
     * Grant the specified user a subscription.
     * 
     * @param entry User to grant subscription
     * @param expires When the subscription should expire
     */
    public async grantSubscription(entry: DatabaseUser | DatabaseGuild, type: DatabaseSubscriptionType, expires: number, by?: Snowflake): Promise<void> {
        const updated: DatabaseSubscription | DatabaseGuildSubscription = {
            since: entry.subscription !== null ? entry.subscription.since : Date.now(),
            expires: (entry.subscription ? entry.subscription.expires - Date.now() : 0) + Date.now() + expires,
        };

        if (type === "guild") (updated as DatabaseGuildSubscription).by = by!;

        return void await this.db.queue.update(`${type}s`, entry, { subscription: updated });
    }

    /**
     * Revoke the specified user's active subscription.
     * @param entry User to revoke subscription
     */
    public async revokeSubscription(entry: DatabaseUser | DatabaseGuild, type: DatabaseSubscriptionType): Promise<void> {
        return void await this.db.queue.update(`${type}s`, entry as DatabaseUser, { subscription: null });
    }

    public async updateConversation(conversation: Conversation, updates: Partial<DatabaseConversation>): Promise<void> {
        /* Existing conversation database entry */
        const existing: DatabaseConversation | null = conversation.db ?? await conversation.cached();

        /* The new, updated conversation entry */
        const updated: DatabaseConversation = await this.db.queue.update("conversations", existing ?? conversation.id, updates);
        conversation.db = updated;
    }

    public async updateInteraction(message: DatabaseMessage): Promise<void> {
        await this.db.queue.update("interactions", message.id, message);
    }

    public async getError(id: string): Promise<DatabaseError | null> {
        return this.db.fetchFromCacheOrDatabase<string, DatabaseError>(
            "errors", id
        );
    }

    public async updateError(error: DatabaseError): Promise<void> {
        await this.db.queue.update("errors", error.id, error);
    }

    public async updateImage(image: DatabaseImage): Promise<DatabaseImage> {
        return await this.db.queue.update<DatabaseImage>("images", image.id, image);
    }

    public async updateImageDescription(image: DatabaseDescription | string, updates: DatabaseDescription): Promise<DatabaseDescription> {
        return await this.db.queue.update("descriptions", image, updates);
    }
}