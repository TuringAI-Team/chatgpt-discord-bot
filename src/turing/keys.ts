import { TuringAPIKey, TuringAPIKeyData } from "./types/key.js";
import { TuringAPI, TuringAPIRequest } from "./api.js";
import { DatabaseUser } from "../db/schemas/user.js";

export class TuringKeyManager {
    private readonly api: TuringAPI;

    constructor(api: TuringAPI) {
        this.api = api;
    }

    public async create(db: DatabaseUser, name: string): Promise<TuringAPIKeyData> {
        const { key } = await this.request<{ key: TuringAPIKeyData }>({
            path: "key", method: "POST", body: {
                name, user: db.id
            }
        });

        return key;
    }

    public async delete(db: DatabaseUser, key: TuringAPIKey): Promise<void> {
        await this.request({
            path: "key", method: "DELETE", body: {
                keyId: key.id, user: db.id
            }
        });
    }

    public async list(db: DatabaseUser): Promise<TuringAPIKey[]> {
        const { keys } = await this.request<{ keys: TuringAPIKey[] }>({
            path: `key/u/${db.id}`
        });

        return keys;
    }

    public async info(db: DatabaseUser, key: TuringAPIKey): Promise<TuringAPIKeyData> {
        const { key: data } = await this.request<{ key: TuringAPIKeyData }>({
            path: `key/k/${key.id}/${db.id}`
        });

        return data;
    }

    private async request<T>(options: TuringAPIRequest): Promise<T> {
        return this.api.request({
            ...options,

            headers: {
                secret: this.api.bot.app.config.turing.super
            }
        });
    }
}