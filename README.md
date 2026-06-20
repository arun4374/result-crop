# coe-notifier

Polls the Anna University COE notice board (`exp_msg_home.php`) every 10 minutes,
detects new entries, saves them to MongoDB, and sends FCM push notifications to
all users with a stored token.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Then fill in `.env`:
   - `MONGO_URI` — same database as your Next.js backend (this project just
     adds one new collection, `coenotifications`, and reads `fcmToken` from
     your existing User collection).
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — paste your full Firebase service
     account JSON as a single line. Download from Firebase Console →
     Project Settings → Service Accounts → Generate new private key.
   - `USER_COLLECTION_NAME` — **important**: set this to the exact MongoDB
     collection name where your users live (check your Next.js
     `User`/`user` model — Mongoose pluralizes/lowercases by default, e.g.
     a model called `User` usually maps to a collection called `users`).

3. **Run the backfill once** (saves all currently-visible notices to the DB,
   marked as already-notified, so your app's notification list has content
   immediately without spamming every user on first launch):
   ```bash
   npm run backfill
   ```

4. **Start the poller**
   ```bash
   npm start
   ```
   Recommended: run this under PM2 alongside your Next.js app so it survives
   reboots and restarts on crash:
   ```bash
   pm2 start src/index.js --name coe-notifier
   pm2 save
   ```

## How it works

- `src/scraper.js` fetches the page and parses each `.info` block into
  `{ timestamp, message, link }`. Dates like `"05 Jun 2026 06:09 PM"` are
  parsed with dayjs's strict custom-format parser. Any embedded `<a>` link
  (e.g. "Click Here" → PDF) is extracted into a separate `link` field and
  stripped out of the message text.
- `src/job.js` tries to insert each scraped entry into MongoDB. The
  `timestamp` field has a `unique` index, so re-inserting something already
  seen fails with a duplicate-key error (code `11000`), which is caught and
  ignored. Whatever inserts successfully is genuinely new.
- New entries trigger `src/notifier.js`, which reads all `fcmToken` values
  from your User collection and sends via `sendEachForMulticast` in batches
  of 500.
- Old notices auto-delete 180 days after being scraped (MongoDB TTL index
  on `createdAt`), keeping the collection from growing forever.

## Exposing notifications to your app

This project doesn't include an API route — it just writes to MongoDB. In
your existing Next.js backend, add an endpoint like:

```js
// GET /api/notifications?limit=15
const notifications = await CoeNotification.find({})
  .sort({ timestamp: -1 })
  .limit(parseInt(req.query.limit) || 15);
```

(Reuse the same `CoeNotification` schema from `src/models/CoeNotification.js`
in your Next.js project, or just point a Mongoose model at the
`coenotifications` collection.)

## Notes / things to revisit later

- **Invalid token cleanup**: if FCM reports a token as
  invalid/unregistered, this project logs it but does NOT delete it from
  your User collection (it intentionally avoids writing to your main app's
  data). Consider periodically clearing dead tokens from your Next.js side.
- **Politeness**: a 10-minute interval with a normal browser User-Agent
  header is reasonable. Avoid lowering the interval much further.
- **If the page structure changes**: `scraper.js` looks for `.info` divs
  with two child `<div>`s (timestamp + message). If Anna University
  redesigns the page, this will start returning 0 entries — the job logs a
  warning in that case rather than crashing, but the scraper logic will
  need updating.
