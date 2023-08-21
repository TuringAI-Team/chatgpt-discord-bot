import { createChatTone } from "../../helpers/tone.js";

export default createChatTone({
	name: "Neutral", emoji: "🤖", id: "neutral",
	description: "The usual neutral tone"

	/* We don't specify any messages to add to the prompt here, to keep the default tone of each model. */
});