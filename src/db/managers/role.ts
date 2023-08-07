import { SubClusterDatabaseManager } from "../sub.js";
import { DatabaseUser } from "../schemas/user.js";

export type UserRole = "tester" | "api" | "investor" | "advertiser" | "moderator" | "owner"
export type UserRoles = UserRole[]

export const UserRoleHierarchy: UserRoles = [
    "owner", "moderator", "investor", "advertiser", "api", "tester"
]

interface UserRoleChanges {
    /* Roles to add */ 
    add?: UserRoles;

    /* Roles to remove */
    remove?: UserRoles;
}

export enum UserHasRoleCheck {
    /* The user must have all specified roles */
    All,

    /* The user must have one of the specified roels */
    Some,

    /* The user must not have all the specified */
    NotAll,

    /* The user must not have some of the roles */
    NotSome
}

export class UserRoleManager extends SubClusterDatabaseManager {
    public roles(user: DatabaseUser): UserRoles {
        return user.roles;
    }

    public has(user: DatabaseUser, role: UserRole | UserRole[], check: UserHasRoleCheck = UserHasRoleCheck.All): boolean {
        if (Array.isArray(role)) {
            if (check === UserHasRoleCheck.All) return role.every(r => user.roles.includes(r));
            else if (check === UserHasRoleCheck.Some) return role.some(r => user.roles.includes(r));
            else if (check === UserHasRoleCheck.NotAll) return role.every(r => !user.roles.includes(r));
            else if (check === UserHasRoleCheck.NotSome) return role.some(r => !user.roles.includes(r));

            return false;
        } else return user.roles.includes(role);
    }

    /* Shortcuts */
    public moderator(user: DatabaseUser): boolean { return this.has(user, "moderator"); }
    public tester(user: DatabaseUser): boolean { return this.has(user, "tester"); }
    public owner(user: DatabaseUser): boolean { return this.has(user, "owner"); }
    public investor(user: DatabaseUser): boolean { return this.has(user, "investor"); }
    public advertiser(user: DatabaseUser): boolean { return this.has(user, "advertiser"); }
    public api(user: DatabaseUser): boolean { return this.has(user, "api"); }

    public async toggle(user: DatabaseUser, role: UserRole, status?: boolean): Promise<DatabaseUser> {
        return await this.change(user, {
            [status ?? !this.has(user, role) ? "add" : "remove"]: [ "tester" ]
        });
    }

    public async change(user: DatabaseUser, changes: UserRoleChanges): Promise<DatabaseUser> {
        /* Current roles */
        let updated: UserRoles = user.roles;

        if (changes.remove) updated = updated.filter(r => !changes.remove!.includes(r));
        if (changes.add) updated.push(...changes.add.filter(r => !updated.includes(r)));

        return this.db.users.updateUser(user, {
            roles: updated
        });
    }
}