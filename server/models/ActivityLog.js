const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  entityType: {
    type: String,
    enum: ['MEMBER', 'CAMP'],
    required: true,
    index: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },
  actingUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  activityType: {
    type: String,
    required: true,
    index: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
activityLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
activityLogSchema.index({ actingUserId: 1, timestamp: -1 });

// Virtual for formatted timestamp
activityLogSchema.virtual('formattedTimestamp').get(function() {
  return this.timestamp.toISOString();
});

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

module.exports = ActivityLog;

