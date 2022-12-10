require("dotenv").config();
const { ChatGPTAPI } = require("chatgpt");

const api = new ChatGPTAPI({
  sessionToken: process.env.SESSION_TOKEN,
});

async function initChat() {
  // ensure the API is properly authenticated
  await api.ensureAuth();
}
async function chat(msg) {
  const response = await api.sendMessage(msg);

  return response;
}

module.exports = {
  chat,
  initChat,
};
