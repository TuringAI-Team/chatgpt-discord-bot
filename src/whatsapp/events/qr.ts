import qrcode from "qrcode";
import { AttachmentBuilder } from "discord.js";
import fs from "fs";

export default {
  name: "qr",
  async execute(qr, client) {
    await qrcode.toFile("qr.png", qr, { type: "png" });
    let file = fs.readFileSync("qr.png");
    const attachment = new AttachmentBuilder(file, { name: "qr.png" });
    await client.webhook.send({
      content: "whatsapp bot qr:",
      username: "whatsapp bot",
      avatarURL:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/479px-WhatsApp.svg.png",
      files: [attachment],
    });
  },
};
