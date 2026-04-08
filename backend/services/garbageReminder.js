/**
 * Garbage reminder orchestrator.
 *
 * Ties together the ReCollect feed and the WhatsApp client: for each
 * configured address, look up tomorrow's pickup, and if any carts are due,
 * post a reminder to a WhatsApp group the evening before.
 *
 * Configuration (all via env vars):
 *
 *   GARBAGE_REMINDER_ENABLED            "true" to enable (default: false)
 *   GARBAGE_REMINDER_ADDRESSES          JSON array of { name, placeId }
 *                                       e.g. '[{"name":"123 Main St","placeId":"45D85260-..."}]'
 *   GARBAGE_REMINDER_WHATSAPP_GROUP_ID  chat id, e.g. "1234-5678@g.us"
 *   GARBAGE_REMINDER_SERVICE_ID         ReCollect service id (default: 298 = Calgary)
 *   GARBAGE_REMINDER_TIMEZONE           IANA tz (default: America/Edmonton)
 *   GARBAGE_REMINDER_DRY_RUN            "true" to log instead of sending
 */

const { getPickupsForDate, CALGARY_SERVICE_ID } = require('./reCollect');
const whatsapp = require('./whatsappClient');

const BIN_LABELS = {
  black: 'Black cart (garbage)',
  blue:  'Blue cart (recycling)',
  green: 'Green cart (organics)',
};

function isEnabled() {
  return process.env.GARBAGE_REMINDER_ENABLED === 'true';
}

function getTimezone() {
  return process.env.GARBAGE_REMINDER_TIMEZONE || 'America/Edmonton';
}

function getServiceId() {
  return process.env.GARBAGE_REMINDER_SERVICE_ID || CALGARY_SERVICE_ID;
}

/**
 * Parse the GARBAGE_REMINDER_ADDRESSES env var into an array of addresses.
 * Throws with a helpful message if the JSON is malformed.
 */
function getAddresses() {
  const raw = process.env.GARBAGE_REMINDER_ADDRESSES;
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`GARBAGE_REMINDER_ADDRESSES is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('GARBAGE_REMINDER_ADDRESSES must be a JSON array of { name, placeId }');
  }
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object' || !entry.name || !entry.placeId) {
      throw new Error('Each GARBAGE_REMINDER_ADDRESSES entry needs both "name" and "placeId"');
    }
  }
  return parsed;
}

/**
 * Return the local calendar date (YYYY-MM-DD) for "now + offsetDays" in the
 * given IANA timezone. We use Intl.DateTimeFormat rather than pulling in a tz
 * library because the rental tracker already runs modern Node.
 */
function localDateString(offsetDays = 0, timezone = getTimezone()) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  // en-CA gives us YYYY-MM-DD format directly.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now);
}

/**
 * Format a human-readable date for the reminder body, e.g.
 * "Thursday, April 9". Uses the configured timezone.
 */
function formatReadableDate(isoDate, timezone = getTimezone()) {
  // Interpret YYYY-MM-DD as midnight UTC so the weekday lookup lands on the
  // intended day regardless of host tz.
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

/**
 * Build the message body for a single address with its bin list.
 * Returns null if there are no bins (caller shouldn't send in that case).
 */
function formatMessage(addressName, bins, targetDate) {
  if (!bins || bins.length === 0) return null;
  const readable = formatReadableDate(targetDate);
  const lines = bins.map(b => `  • ${BIN_LABELS[b] || b}`);
  return (
    `Garbage reminder for ${addressName}\n` +
    `Put out tomorrow (${readable}):\n` +
    lines.join('\n')
  );
}

/**
 * Check every configured address for tomorrow's pickup and send a combined
 * reminder to the WhatsApp group. Called by the nightly cron job, but also
 * callable directly for testing.
 *
 * @returns {Promise<{ checked: number, sent: number, skipped: number, errors: Array }>}
 */
async function runReminderCheck() {
  const result = { checked: 0, sent: 0, skipped: 0, errors: [] };

  if (!isEnabled()) {
    result.skipped = 1;
    console.log('[garbage] reminder disabled (set GARBAGE_REMINDER_ENABLED=true)');
    return result;
  }

  let addresses;
  try {
    addresses = getAddresses();
  } catch (err) {
    result.errors.push(err.message);
    console.error('[garbage]', err.message);
    return result;
  }

  if (addresses.length === 0) {
    result.errors.push('GARBAGE_REMINDER_ADDRESSES is empty — nothing to check');
    console.warn('[garbage] no addresses configured');
    return result;
  }

  const groupId = process.env.GARBAGE_REMINDER_WHATSAPP_GROUP_ID;
  if (!groupId) {
    result.errors.push('GARBAGE_REMINDER_WHATSAPP_GROUP_ID is not set');
    console.error('[garbage] no WhatsApp group id configured');
    return result;
  }

  const tomorrow = localDateString(1);
  const serviceId = getServiceId();
  const sections = [];

  for (const addr of addresses) {
    result.checked += 1;
    try {
      const bins = await getPickupsForDate(addr.placeId, tomorrow, serviceId);
      const section = formatMessage(addr.name, bins, tomorrow);
      if (section) {
        sections.push(section);
      } else {
        console.log(`[garbage] no pickup tomorrow for ${addr.name}`);
      }
    } catch (err) {
      const msg = `Failed to fetch schedule for ${addr.name}: ${err.message}`;
      result.errors.push(msg);
      console.error('[garbage]', msg);
    }
  }

  if (sections.length === 0) {
    result.skipped = 1;
    console.log('[garbage] no bins due tomorrow across any address');
    return result;
  }

  const body = sections.join('\n\n');
  try {
    await whatsapp.sendMessage(groupId, body);
    result.sent = 1;
    console.log(`[garbage] reminder sent for ${sections.length} address(es)`);
  } catch (err) {
    const msg = `WhatsApp send failed: ${err.message}`;
    result.errors.push(msg);
    console.error('[garbage]', msg);
  }

  return result;
}

module.exports = {
  runReminderCheck,
  // Exported for unit testing / manual invocation.
  formatMessage,
  formatReadableDate,
  localDateString,
  isEnabled,
  getAddresses,
  getTimezone,
};
