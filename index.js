#!/usr/bin/env node

const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const readline = require('readline');
const path = require('path');
const os = require('os');
const fs = require('fs');

const SESSION_PATH    = path.join(os.homedir(), '.pigeon', 'session');
const IG_SESSION_PATH = path.join(os.homedir(), '.pigeon', 'ig-session.json');

const C = {
  reset:  '\x1b[0m',
  lgray:  '\x1b[38;5;252m',
  gray:   '\x1b[38;5;245m',
  cyan:   '\x1b[96m',
  yellow: '\x1b[93m',
  orange: '\x1b[38;5;208m',
  green:  '\x1b[92m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
};

function logo() {
  const { reset: R, lgray: lg, gray: g, cyan: cy, yellow: y, orange: o } = C;
  return [
    `${lg}           .-''-.${R}`,
    `${lg}          / ,    \\${R}`,
    `${lg}       .-'\`${cy}(o)${R}${lg}    ;${R}`,
    `${lg}      '-==.       |${R}`,
    `${lg}           \`.\\_...${g}-;-.${R}`,
    `${lg}            )--"""${g}   \`-.${R}`,
    `${lg}           /   .${g}        \`-.${R}`,
    `${lg}          /   /${g}      \`.    \`-.${R}`,
    `${lg}          |   \\${g}    ;   \\      \`-.${R}`,
    `${lg}          |    \\${g}    \`.\`.; ${y}✉${R}`,
    `${lg}           \\    \`-.   \\\\\\${R}`,
    `${lg}            \`.     \`-.  \`\\${R}`,
    `${lg}              \`-.....\`\\-.))\\${R}`,
    `${o}                \`._ /   \`-\`${R}`,
    `${o}                  / /${R}`,
    `${o}                 /=(_${R}`,
    `${o}              -./--' \`${R}`,
  ].join('\n');
}

function help() {
  const { bold: b, cyan: cy, yellow: y, green: g, dim: d, reset: R } = C;
  console.log(`
${logo()}

  ${b}${cy}pigeon${R} — send messages from your terminal

  ${b}WhatsApp${R}
    ${y}pigeon status${R}                         check if linked
    ${y}pigeon setup${R}                          link your WhatsApp account
    ${y}pigeon send ${g}"Name" "Message"${R}         send a one-shot message
    ${y}pigeon chat ${g}"Name"${R}                   interactive chat (incoming on)
    ${y}pigeon chat ${g}"Name"${R} ${d}--no-listen${R}       send-only mode

  ${b}Instagram${R}
    ${y}pigeon ig status${R}                      check if logged in
    ${y}pigeon ig setup${R}                       log in to Instagram
    ${y}pigeon ig send ${g}"username" "Message"${R}  send a DM
    ${y}pigeon ig chat ${g}"username"${R}             interactive DM chat

  ${d}Run \`pigeon setup\` or \`pigeon ig setup\` first.${R}
`);
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function spinner(text) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const id = setInterval(() => {
    process.stdout.write(`\r${C.cyan}${frames[i++ % frames.length]}${C.reset} ${text}`);
  }, 80);
  return {
    stop: (finalLine) => {
      clearInterval(id);
      process.stdout.write('\r' + ' '.repeat(text.length + 4) + '\r');
      if (finalLine) console.log(finalLine);
    },
  };
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function hiddenPrompt(question) {
  return new Promise(resolve => {
    process.stdout.write(question);
    let input = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', function handler(ch) {
      if (ch === '\r' || ch === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handler);
        process.stdout.write('\n');
        resolve(input);
      } else if (ch === '') {
        process.exit();
      } else if (ch === '') {
        if (input.length > 0) input = input.slice(0, -1);
      } else {
        input += ch;
      }
    });
  });
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────

function fuzzyMatch(query, name) {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  if (n.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < n.length && qi < q.length; i++) {
    if (n[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

async function findContact(client, nameQuery) {
  const contacts = await client.getContacts();
  const matches = contacts.filter(c =>
    c.isMyContact && c.name && fuzzyMatch(nameQuery, c.name)
  );
  if (matches.length === 0) return null;
  return matches.find(c => c.name.toLowerCase() === nameQuery.toLowerCase()) || matches[0];
}

function createWaClient() {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
    deviceName: 'pigeon',
    puppeteer: {
      executablePath: '/usr/bin/google-chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
      ],
    },
  });
}

const CONNECT_TIMEOUT = 60000;

async function initWaClient(client, spin) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out connecting to WhatsApp (60s). Run `pigeon status` to check your session.'));
    }, CONNECT_TIMEOUT);

    client.on('qr', async qr => {
      if (spin) spin.stop();
      const str = await QRCode.toString(qr, { type: 'utf8', margin: 0 });
      console.log('\nScan with WhatsApp → Linked Devices → Link a Device:\n');
      console.log(str);
    });
    client.on('ready', () => { clearTimeout(timer); resolve(); });
    client.on('auth_failure', () => { clearTimeout(timer); reject(new Error('Authentication failed')); });
    client.initialize();
  });
}

