import { chat } from "../../modules/gpt-api.js";
export default {
  name: "chat",
  description: "chat with bot",
  cooldown: "30s",
  async execute(message, client) {
  	var image;
  	var messagee = message.message;
  	if (messagee.photo && messagee.photo.length > 0) {
  		var photo = messagee.photo[messagee.photo.length - 1];
      const buffer = await ctx.telegram.getFile(photoSize.file_id).then((result) => {
    return ctx.telegram.getFileLink(result.file_id);
         const base64 = buffer.toString('base64');
        
        var url = `data:image/png;base64,${base64}`;
        image = { url };
    });
  	}
  	else if(message.audio){
  		var audio_data = await message.telegram.getFile(messagee.audio.file_id);
  		var transcription: any = await getTranscription(audio_data);
        if (transcription.error) {
          await message.reply("Error occured");
          return;
        } else {
          message.content = transcription;
        }
  	}
  	   await message.load();

    var resoponse = await chat(
      message.content,
      message.user.name,
      message.user.ispremium,
      "chatgpt",
      message.user.id,
      0,
      image
    );
    await message.reply(resoponse.text);
  },
};

async function getTranscription(base64) {
  try {
    var file = Buffer.from(base64, "base64");
    const form = new FormData();
    form.append("audio", file, `${randomUUID()};audio/ogg`);
    form.append("language_behaviour", "automatic single language");

    const response = await axios.post(
      "https://api.gladia.io/audio/text/audio-transcription/",
      form,
      {
        params: {
          model: "large-v2",
        },
        headers: {
          ...form.getHeaders(),
          accept: "application/json",
          "x-gladia-key": process.env.GLADIA_API_KEY,
          "Content-Type": "multipart/form-data",
        },
      }
    );
    var res = response.data;
    var transcription = "";
    for (var i = 0; i < res.prediction.length; i++) {
      var tr = res.prediction[i];
      transcription += `${tr.transcription} `;
    }
    return transcription;
  } catch (err) {
    return { error: err };
  }
}
