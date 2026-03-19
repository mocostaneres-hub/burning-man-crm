const mongoose = require('mongoose');

const shiftSignupSchema = new mongoose.Schema(
  {
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true
    },
    campId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camp',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

shiftSignupSchema.index({ shiftId: 1, userId: 1 }, { unique: true });
shiftSignupSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ShiftSignup', shiftSignupSchema);
