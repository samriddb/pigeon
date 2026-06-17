#!/usr/bin/env node

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const readline = require('readline');
const path = require('path');
const os = require('os');

const SESSION_PATH = path.join(os.homedir(), '.pigeon', 'session');

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
    `${lg}       ___${R}`,
    `${lg}    ,-'   \`-.${R}`,
    `${lg}   /  ${cy}◉${R}${lg}   ${cy}◉${R}${lg}  \\${R}`,
    `${lg}  (    ${g}~~~${R}${lg}    )${y}>  ✉${R}`,
    `${lg}   \\  ${g}'---'${R}${lg}  /${R}`,
    `${lg}    \`-------'${R}`,
    `${o}     /|   |\\${R}`,
    `${o}    / |   | \\${R}`,
    `${o}       | |${R}`,
    `${o}      /   \\${R}`,
    `${o}     ·     ·${R}`,
  ].join('\n');
}

function help() {
  const { bold: b, cyan: cy, yellow: y, green: g, dim: d, reset: R } = C;
  console.log(`
${logo()}

  ${b}${cy}pigeon${R} — send WhatsApp messages from your terminal

  ${b}Usage:${R}
    ${y}pigeon setup${R}                          link your WhatsApp account
    ${y}pigeon send ${g}"Name" "Message"${R}         send a one-shot message
    ${y}pigeon chat ${g}"Name"${R}                   interactive chat (incoming on)
    ${y}pigeon chat ${g}"Name"${R} ${d}--no-listen${R}       send-only mode

  ${d}Run \`pigeon setup\` first to scan the QR code.${R}
`);
}

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

function createClient() {
  return new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] },
  });
}

async function initClient(client) {
  return new Promise((resolve, reject) => {
    client.on('qr', qr => {
      console.log('\nScan this QR code with WhatsApp on your phone:');
      qrcode.generate(qr, { small: true });
    });
    client.on('ready', () => resolve());
    client.on('auth_failure', () => reject(new Error('Authentication failed')));
    client.initialize();
  });
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

async function cmdSetup() {
  const client = createClient();
  console.log(`${C.dim}Starting WhatsApp session...${C.reset}`);
  await initClient(client);
  console.log(`${C.green}✓ Linked! Session saved to ~/.pigeon/session${C.reset}`);
  console.log(`${C.dim}You won't need to scan again.${C.reset}`);
  await client.destroy();
}

async function cmdSend(nameQuery, message) {
  const client = createClient();
  process.stdout.write(`${C.dim}Connecting...${C.reset}`);
  await initClient(client);
  process.stdout.write(` ${C.green}✓${C.reset}\n`);

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
  const client = createClient();
  process.stdout.write(`${C.dim}Connecting...${C.reset}`);
  await initClient(client);
  process.stdout.write(` ${C.green}✓${C.reset}\n`);

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

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (cmd === 'setup') {
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
  } else {
    help();
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
