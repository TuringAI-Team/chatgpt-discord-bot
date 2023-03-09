import { activateKey } from "../../modules/premium.js";

export default {
  name: "claim",
  description: "Claim premium key",
  cooldown: null,
  async execute(message, client, args) {
    await message.load();
    var key = args[0];
    var r = await activateKey(key, message.user.id, "user");
    if (r.error) {
      await message.reply(r.error);
      return;
    }
    if (r.message) {
      await message.reply(`${r.message}`);
    }
  },
};
