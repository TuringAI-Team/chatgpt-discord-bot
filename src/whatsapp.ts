import { Client } from "whatsapp-web.js";
import axios from "axios";
import qrcode from "qrcode-terminal";

const client = new Client({});

client.on("qr", async (qr) => {
  console.log("QR RECEIVED", qr);
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  axios.post(
    process.env.DISCORD_WEBHOOK_URL,
    {
      content: `Client ready`,
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  console.log("Client is ready!");
});

client.initialize();

client.on("message", async (message) => {
  if (!(message.from || message.body.length)) return;
  console.log(message);
});
