import { Client } from "whatsapp-web.js";
import axios from "axios";
import qrcode from "qrcode-terminal";

const client = new Client({});

client.on("qr", async (qr) => {
  var qrstring = await axios({
    url: `http://asciiqr.com/index.php?i=&t=${qr}`,
    method: "GET",
  });
  var imageLink = qrstring.data.split("[Image Link]")[1].split(")")[0];
  axios
    .post(
      process.env.DISCORD_WEBHOOK_URL,
      {
        content: `Scan qr code`,
        embeds: [
          {
            image: {
              url: imageLink.replaceAll("(", ""),
            },
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
    .catch(function (error) {
      console.log(error);
    });
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
