const mongoose = require('mongoose');

const impersonationTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  used: {
    type: Boolean,
    default: false,
    index: true
  },
  usedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
    expires: 0 // TTL index - MongoDB will auto-delete expired documents
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// TTL index to auto-delete expired tokens (5 minutes)
impersonationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ImpersonationToken', impersonationTokenSchema);

