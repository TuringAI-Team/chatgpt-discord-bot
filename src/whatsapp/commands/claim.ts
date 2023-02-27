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

/*fffa04bc-fb53-4cea-8fb8-250cf2a050a4
4d2b7f05-edb2-4310-93dc-91c006a9148b
0db46493-626e-4ccb-9f80-c4629bb096da
cc6556f0-1d8a-4343-a2e5-f95b23798988
8714093f-2b7c-40f6-9675-895aa8d65004*/
