import { chat } from "../../modules/gpt-api.js";
export default {
  name: "chat",
  description: "chat with bot",
  cooldown: "30s",
  async execute(message, client) {
    if (message.hasMedia) {
      const media = await message.downloadMedia();
      console.log(media);
    }

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
