const mongoose = require('mongoose');

/**
 * This is a MINIMAL schema, intentionally not the full User schema from your
 * Next.js backend. Mongoose only needs to know about the fields we actually
 * read here. `strict: false` means it won't strip out the other fields,
 * and `collection` is pinned explicitly so it points at your real collection
 * regardless of what this model gets named.
 */
const userSchema = new mongoose.Schema(
  {
    fcmToken: { type: String },
  },
  {
    strict: false,
    collection: process.env.USER_COLLECTION_NAME || 'users',
  }
);

// Guard against OverwriteModelError if this file is ever imported twice
module.exports = mongoose.models.NotifierUser || mongoose.model('NotifierUser', userSchema);
