import api from "api";

const sdk = api("@writesonic/v2.2#4enbxztlcbti48j");

export default async function chatSonic(msg: string) {
  sdk.auth(process.env.CHATSONIC);
  try {
    var { data } = await sdk.chatsonic_V2BusinessContentChatsonic_post(
      {
        enable_google_results: "true",
        enable_memory: false,
        input_text: msg,
      },
      { engine: "premium" }
    );
    console.log(data);
    return { text: data.message, type: "chatsonic" };
  } catch (err) {
    return { error: err };
  }
}
