import { createChatTone } from "../../helpers/tone.js";

export default createChatTone({
	name: "Precise", emoji: "📜", id: "precise",
	description: "Straight to the point; only get the information you requested",

	prompt: {
		role: "assistant",
		content: "I must provide only the requested information, directly and precisely, without adding any extra information. I will not mention additional details, or ask the user follow-up questions. I will provide concise responses."
	}
});