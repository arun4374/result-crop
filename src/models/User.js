const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  // Google Authentication ID
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  // Profile information
  profilePicture: {
    type: String,
    default: ''
  },
  // Credits/Points system
  credits: {
    type: Number,
    default: 100,
    min: 0
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  // Subscription details
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'premium'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'canceled', 'past_due'],
      default: 'inactive'
    },
    startDate: Date,
    endDate: Date,
    paymentMethodId: String
  },
  // Additional utility fields
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: Date,
  // Soft delete fields
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },

  // ─── FCM / Firebase Cloud Messaging ───────────────────────────────────────
  fcmToken: {
    type: [
      {
        token: {
          type: String,
          required: true
        },
        device: {
          type: String,          // e.g. 'android' | 'ios' | 'web'
          trim: true,
          default: 'unknown'
        },
        deviceId: {
          type: String,          // unique device fingerprint (optional)
          trim: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        },
        lastUsedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    default: []
  }
  // ──────────────────────────────────────────────────────────────────────────

}, {
  timestamps: true
});

// ── Indexes ────────────────────────────────────────────────────────────────
// Fast lookup when validating / removing a specific token
userSchema.index({ 'fcmTokens.token': 1 });

// ── Helper methods ─────────────────────────────────────────────────────────

/**
 * Add or refresh an FCM token for this user.
 * If the token already exists, only lastUsedAt is updated (no duplicates).
 */
userSchema.methods.addFcmToken = async function (token, device = 'unknown', deviceId = null) {
  const MAX_TOKENS = 10; // guard against unbounded growth

  const existing = this.fcmTokens.find(t => t.token === token);
  if (existing) {
    existing.lastUsedAt = new Date();
    existing.device = device;
  } else {
    // Drop oldest token if the cap is reached
    if (this.fcmTokens.length >= MAX_TOKENS) {
      this.fcmTokens.sort((a, b) => a.lastUsedAt - b.lastUsedAt);
      this.fcmTokens.shift();
    }
    this.fcmTokens.push({ token, device, deviceId });
  }

  return this.save();
};

/**
 * Remove a single FCM token (call this when FCM returns
 * messaging/registration-token-not-registered).
 */
userSchema.methods.removeFcmToken = async function (token) {
  this.fcmTokens = this.fcmTokens.filter(t => t.token !== token);
  return this.save();
};

/**
 * Return plain token strings — ready to pass to FCM's sendEachForMulticast.
 */
userSchema.methods.getFcmTokenStrings = function () {
  return this.fcmTokens.map(t => t.token);
};

module.exports = mongoose.model('User', userSchema);
