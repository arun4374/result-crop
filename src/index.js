require('dotenv').config();
const cron = require('node-cron');
const { connectDB } = require('./db');
const { runNotificationCheck } = require('./job');

const SCHEDULE = process.env.CRON_SCHEDULE || '*/10 * * * *';

(async () => {
  await connectDB();

  console.log(`[index] coe-notifier started. Polling on schedule: "${SCHEDULE}"`);

  // Run once immediately on startup, then on the cron schedule.
  runNotificationCheck().catch((err) => console.error('[index] Initial run failed:', err));

  cron.schedule(SCHEDULE, () => {
    runNotificationCheck().catch((err) => console.error('[index] Scheduled run failed:', err));
  });
})();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[index] Shutting down...');
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('[index] Shutting down...');
  process.exit(0);
});
