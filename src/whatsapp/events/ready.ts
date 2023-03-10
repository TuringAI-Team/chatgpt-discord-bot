import chalk from "chalk";
import ms from "ms";

export default {
  name: "ready",
  async execute(client) {
    client.webhook.send({
      content: "whatsapp bot is ready!",
      username: "whatsapp bot",
      avatarURL:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/479px-WhatsApp.svg.png",
    });
    console.log("Client is ready!");
    await client.setStatus("Waiting for commands...");
    await client.setDisplayName("ChatGPT");
  },
};
