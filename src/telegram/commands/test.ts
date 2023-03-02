import { chat } from "../../modules/gpt-api.js";
export default {
  name: "test",
  description: "chat with bot",
  cooldown: "30s",
  async execute(ctx, client) {
    console.log(ctx);
  },
};
