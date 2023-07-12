import { DatabaseDescription } from "../../image/description.js";
import { type AppDatabaseManager } from "../app.js";
import { DatabaseSchema } from "./schema.js";

export class DescriptionSchema extends DatabaseSchema<DatabaseDescription> {
    constructor(db: AppDatabaseManager) {
        super(db, {
            collection: "descriptions"
        });
    }
}