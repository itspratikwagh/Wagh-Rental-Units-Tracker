#!/usr/bin/env node
/**
 * One-off CLI to look up a ReCollect place_id for an address.
 *
 * Usage:
 *   node scripts/findPlaceId.js "88 Sandstone Rd NW Calgary"
 *
 * Prints the matches so you can pick the right one and drop the `id` into
 * GARBAGE_REMINDER_ADDRESSES.
 */

const { searchPlace } = require('../services/reCollect');

async function main() {
  const query = process.argv.slice(2).join(' ').trim();
  if (!query) {
    console.error('usage: node scripts/findPlaceId.js "<address>"');
    process.exit(1);
  }

  console.log(`Searching ReCollect for: ${query}\n`);
  let results;
  try {
    results = await searchPlace(query);
  } catch (err) {
    console.error('Lookup failed:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(results) || results.length === 0) {
    console.log('No matches. Try a different form of the address, or use');
    console.log('the DevTools method described in backend/GARBAGE_REMINDER.md.');
    return;
  }

  for (const r of results) {
    console.log(`- ${r.name || '(no name)'}`);
    console.log(`  place_id: ${r.id}`);
    if (r.area_name) console.log(`  area:     ${r.area_name}`);
    if (Array.isArray(r.services) && r.services.length) {
      const ids = r.services.map(s => s.id).join(', ');
      console.log(`  services: ${ids}`);
    }
    console.log();
  }

  console.log('Copy the place_id of the matching row into GARBAGE_REMINDER_ADDRESSES.');
}

main();
