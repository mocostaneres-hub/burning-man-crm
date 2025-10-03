const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['super-admin', 'moderator', 'support'],
    required: true
  },
  permissions: {
    userManagement: { type: Boolean, default: false },
    campManagement: { type: Boolean, default: false },
    systemSettings: { type: Boolean, default: false },
    analytics: { type: Boolean, default: false },
    support: { type: Boolean, default: false }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastLogin: Date,
  notes: String
}, {
  timestamps: true
});

// Index
adminSchema.index({ user: 1 });
adminSchema.index({ role: 1 });

module.exports = mongoose.model('Admin', adminSchema);