async function cmdStatus() {
  const sessionExists = fs.existsSync(SESSION_PATH) &&
    fs.readdirSync(SESSION_PATH).length > 0;

  if (!sessionExists) {
    console.log(`${C.yellow}○${C.reset} Not linked — run ${C.bold}pigeon setup${C.reset} to connect`);
    return;
  }

  const spin = spinner('Checking WhatsApp session...');
  const client = createWaClient();

  const result = await new Promise(resolve => {
    const timer = setTimeout(() => resolve('timeout'), CONNECT_TIMEOUT);
    client.on('ready', () => { clearTimeout(timer); resolve('ready'); });
    client.on('qr', () => { clearTimeout(timer); resolve('expired'); });
    client.on('auth_failure', () => { clearTimeout(timer); resolve('expired'); });
    client.initialize();
  });

  if (result === 'ready') {
    const info = client.info;
    spin.stop(`${C.green}✓ Linked${C.reset} — ${C.bold}${info?.pushname || 'WhatsApp'}${C.reset} (${info?.wid?.user || ''})`);
  } else if (result === 'expired') {
    spin.stop(`${C.yellow}○${C.reset} Session expired — run ${C.bold}pigeon setup${C.reset} to re-link`);
  } else {
    spin.stop(`${C.yellow}○${C.reset} Timed out — check your connection`);
  }

  await client.destroy();
}

async function cmdSetup() {
  const client = createWaClient();
  const spin = spinner('Starting WhatsApp session...');
  await initWaClient(client, spin);
  spin.stop(`${C.green}✓ Linked!${C.reset} Session saved to ~/.pigeon/session`);
  await client.destroy();
}

async function cmdSend(nameQuery, message) {
  const client = createWaClient();
  const spin = spinner('Connecting to WhatsApp...');
  await initWaClient(client, spin);
  spin.stop();

  const contact = await findContact(client, nameQuery);
  if (!contact) {
    console.error(`No contact found matching "${nameQuery}"`);
    await client.destroy();
    process.exit(1);
  }

  const ans = await prompt(`Send to ${C.bold}${contact.name}${C.reset}? [y/N] `);
  if (ans.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    await client.destroy();
    process.exit(0);
  }

  await client.sendMessage(contact.id._serialized, message);
  console.log(`${C.green}✓${C.reset} Sent to ${C.bold}${contact.name}${C.reset}`);
  await client.destroy();
}

