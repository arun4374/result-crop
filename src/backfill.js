require('dotenv').config();
const { connectDB, disconnectDB } = require('./db');
const { runNotificationCheck } = require('./job');

/**
 * Run this ONCE before starting the cron job for the first time:
 *   npm run backfill
 *
 * It scrapes the current notice board, saves every visible entry to the DB,
 * and marks them all as already-notified — so no FCM gets sent for old news,
 * but your app's notification list has content right away.
 */
(async () => {
  try {
    await connectDB();
    await runNotificationCheck({ silent: true });
  } catch (err) {
    console.error('[backfill] Failed:', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
})();
