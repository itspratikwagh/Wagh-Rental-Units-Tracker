// Push notifications via ntfy.sh — zero-infrastructure alerting.
// Setup: pick a private topic name (e.g. "wagh-rentals-8f3k2"), set it as the
// NTFY_TOPIC env var, and subscribe to the same topic in the ntfy mobile app
// (or https://ntfy.sh/<topic> in a browser). If NTFY_TOPIC is unset, pushes
// are skipped silently — in-app status still works without it.

async function sendPush(title, message, options = {}) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return false;

  try {
    const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: {
        Title: title,
        Priority: options.priority || 'default', // min|low|default|high|urgent
        Tags: options.tags || 'house',
      },
      body: message,
    });
    if (!res.ok) {
      console.error(`[notify] ntfy responded ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    // Never let a notification failure break the caller
    console.error('[notify] Push failed:', err.message);
    return false;
  }
}

module.exports = { sendPush };