async function cmdChat(nameQuery, listen) {
  const client = createWaClient();
  const spin = spinner('Connecting to WhatsApp...');
  await initWaClient(client, spin);
  spin.stop();

  const contact = await findContact(client, nameQuery);
  if (!contact) {
    console.error(`No contact found matching "${nameQuery}"`);
    await client.destroy();
    process.exit(1);
  }

  const ans = await prompt(`Chat with ${C.bold}${contact.name}${C.reset}? [y/N] `);
  if (ans.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    await client.destroy();
    process.exit(0);
  }

  console.log(`\n${C.cyan}Chatting with ${C.bold}${contact.name}${C.reset}${C.cyan} — Ctrl+C to exit${C.reset}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt(`${C.green}You${C.reset}: `);
  rl.prompt();

  if (listen) {
    client.on('message', async msg => {
      const sender = await msg.getContact();
      if (sender.id._serialized === contact.id._serialized) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        console.log(`${C.cyan}${contact.name}${C.reset}: ${msg.body}`);
        rl.prompt(true);
      }
    });
  }

  rl.on('line', async line => {
    const text = line.trim();
    if (text) await client.sendMessage(contact.id._serialized, text);
    rl.prompt();
  });

  rl.on('close', async () => {
    await client.destroy();
    process.exit(0);
  });
}

// ─── Instagram ────────────────────────────────────────────────────────────────

async function getIgClient() {
  if (!fs.existsSync(IG_SESSION_PATH)) {
    throw new Error(`Not logged in to Instagram. Run ${C.bold}pigeon ig setup${C.reset} first.`);
  }
  const { IgApiClient } = require('instagram-private-api');
  const ig = new IgApiClient();
  const state = JSON.parse(fs.readFileSync(IG_SESSION_PATH, 'utf8'));
  await ig.state.deserialize(state);
  return ig;
}

async function igSaveSession(ig) {
  const state = await ig.state.serialize();
  delete state.constants;
  fs.mkdirSync(path.dirname(IG_SESSION_PATH), { recursive: true });
  fs.writeFileSync(IG_SESSION_PATH, JSON.stringify(state));
}

async function igFindUser(ig, query) {
  try {
    const userId = await ig.user.getIdByUsername(query.replace(/^@/, ''));
    const info = await ig.user.info(userId);
    return info;
  } catch {}
  const results = await ig.user.search(query);
  return results[0] || null;
}

async function cmdIgSetup() {
  const { IgApiClient } = require('instagram-private-api');
  const username = await prompt(`Instagram username: `);
  const password = await hiddenPrompt(`Password: `);

  const ig = new IgApiClient();
  ig.state.generateDevice(username);

  const spin = spinner('Logging in to Instagram...');
  try {
    await ig.simulate.preLoginFlow();
    await ig.account.login(username, password);
    process.nextTick(async () => await ig.simulate.postLoginFlow());
    await igSaveSession(ig);
    spin.stop(`${C.green}✓ Logged in as ${C.bold}@${username}${C.reset}`);
  } catch (err) {
    spin.stop();
    throw new Error(`Instagram login failed: ${err.message}`);
  }
}

async function cmdIgStatus() {
  if (!fs.existsSync(IG_SESSION_PATH)) {
    console.log(`${C.yellow}○${C.reset} Not logged in — run ${C.bold}pigeon ig setup${C.reset}`);
    return;
  }

  const spin = spinner('Checking Instagram session...');
  try {
    const ig = await getIgClient();
    const account = await ig.account.currentUser();
    spin.stop(`${C.green}✓ Logged in${C.reset} — ${C.bold}@${account.username}${C.reset} (${account.full_name})`);
  } catch {
    spin.stop(`${C.yellow}○${C.reset} Session expired — run ${C.bold}pigeon ig setup${C.reset}`);
  }
}

async function cmdIgSend(query, message) {
  const ig = await getIgClient();

  const spin = spinner('Finding user...');
  const user = await igFindUser(ig, query);
  spin.stop();

  if (!user) {
    console.error(`No Instagram user found matching "${query}"`);
    process.exit(1);
  }

  const ans = await prompt(`Send to ${C.bold}@${user.username}${C.reset}? [y/N] `);
  if (ans.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    process.exit(0);
  }

  const sendSpin = spinner('Sending...');
  const thread = ig.entity.directThread([user.pk.toString()]);
  await thread.broadcastText(message);
  sendSpin.stop(`${C.green}✓${C.reset} Sent to ${C.bold}@${user.username}${C.reset}`);
}

async function cmdIgChat(query) {
  const ig = await getIgClient();

  const spin = spinner('Finding user...');
  const user = await igFindUser(ig, query);
  spin.stop();

  if (!user) {
    console.error(`No Instagram user found matching "${query}"`);
    process.exit(1);
  }

  const ans = await prompt(`Chat with ${C.bold}@${user.username}${C.reset}? [y/N] `);
  if (ans.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    process.exit(0);
  }

  console.log(`\n${C.cyan}Chatting with ${C.bold}@${user.username}${C.reset}${C.cyan} — Ctrl+C to exit${C.reset}\n`);

  const thread = ig.entity.directThread([user.pk.toString()]);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt(`${C.green}You${C.reset}: `);
  rl.prompt();

  rl.on('line', async line => {
    const text = line.trim();
    if (text) {
      try {
        await thread.broadcastText(text);
      } catch (err) {
        console.error(`Failed to send: ${err.message}`);
      }
    }
    rl.prompt();
  });

  rl.on('close', () => process.exit(0));
}

// ─── Router ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'status') {
    await cmdStatus();
  } else if (cmd === 'setup') {
    await cmdSetup();
  } else if (cmd === 'send') {
    const [, nameQuery, message] = args;
    if (!nameQuery || !message) {
      console.error('Usage: pigeon send "Name" "Message"');
      process.exit(1);
    }
    await cmdSend(nameQuery, message);
  } else if (cmd === 'chat') {
    const nameQuery = args[1];
    if (!nameQuery) {
      console.error('Usage: pigeon chat "Name" [--no-listen]');
      process.exit(1);
    }
    const listen = !args.includes('--no-listen');
    await cmdChat(nameQuery, listen);
  } else if (cmd === 'ig') {
    const sub = args[1];
    if (sub === 'setup') {
      await cmdIgSetup();
    } else if (sub === 'status') {
      await cmdIgStatus();
    } else if (sub === 'send') {
      const [,, query, message] = args;
      if (!query || !message) {
        console.error('Usage: pigeon ig send "username" "Message"');
        process.exit(1);
      }
      await cmdIgSend(query, message);
    } else if (sub === 'chat') {
      const query = args[2];
      if (!query) {
        console.error('Usage: pigeon ig chat "username"');
        process.exit(1);
      }
      await cmdIgChat(query);
    } else {
      console.error('Usage: pigeon ig [setup|status|send|chat]');
      process.exit(1);
    }
  } else {
    help();
  }
}

main().catch(err => {
  console.error(`${C.yellow}✗${C.reset} ${err.message}`);
  process.exit(1);
});
