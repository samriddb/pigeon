# pigeon 🐦

Send WhatsApp and Instagram DMs from your terminal.

```
           .-''-.
          / ,    \
       .-'`(o)    ;
      '-==.       |
           `.\_...-;-.
            )--"""   `-.
           /              `-.
          /           `.    `-.
          |        ;   \      `-.
          |         `.`.; ✉
           \    `-.   \\\
            `.     `-.  `\
              `-.....`\-.))\ 
                `._ /   `-`  
                  / /
                 /=(_
              -./--' `
```

> Fuzzy name matching, session persistence, interactive chat — WhatsApp and Instagram from your shell.

---

## Requirements

- Node.js 18+
- Google Chrome (uses your system install)

## Install

```bash
git clone https://github.com/yourusername/pigeon
cd pigeon
npm install
npm link
```

---

## WhatsApp

### Setup

Link your WhatsApp account once by scanning a QR code:

```bash
pigeon setup
```

Open WhatsApp on your phone → Settings → Linked Devices → Link a Device, then scan. Your session is saved to `~/.pigeon/session/` and shows up as **"pigeon"** in your linked devices list.

### Usage

```bash
pigeon status                             # check if linked
pigeon send "John Smith" "hey!"           # send a one-shot message
pigeon chat "John Smith"                  # interactive chat (incoming messages on)
pigeon chat "John Smith" --no-listen      # send-only mode
```

### Chat mode

```
Chatting with John Smith — Ctrl+C to exit

You: knock knock whos there
John Smith: moo
You: moo who
John Smith: why are you crying
```

---

## Instagram

### Setup

Log in with your Instagram credentials:

```bash
pigeon ig setup
```

Session is saved to `~/.pigeon/ig-session.json`.

### Usage

```bash
pigeon ig status                          # check if logged in
pigeon ig send "johnsmith" "hey!"         # send a DM
pigeon ig chat "johnsmith"               # interactive DM chat
```

---

## Name matching

WhatsApp names are matched fuzzily against your contacts — `"john"` matches `"John Smith"`, `"Johnny"`, etc. Instagram matches by exact username, with a search fallback.

---

## How it works

- **WhatsApp** — uses [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) to run a headless Chrome session connected to WhatsApp Web. Nothing goes through any external server.
- **Instagram** — uses [instagram-private-api](https://github.com/dilame/instagram-private-api), the same private API the Instagram mobile app uses.

Sessions are stored locally in `~/.pigeon/`.

---

## Commands

| Command | Description |
|---|---|
| `pigeon status` | Check WhatsApp session |
| `pigeon setup` | Link WhatsApp account (QR scan) |
| `pigeon send "Name" "msg"` | Send a WhatsApp message |
| `pigeon chat "Name"` | Interactive WhatsApp chat |
| `pigeon chat "Name" --no-listen` | Send-only WhatsApp chat |
| `pigeon ig status` | Check Instagram session |
| `pigeon ig setup` | Log in to Instagram |
| `pigeon ig send "user" "msg"` | Send an Instagram DM |
| `pigeon ig chat "user"` | Interactive Instagram DM chat |
