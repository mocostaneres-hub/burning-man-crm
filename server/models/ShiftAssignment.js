const mongoose = require('mongoose');

const shiftAssignmentSchema = new mongoose.Schema(
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
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    source: {
      type: String,
      enum: ['CREATE_MODE', 'EDIT_ADD', 'ROSTER_AUTO_ADD'],
      default: 'CREATE_MODE'
    },
    modeSnapshot: {
      type: String,
      enum: ['ALL_ROSTER', 'LEADS_ONLY', 'SELECTED_USERS'],
      default: 'SELECTED_USERS'
    }
  },
  {
    timestamps: true
  }
);

shiftAssignmentSchema.index({ shiftId: 1, userId: 1 }, { unique: true });
shiftAssignmentSchema.index({ campId: 1, shiftId: 1 });
shiftAssignmentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ShiftAssignment', shiftAssignmentSchema);
