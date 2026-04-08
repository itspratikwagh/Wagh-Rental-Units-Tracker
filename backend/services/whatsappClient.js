/**
 * WhatsApp client — thin singleton wrapper around whatsapp-web.js.
 *
 * whatsapp-web.js drives a headless WhatsApp Web session via Puppeteer. That
 * means: (1) first run needs a QR scan from your phone, (2) session state is
 * persisted under backend/.wwebjs_auth/ so subsequent runs are silent, and
 * (3) it technically violates WhatsApp's ToS. Fine for a personal reminder,
 * not something to ship to users.
 *
 * Design notes:
 *  - whatsapp-web.js is require()'d lazily so the rental tracker backend can
 *    start even if the package isn't installed or Chromium is unavailable.
 *  - The client is initialized at most once per process, on first send.
 *  - If GARBAGE_REMINDER_DRY_RUN=true, no real client is created and messages
 *    are logged to stdout instead. Useful for testing the reminder pipeline
 *    without scanning a QR code.
 */

const path = require('path');

let clientPromise = null; // cached initialization promise
let isReady = false;

/**
 * Lazily initialize the WhatsApp client. Returns a promise that resolves once
 * the client has emitted 'ready'. Subsequent calls return the same promise.
 */
function initializeClient() {
  if (clientPromise) return clientPromise;

  clientPromise = new Promise((resolve, reject) => {
    let Client, LocalAuth, qrcode;
    try {
      ({ Client, LocalAuth } = require('whatsapp-web.js'));
      qrcode = require('qrcode-terminal');
    } catch (err) {
      return reject(new Error(
        `whatsapp-web.js not installed: ${err.message}. ` +
        `Run 'npm install' in backend/ or set GARBAGE_REMINDER_DRY_RUN=true.`
      ));
    }

    const sessionDir = path.join(__dirname, '..', '.wwebjs_auth');
    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: sessionDir }),
      puppeteer: {
        headless: true,
        // Flags required to run Chromium inside containers (Railway, Docker).
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
        ],
      },
    });

    client.on('qr', (qr) => {
      console.log('[whatsapp] scan this QR with your phone (Linked Devices):');
      qrcode.generate(qr, { small: true });
    });

    client.on('authenticated', () => {
      console.log('[whatsapp] authenticated — session saved');
    });

    client.on('auth_failure', (msg) => {
      console.error('[whatsapp] auth failure:', msg);
      reject(new Error(`whatsapp auth failure: ${msg}`));
    });

    client.on('ready', () => {
      console.log('[whatsapp] client ready');
      isReady = true;
      resolve(client);
    });

    client.on('disconnected', (reason) => {
      console.warn('[whatsapp] disconnected:', reason);
      isReady = false;
      clientPromise = null; // allow re-init on next send
    });

    client.initialize().catch(reject);
  });

  return clientPromise;
}

/**
 * Send a text message to a WhatsApp chat (group or 1:1).
 *
 * Group chat IDs look like "1234567890-1234567890@g.us". To find yours, see
 * the Garbage Reminder docs — there's a helper snippet that lists all your
 * chats once you're authenticated.
 *
 * @param {string} chatId  WhatsApp chat id (group: *@g.us, user: *@c.us)
 * @param {string} message  plain-text message body
 */
async function sendMessage(chatId, message) {
  if (process.env.GARBAGE_REMINDER_DRY_RUN === 'true') {
    console.log(`[whatsapp:dry-run] -> ${chatId}\n${message}`);
    return { dryRun: true };
  }
  if (!chatId) throw new Error('whatsapp: chatId is required');

  const client = await initializeClient();
  return await client.sendMessage(chatId, message);
}

/**
 * List all chats the authenticated session can see. Useful for discovering
 * the group chat id on first setup. Logged, not returned.
 */
async function listChats() {
  if (process.env.GARBAGE_REMINDER_DRY_RUN === 'true') {
    console.log('[whatsapp:dry-run] listChats() is a no-op in dry-run mode');
    return [];
  }
  const client = await initializeClient();
  const chats = await client.getChats();
  const summary = chats.map(c => ({
    id: c.id._serialized,
    name: c.name,
    isGroup: c.isGroup,
  }));
  console.log('[whatsapp] chats:', JSON.stringify(summary, null, 2));
  return summary;
}

module.exports = {
  initializeClient,
  sendMessage,
  listChats,
  get isReady() { return isReady; },
};
