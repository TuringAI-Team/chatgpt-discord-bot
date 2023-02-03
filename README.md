# chatgpt-bot

A discord bot for interact with ChatGPT
[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/U7U5H70V5)

## Setup Guide

1. Clone repository

```bash
    git clone https://github.com/MrlolDev/chatgpt-discord-bot.git
```

2. Create supabase project

3. Create supabase tables

Table: accounts
Fields (name, dataType): (id,uuid), (created_at, timestamp), (email, text), (password, text), (abled, boolean), (totalMessages, numeric), (lastUse, numeric), (key, text)
In this table it is only required the key(open ai key), abled(true), messages(0) and id property(random UUID).

Table: chatsonic
Fields (name, dataType): (id,uuid), (created_at, timestamp), (key, text)

Table: conversations
Fields (name, dataType): (id,uuid), (created_at, timestamp), (account, uuid, foreign key points to Account) , (conversation, jsonb), (lastMessage, numeric), (userId, text)

Table: cooldown
Fields (name, dataType): (id,uuid), (created_at, timestamp), (userId, text), (command, text)

Table: results
Fields (name, dataType): (id,uuid), (created_at, timestamp), (prompt, text), (provider, text), (result, jsonb), (uses, numeric), (guildId, text)

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

## TO DO:

- [ ] Embeds --> Future
- [ ] Top.gg rewards --> Future
- [ ] Uptime Robot alerts --> Future
