# pigeon 🐦

Send WhatsApp messages from your terminal.

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

> Fuzzy name matching, session persistence, interactive chat — all from your shell.

---

## Requirements

- Node.js 18+
- Google Chrome (uses your system install — no separate download)

## Install

```bash
git clone https://github.com/yourusername/pigeon
cd pigeon
npm install
npm link
```

## Setup

Link your WhatsApp account once by scanning a QR code:

```bash
pigeon setup
```

Open WhatsApp on your phone → Settings → Linked Devices → Link a Device, then scan. Your session is saved to `~/.pigeon/session/` — you won't need to scan again.

## Usage

```bash
pigeon status                        # check if linked
pigeon send "Gauri" "hey!"           # send a one-shot message
pigeon chat "Gauri"                  # interactive chat (incoming messages on)
pigeon chat "Gauri" --no-listen      # send-only mode
```

### Name matching

Names are matched fuzzily against your WhatsApp contacts — you don't need to type the full name. `"gau"` will match `"Gauri"`, `"Gauri Sharma"`, etc. Exact matches take priority over fuzzy ones.

### Chat mode

```
Chatting with Gauri — Ctrl+C to exit

You: hey what's up
Gauri: not much, you?
You: just testing something cool
```

Incoming messages appear inline as they arrive. Use `--no-listen` to disable if you only want to send.

## How it works

Pigeon uses [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) to run a headless Chrome instance that connects to WhatsApp Web. Your session is stored locally — nothing goes through any external server.

It shows up as **"pigeon"** in your WhatsApp Linked Devices list.

## Commands

| Command | Description |
|---|---|
| `pigeon status` | Check if your session is active |
| `pigeon setup` | Scan QR code to link your account |
| `pigeon send "Name" "msg"` | Send a message and exit |
| `pigeon chat "Name"` | Open interactive chat |
| `pigeon chat "Name" --no-listen` | Send-only chat mode |
