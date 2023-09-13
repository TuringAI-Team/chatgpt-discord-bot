// es simplemente que te obstrulle a hacer ../../ o ir muy profundo en una carpeta, debes de llamar a un archivo main siempre
import { Guild } from "./models/guilds.js";
import { User } from "./models/users.js";
// valee ok lo hago ahora
export interface Environment {
	user: User;
	guild: Guild | null;
}
