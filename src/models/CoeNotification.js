const mongoose = require('mongoose');

const coeNotificationSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Anna University Update',
  },
  message: {
    type: String,
    required: true,
  },
  link: {
    type: String,
    default: null, // populated if the notice contained a "Click Here" style link
  },
  timestamp: {
    type: Date,
    required: true,
    unique: true, // acts as our natural dedup key against the source page
  },
  rawTimestamp: {
    type: String, // original "05 Jun 2026 06:09 PM" string, kept for debugging/audits
  },
  notified: {
    type: Boolean,
    default: false, // true once FCM has been sent for this entry
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 180, // TTL index: auto-delete 180 days after creation
  },
});

// Helpful for the "fetch latest 10-15" query your app's notification page will use
coeNotificationSchema.index({ timestamp: -1 });

module.exports = mongoose.model('CoeNotification', coeNotificationSchema);
