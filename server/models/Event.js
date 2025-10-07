const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  maxSignUps: {
    type: Number,
    required: true,
    min: 1
  },
  memberIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member'
  }],
  status: {
    type: String,
    enum: ['active', 'cancelled', 'completed'],
    default: 'active'
  }
}, {
  timestamps: true
});

const eventSchema = new mongoose.Schema({
  eventName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  campId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camp',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  shifts: [shiftSchema],
  status: {
    type: String,
    enum: ['active', 'cancelled', 'completed'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Index for efficient queries
eventSchema.index({ campId: 1 });
eventSchema.index({ createdBy: 1 });
eventSchema.index({ status: 1 });

module.exports = mongoose.model('Event', eventSchema);
