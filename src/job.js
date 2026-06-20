const { fetchLatestNotices } = require('./scraper');
const { sendNotificationToAllUsers } = require('./notifier');
const CoeNotification = require('./models/CoeNotification');

/**
 * Runs one full poll cycle:
 * 1. Scrape the latest notices from the AU page.
 * 2. Try to insert each one — MongoDB's unique index on `timestamp` will
 *    silently reject ones we've already seen (duplicate key error).
 * 3. Whatever inserts successfully is genuinely new.
 * 4. Send FCM for new entries, oldest-first, then mark them notified.
 *
 * @param {Object} options
 * @param {boolean} options.silent - if true, saves entries but never sends FCM
 *   (used for the initial backfill run).
 */
async function runNotificationCheck({ silent = false } = {}) {
  console.log(`[job] Starting check at ${new Date().toISOString()}`);

  const notices = await fetchLatestNotices();
  if (notices.length === 0) {
    console.warn('[job] Scraper returned 0 entries — page structure may have changed, or site is down. Skipping this run.');
    return;
  }

  const newlyInserted = [];

  // Insert oldest-first so that if FCM sending fails partway through,
  // the entries that did succeed are the oldest ones — keeps ordering sane on retry.
  const chronological = [...notices].reverse();

  for (const notice of chronological) {
    try {
      const doc = await CoeNotification.create({
        title: 'Anna University Update',
        message: notice.message,
        link: notice.link,
        timestamp: notice.timestamp,
        rawTimestamp: notice.rawTimestamp,
        notified: silent, // if silent (backfill), mark as already notified so we never send for it
      });
      newlyInserted.push(doc);
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate timestamp — we've already seen this one. Expected and fine.
        continue;
      }
      console.error('[job] Unexpected error inserting notice:', err.message);
    }
  }

  if (newlyInserted.length === 0) {
    console.log('[job] No new notices found.');
    return;
  }

  console.log(`[job] ${newlyInserted.length} new notice(s) saved.`);

  if (silent) {
    console.log('[job] Silent mode (backfill) — not sending FCM notifications.');
    return;
  }

  for (const doc of newlyInserted) {
    try {
      await sendNotificationToAllUsers({
        title: doc.title,
        body: doc.message,
        link: doc.link || undefined,
      });
      doc.notified = true;
      await doc.save();
    } catch (err) {
      console.error(`[job] Failed to send FCM for notice ${doc._id}:`, err.message);
      // Leave notified: false so a future manual rerun could retry if needed.
    }
  }

  console.log('[job] Check complete.');
}

module.exports = { runNotificationCheck };
