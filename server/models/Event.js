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
  currentSignups: {
    type: Number,
    default: 0,
    min: 0
  },
  memberIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Member'
  }],
  requiredSkills: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'completed'],
    default: 'active'
  },
  // Assignment mode is the durable rule that decides whether late-joining
  // roster members automatically gain access to this shift.
  //
  //   ALL_ROSTER     — anyone on the live active roster can sign up; new
  //                    members who join the roster after the shift was
  //                    published are auto-eligible. ShiftAssignment rows
  //                    are still written as a cache, but they are NOT the
  //                    source of truth for eligibility on this mode.
  //   LEADS_ONLY     — only roster members marked as Camp Lead. New leads
  //                    auto-gain access; non-leads do not.
  //   SELECTED_USERS — explicit, snapshot-based audience. Eligibility is
  //                    strictly the set captured in ShiftAssignment at
  //                    create/edit time. Late-joiners are NOT added.
  //
  // Defaulting to ALL_ROSTER preserves the historical behaviour of
  // resolveAssignmentCandidates (which used 'ALL_ROSTER' as its fallback)
  // and matches the most common product intent ("invite the whole camp").
  assignmentMode: {
    type: String,
    enum: ['ALL_ROSTER', 'LEADS_ONLY', 'SELECTED_USERS'],
    default: 'ALL_ROSTER'
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
  eventDate: {
    type: Date
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
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
  },
  pdtMigrated: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
eventSchema.index({ campId: 1 });
eventSchema.index({ createdBy: 1 });
eventSchema.index({ status: 1 });

module.exports = mongoose.model('Event', eventSchema);
