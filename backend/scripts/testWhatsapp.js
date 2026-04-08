#!/usr/bin/env node
/**
 * Standalone WhatsApp test — sends a fixed message to the group configured
 * via GARBAGE_REMINDER_WHATSAPP_GROUP_ID, bypassing the ReCollect fetch
 * entirely. Use this to validate that:
 *
 *   1. Your phone is linked (you've scanned the QR)
 *   2. The group chat id is correct
 *   3. whatsapp-web.js can actually post to that group
 *
 * without waiting for a real pickup day.
 *
 * Usage:
 *   node scripts/testWhatsapp.js
 *   node scripts/testWhatsapp.js "custom message body"
 *   node scripts/testWhatsapp.js --list     # list chats and exit
 */

const whatsapp = require('../services/whatsappClient');

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--list') {
    await whatsapp.listChats();
    process.exit(0);
  }

  const groupId = process.env.GARBAGE_REMINDER_WHATSAPP_GROUP_ID;
  if (!groupId) {
    console.error('GARBAGE_REMINDER_WHATSAPP_GROUP_ID is not set.');
    console.error('Run with --list first to find your group id, then set it.');
    process.exit(1);
  }

  const body = args.length > 0
    ? args.join(' ')
    : `Test message from garbage-reminder bot at ${new Date().toLocaleString('en-CA', { timeZone: 'America/Edmonton' })}`;

  console.log(`Sending to ${groupId}:\n${body}\n`);
  try {
    await whatsapp.sendMessage(groupId, body);
    console.log('Sent.');
    process.exit(0);
  } catch (err) {
    console.error('Send failed:', err.message);
    process.exit(1);
  }
}

main();
