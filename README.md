<h1 align="center"><b>Turing</b> <img src="https://cdn.discordapp.com/avatars/1053015370115588147/07cbfe46f7dd3235e09b7021863a2a0a.png?size=256" width="28" style="border-radius: 50%; margin-bottom: -5px"></h1>
<p align="center"><i>The ultimate AI-powered Discord bot</i></p>


## Requirements
### *Turing API*
The **[Turing API](https://github.com/TuringAI-Team/turing-ai-api)** plays an important role in the bot, as it's used for most of the features, like **image generation**, **image viewing**, **chatting** & **moderation filters**. You will be able to find various documentation about the API *[here](https://link.turing.sh/docs)*.


## Create a Discord bot application
You will need to create a Discord bot application [*here*](https://discord.com/developers/applications). The bot does not require any special intents.
Then, save the token and application ID for the next step.

## Configuration
Firstly, copy the configuration example in `src/config.example.json` to `src/config.json`, and follow all the steps inside the file.
You will have to fill out all required fields, or else the bot may not work as expected or at all.

## Building
**Firstly**, run `npm install` to obtain all the packages & depencies.
Then, run `npm run build` to build the bot.

Once built, you will be able to start the bot using `npm run start`.