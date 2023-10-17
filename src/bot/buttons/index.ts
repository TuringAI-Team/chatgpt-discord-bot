import { ButtonResponse } from "../types/command.js";
import campaignLink from "./campaignLink.js";
import paginated from "./paginated.js";
import settings from './settings.js'

export const Buttons: ButtonResponse[] = [campaignLink, paginated, settings];
