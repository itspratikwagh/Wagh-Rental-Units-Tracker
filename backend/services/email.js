const { getGmailClient } = require('./gmail');

// Send a plain-text email from the landlord's own Gmail account using the
// stored OAuth token (requires the gmail.send scope — reconnect Gmail after
// deploying a scope change).
//
// Safety envs for testing:
//   EMAIL_DRY_RUN=true         log instead of sending
//   EMAIL_TEST_OVERRIDE=<addr> send everything to <addr> with a [TEST →] subject prefix
async function sendEmail(prisma, { to, subject, text }) {
  if (!to) throw new Error('sendEmail: missing "to" address');

  if (process.env.EMAIL_DRY_RUN === 'true') {
    console.log(`[email] DRY RUN — would send to ${to}: "${subject}"`);
    return { sent: false, dryRun: true, to };
  }

  let finalTo = to;
  let finalSubject = subject;
  if (process.env.EMAIL_TEST_OVERRIDE) {
    finalTo = process.env.EMAIL_TEST_OVERRIDE;
    finalSubject = `[TEST → ${to}] ${subject}`;
  }

  const syncState = await prisma.gmailSyncState.findFirst();
  if (!syncState?.refreshToken) {
    throw new Error('Gmail not connected — cannot send email');
  }

  const gmail = await getGmailClient(syncState.refreshToken);

  // From header omitted — Gmail stamps the authenticated account automatically
  const raw = Buffer.from(
    [
      `To: ${finalTo}`,
      `Subject: ${finalSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      text,
    ].join('\r\n')
  ).toString('base64url');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return { sent: true, to: finalTo };
}

module.exports = { sendEmail };
