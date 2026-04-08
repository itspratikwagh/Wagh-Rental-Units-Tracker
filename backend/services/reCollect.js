/**
 * ReCollect service — fetches waste collection schedules from Calgary's
 * ReCollect-powered calendar feed.
 *
 * Calgary uses ReCollect service ID 298. Each address maps to a UUID place_id
 * that you look up once from the Calgary "What Goes Where" page and put in
 * your environment config. The ICS feed is public and requires no auth.
 *
 * Endpoint:
 *   https://recollect.a.ssl.fastly.net/api/places/{PLACE_ID}/services/298/events.en-US.ics
 *
 * We use the ICS (iCalendar) feed rather than the JSON events endpoint because
 * it's stable, well-documented, and doesn't require a client_id. Collection
 * days are always all-day events with SUMMARY values like "Garbage, Recycling"
 * or "Organics" — we classify those into black/blue/green bins by keyword.
 */

const CALGARY_SERVICE_ID = '298';
const RECOLLECT_HOST = 'recollect.a.ssl.fastly.net';

/**
 * Fetch the raw ICS feed for a ReCollect place_id.
 * @param {string} placeId  UUID from the Calgary waste lookup page
 * @param {string} [serviceId=298]  ReCollect service id (Calgary = 298)
 * @returns {Promise<string>}  raw ICS text
 */
async function fetchIcsCalendar(placeId, serviceId = CALGARY_SERVICE_ID) {
  if (!placeId) throw new Error('reCollect: placeId is required');
  const url = `https://${RECOLLECT_HOST}/api/places/${placeId}/services/${serviceId}/events.en-US.ics`;
  const res = await fetch(url, {
    headers: {
      // Some CDN edges reject requests without a UA.
      'User-Agent': 'wagh-rental-tracker-garbage-reminder/1.0',
      'Accept': 'text/calendar, text/plain, */*',
    },
  });
  if (!res.ok) {
    throw new Error(`reCollect: ICS fetch failed ${res.status} ${res.statusText} for place ${placeId}`);
  }
  return await res.text();
}

/**
 * Unfold ICS lines — per RFC 5545, a leading space or tab on a line means
 * it's a continuation of the previous line.
 */
function unfoldIcs(ics) {
  return ics.replace(/\r?\n[ \t]/g, '');
}

/**
 * Parse an ICS feed into a list of { date, summary, bins } events.
 * Only all-day VEVENTs are returned (that's what ReCollect emits for pickups).
 *
 * @param {string} ics  raw ICS text
 * @returns {Array<{ date: string, summary: string, bins: string[] }>}
 *   `date` is the pickup day as YYYY-MM-DD (local calendar date, no tz).
 */
function parseIcsEvents(ics) {
  const unfolded = unfoldIcs(ics);
  const events = [];
  // Non-greedy match of each VEVENT block.
  const blockRe = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let m;
  while ((m = blockRe.exec(unfolded)) !== null) {
    const block = m[1];
    const summary = extractField(block, 'SUMMARY');
    const dtstart = extractField(block, 'DTSTART');
    if (!summary || !dtstart) continue;

    const date = parseIcsDate(dtstart);
    if (!date) continue;

    events.push({
      date,
      summary: unescapeIcsText(summary),
      bins: classifyBins(summary),
    });
  }
  return events;
}

function extractField(block, name) {
  // Field lines look like "SUMMARY:Garbage" or "DTSTART;VALUE=DATE:20260409".
  const re = new RegExp(`^${name}(?:;[^:\\r\\n]*)?:([^\\r\\n]*)`, 'm');
  const match = block.match(re);
  return match ? match[1].trim() : null;
}

function parseIcsDate(value) {
  // All-day: "20260409"
  // Date-time: "20260409T000000" or "20260409T000000Z"
  const m = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function unescapeIcsText(text) {
  return text
    .replace(/\\n/g, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Classify an ICS event summary into Calgary's three bin colors.
 * Calgary's cart colors:
 *   - black = garbage
 *   - blue  = recycling
 *   - green = organics (food + yard waste)
 *
 * Returns a de-duplicated array like ['black','blue'] in a stable order.
 */
function classifyBins(summary) {
  const s = summary.toLowerCase();
  const bins = [];
  if (/\bgarbage\b|\btrash\b|\brefuse\b|\bblack\s*cart\b/.test(s)) bins.push('black');
  if (/\brecycl|\bblue\s*cart\b/.test(s)) bins.push('blue');
  if (/\borganic|\bcompost|\byard|\bgreen\s*cart\b|\bfood\s*waste\b/.test(s)) bins.push('green');
  return bins;
}

/**
 * Return the list of bins scheduled for pickup on a specific calendar date.
 *
 * @param {string} placeId
 * @param {string} targetDate  YYYY-MM-DD in the local (Calgary) calendar
 * @param {string} [serviceId=298]  ReCollect service id
 * @returns {Promise<string[]>}  e.g. ['black','green'] — empty if no pickup
 */
async function getPickupsForDate(placeId, targetDate, serviceId = CALGARY_SERVICE_ID) {
  const ics = await fetchIcsCalendar(placeId, serviceId);
  const events = parseIcsEvents(ics);
  const matching = events.filter(e => e.date === targetDate);
  // Merge bins across multiple events on the same day, preserving order.
  const seen = new Set();
  const merged = [];
  for (const e of matching) {
    for (const b of e.bins) {
      if (!seen.has(b)) {
        seen.add(b);
        merged.push(b);
      }
    }
  }
  return merged;
}

/**
 * Search ReCollect for addresses matching a free-text query. Returns the raw
 * list of place matches, each with an `id` (UUID place_id you plug into
 * GARBAGE_REMINDER_ADDRESSES), a `name` (formatted address), and optionally
 * the services available at that place.
 *
 * This hits the public place-suggest endpoint that Calgary's own waste page
 * uses under the hood. Useful as a one-time lookup — you don't need this at
 * runtime, only when first configuring the bot.
 *
 * @param {string} query  e.g. "88 Sandstone Rd NW Calgary"
 * @returns {Promise<Array<{ id: string, name: string, [key: string]: any }>>}
 */
async function searchPlace(query) {
  if (!query) throw new Error('reCollect: query is required');
  const url =
    `https://api.recollect.net/api/places` +
    `?suggest=${encodeURIComponent(query)}` +
    `&locale=en-US&postal_code=&include_services=true&application=RecollectWidget`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'wagh-rental-tracker-garbage-reminder/1.0',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`reCollect: place search failed ${res.status} ${res.statusText}`);
  }
  return await res.json();
}

module.exports = {
  fetchIcsCalendar,
  parseIcsEvents,
  classifyBins,
  getPickupsForDate,
  searchPlace,
  CALGARY_SERVICE_ID,
};
