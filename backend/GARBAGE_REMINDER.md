# Garbage Reminder Bot

Nightly WhatsApp reminder that tells a group chat which Calgary carts (black /
blue / green) to put out the next morning, driven by the city's ReCollect feed.

## How it works

1. A cron job runs every evening at 7 PM Calgary time (configurable).
2. For each configured address, it downloads the ICS calendar from ReCollect
   and looks for events dated *tomorrow*.
3. It classifies each event's SUMMARY ("Garbage, Recycling", "Organics", etc.)
   into Calgary's three cart colors.
4. If any carts are due, it posts a single combined reminder to a WhatsApp
   group chat via `whatsapp-web.js`.
5. If no carts are due, it logs and does nothing (no noise on off-nights).

Files involved:
- `backend/services/reCollect.js` — ICS fetch + parse + bin classifier
- `backend/services/whatsappClient.js` — singleton wrapper around whatsapp-web.js
- `backend/services/garbageReminder.js` — orchestration and message formatting
- `backend/server.js` — cron schedule + `POST /api/garbage-reminder/run` trigger

## One-time setup

### 1. Install the new dependencies

```bash
cd backend
npm install
```

This pulls in `whatsapp-web.js` and `qrcode-terminal`. On first install,
`whatsapp-web.js` downloads a Chromium build (~300 MB) via Puppeteer. On a
bare Railway container you may need to install system libraries — see the
"Railway deployment" section below.

### 2. Find your ReCollect place ID for each property

Calgary uses ReCollect under the hood for its waste schedule lookups. Each
address maps to a UUID "place ID" that never changes, so you only need to
find it once.

1. Go to <https://www.calgary.ca/waste/residential/garbage-schedule.html>
2. Type in the property address and load the schedule.
3. Open DevTools → Network tab, filter for "recollect", and reload.
4. Look for a request to
   `api.recollect.net/api/places/{UUID}/services/298/...` — the UUID after
   `/places/` is your place ID.

Alternatively, on the same schedule page click **Export → Google Calendar**.
The resulting webcal URL contains the same UUID.

Calgary's ReCollect service ID is always `298` — the bot uses that by default.

### 3. Configure environment variables

Add these to your backend `.env` (locally) or Railway service settings:

```bash
# Master switch — bot is inert unless this is "true"
GARBAGE_REMINDER_ENABLED=true

# JSON array of addresses to check. Name is just a label for the message body.
GARBAGE_REMINDER_ADDRESSES='[
  {"name":"123 Elm St SW","placeId":"45D85260-5FF5-11E7-8449-A9C1EC56DAF5"},
  {"name":"456 Oak Ave NE","placeId":"A1B2C3D4-1111-2222-3333-444455556666"}
]'

# WhatsApp group chat id — see step 4 below to discover this
GARBAGE_REMINDER_WHATSAPP_GROUP_ID=1234567890-1234567890@g.us

# Optional overrides (shown with defaults)
# GARBAGE_REMINDER_TIMEZONE=America/Edmonton
# GARBAGE_REMINDER_SERVICE_ID=298
# GARBAGE_REMINDER_CRON=0 19 * * *
# GARBAGE_REMINDER_DRY_RUN=false
```

`GARBAGE_REMINDER_DRY_RUN=true` skips the real WhatsApp client and just logs
what it *would* have sent — good for the first end-to-end test while you're
still wiring things up.

### 4. First WhatsApp login (QR scan)

`whatsapp-web.js` drives a headless WhatsApp Web session, so the first time
the client boots you need to scan a QR code with your phone exactly like you
would on web.whatsapp.com. The session is then cached in
`backend/.wwebjs_auth/` (gitignored) and reused forever after.

Easiest path:

1. Start the backend locally: `cd backend && npm run dev`
2. Trigger the reminder manually so the WhatsApp client initializes:
   ```bash
   curl -X POST http://localhost:3005/api/garbage-reminder/run
   ```
3. Watch the backend logs — a QR code will print in your terminal.
4. On your phone: WhatsApp → Settings → Linked Devices → Link a Device →
   scan the QR.
5. The logs will show `[whatsapp] authenticated` then `[whatsapp] client ready`.

### 5. Find the WhatsApp group chat ID

