const admin = require('firebase-admin');
const User = require('./models/User');

let initialized = false;

function initFirebase() {
  if (initialized) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set in .env');
  }

  const serviceAccount = JSON.parse(raw);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  initialized = true;
  console.log('[fcm] Firebase Admin initialized');
}

/**
 * Fetches all known FCM tokens from the User collection.
 * Filters out users with no token, and dedupes in case of accidental repeats.
 */
async function getAllTokens() {
  const users = await User.find({ fcmToken: { $exists: true, $ne: null, $ne: '' } })
    .select('fcmToken')
    .lean();

  const tokens = [...new Set(users.map((u) => u.fcmToken).filter(Boolean))];
  return tokens;
}

/**
 * Sends a single notification (title + body + optional link in data payload)
 * to all known tokens, batched in groups of 500 (FCM's multicast limit).
 * Returns a summary of successes/failures.
 */
async function sendNotificationToAllUsers({ title, body, link }) {
  initFirebase();

  const tokens = await getAllTokens();
  if (tokens.length === 0) {
    console.warn('[fcm] No FCM tokens found — skipping send');
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const BATCH_SIZE = 500;
  let successCount = 0;
  let failureCount = 0;
  const invalidTokens = [];

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);

    const message = {
      notification: { title, body },
      data: link ? { link } : {},
      tokens: batch,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const code = res.error?.code;
        // These two codes mean the token is dead and should be cleaned up later
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(batch[idx]);
        }
      }
    });
  }

  if (invalidTokens.length > 0) {
    console.warn(`[fcm] ${invalidTokens.length} invalid/expired tokens detected (not auto-removed — see note in notifier.js)`);
    // NOTE: Not automatically deleting these here, since this project intentionally
    // doesn't own writes to your User collection beyond reading tokens.
    // Consider clearing invalid tokens from your main Next.js backend instead,
    // e.g. via a small cleanup endpoint that accepts a list of dead tokens.
  }

  console.log(`[fcm] Sent: ${successCount} succeeded, ${failureCount} failed (out of ${tokens.length} tokens)`);
  return { successCount, failureCount, invalidTokens };
}

module.exports = { sendNotificationToAllUsers };
