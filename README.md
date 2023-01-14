# chatgpt-bot

A discord bot for interact with ChatGPT

## Setup Guide

1. Clone repository

```bash
    git clone https://github.com/MrlolDev/chatgpt-discord-bot.git
```

2. Create supabase project

3. Create supabase tables

4. Upload open ai accounts

5. Install dependencies

```
npm install
```

6. Create .env

```env
TOKEN=Your discord bot token https://discord.dev
CLIENT_ID=Your discord bot id https://discord.dev
SUPABASE_KEY=Your supabase service role key https://app.supabase.com
SUPABASE_URL=Your supabase project url https://app.supabase.com
NOPECHA_KEY=Your nopecha key https://nopecha.com
```

7. Run the bot

```
npm start
```

8. Running with auto reload(development mode)

```
npm run dev
```

9. Updating code with changes.

```
npm run git
```

## Get session key

1. Go to https://chat.openai.com/chat
2. Log in to your account
3. Open developer tools
4. Go to the application section
5. Go to the cookies section
6. And get your session token which is the cookie with the name: "\_\_Secure-next-auth.session-token"

## TO DO:

- [x] Chat command with ChatGPT response. --> 0.0.2
- [x] Conversations support(the bot have context from the previous messages). --> 0.0.3
- [x] Bot command(get information about the bot and the ping bot). --> 0.0.3
- [x] Feedback command(allow people to send feedback). --> 0.0.4
- [x] Auto refresh session token --> 0.0.5
- [x] Includes user message in chat command. --> 0.0.6
- [x] Solve ChatGPT issues --> 0.0.6
- [x] Limits to 1 conversation per channel. --> 0.0.6
- [x] Host on vps server --> 0.0.7
- [ ] Allow private conversations --> 0.0.9
- [ ] Embeds --> 0.0.9
- [ ] Top.gg rewards --> Future
- [ ] Partials responses during loading --> Future
- [ ] Uptime Robot alerts --> Future
