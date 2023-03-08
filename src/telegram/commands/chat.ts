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