Group chat IDs look like `1234567890-1234567890@g.us` and aren't visible in
the app — you need to ask the logged-in client. Once authenticated (step 4),
run this one-liner in a Node REPL from the `backend/` directory:

```bash
node -e "require('./services/whatsappClient').listChats().then(()=>process.exit(0))"
```

It prints every chat the account can see. Find the one with `isGroup: true`
and the right `name`, copy its `id`, and drop it into
`GARBAGE_REMINDER_WHATSAPP_GROUP_ID`.

### 6. Verify end-to-end

With `GARBAGE_REMINDER_DRY_RUN=true` first:

```bash
curl -X POST http://localhost:3005/api/garbage-reminder/run
```

Expected log output if tomorrow is a pickup day:

```
[whatsapp:dry-run] -> 1234567890-1234567890@g.us
Garbage reminder for 123 Elm St SW
Put out tomorrow (Thursday, April 9):
  • Black cart (garbage)
  • Blue cart (recycling)
```

When that looks right, flip `GARBAGE_REMINDER_DRY_RUN=false` and run the same
curl again — this time the real message should appear in the group.

## Railway deployment notes

`whatsapp-web.js` relies on Puppeteer/Chromium, which has two implications on
Railway:

1. **Chromium system libraries.** Nixpacks needs to know to install them.
   Add a `nixpacks.toml` at the repo root (or to `backend/`) if the build
   fails with missing `.so` errors:

   ```toml
   [phases.setup]
   aptPkgs = [
     "chromium", "fonts-liberation", "libasound2", "libatk-bridge2.0-0",
     "libatk1.0-0", "libc6", "libcairo2", "libcups2", "libdbus-1-3",
     "libexpat1", "libfontconfig1", "libgbm1", "libgcc1", "libglib2.0-0",
     "libgtk-3-0", "libnspr4", "libnss3", "libpango-1.0-0", "libx11-6",
     "libx11-xcb1", "libxcb1", "libxcomposite1", "libxcursor1", "libxdamage1",
     "libxext6", "libxfixes3", "libxi6", "libxrandr2", "libxrender1",
     "libxss1", "libxtst6", "lsb-release", "wget", "xdg-utils"
   ]

   [variables]
   PUPPETEER_EXECUTABLE_PATH = "/usr/bin/chromium"
   ```

   Also set `PUPPETEER_SKIP_DOWNLOAD=true` so npm doesn't pull its own
   Chromium at build time.

2. **Session persistence.** Railway containers are ephemeral — on every
   redeploy you'd lose `backend/.wwebjs_auth/` and have to re-scan the QR.
   Attach a Railway volume mounted at `backend/.wwebjs_auth` to keep the
   session across deploys.

If all of this feels like a lot of yak-shaving for a garbage reminder, a
fully valid alternative is running the bot locally on a Raspberry Pi or
spare machine — the ReCollect feed + whatsapp-web.js don't need to live on
the same box as the rental tracker.

## Message format

Example combined message for two addresses:

```
Garbage reminder for 123 Elm St SW
Put out tomorrow (Thursday, April 9):
  • Black cart (garbage)
  • Blue cart (recycling)

Garbage reminder for 456 Oak Ave NE
Put out tomorrow (Thursday, April 9):
  • Green cart (organics)
```

Addresses with no pickup tomorrow are silently omitted. If no address has a
pickup, nothing is sent at all.

## Manual trigger endpoint

```
POST /api/garbage-reminder/run
```

Runs the same check the cron would. Returns JSON like:

```json
{ "checked": 2, "sent": 1, "skipped": 0, "errors": [] }
```

Useful for debugging, re-sending after a missed night, or running from a
separate scheduler if you'd rather not rely on the in-process cron.

## Caveats

- **ToS.** `whatsapp-web.js` is unofficial and technically violates
  WhatsApp's ToS. Fine for a personal reminder, not something to put in a
  product.
- **Calendar drift.** Calgary occasionally shifts pickups (holidays, snow
  days). ReCollect's feed reflects those shifts, so the bot should too —
  but verify during long weekends.
- **Bin classification is keyword-based.** If ReCollect ever changes their
  SUMMARY wording, update `classifyBins()` in `backend/services/reCollect.js`.
