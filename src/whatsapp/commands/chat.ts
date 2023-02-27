import { chat } from "../../modules/gpt-api.js";
export default {
  name: "chat",
  description: "chat with bot",
  cooldown: "2m",
  async execute(message, client) {
    await message.load();

    var resoponse = await chat(
      message.content,
      message.user.name,
      message.user.ispremium,
      "chatgpt",
      message.user.id,
      0,
      null
    );
    await message.reply(resoponse.text);
  },
};
