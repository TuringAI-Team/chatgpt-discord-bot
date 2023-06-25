import { DatabaseImage } from "../../image/types/image.js";
import { type AppDatabaseManager } from "../app.js";
import { DatabaseSchema } from "./schema.js";

export class ImageSchema extends DatabaseSchema<DatabaseImage> {
    constructor(db: AppDatabaseManager) {
        super(db, {
            collection: "images"
        });
    }
}