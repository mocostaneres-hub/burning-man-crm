const mongoose = require('mongoose');
const { normalizeDuesStatus, DUES_STATUS } = require('../utils/duesStateMachine');

const rosterSchema = new mongoose.Schema({
  camp: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camp',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  rosterType: {
    type: String,
    enum: ['shifts_only', 'full_membership'],
    default: 'full_membership'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  members: [{
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    overrides: {
      playaName: {
        type: String,
        trim: true
      },
      yearsBurned: {
        type: Number,
        min: 0
      },
      skills: [{
        type: String
      }],
      hasTicket: {
        type: Boolean
      },
      hasVehiclePass: {
        type: Boolean
      },
      interestedInEAP: {
        type: Boolean
      },
      interestedInStrike: {
        type: Boolean
      },
      arrivalDate: {
        type: Date
      },
      departureDate: {
        type: Date
      },
      city: {
        type: String,
        trim: true
      },
      state: {
        type: String,
        trim: true
      },
      // Structured location for standardized city selection in roster overrides.
      location: {
        city: {
          type: String,
          trim: true
        },
        state: {
          type: String,
          trim: true
        },
        country: {
          type: String,
          trim: true
        },
        countryCode: {
          type: String,
          trim: true,
          uppercase: true
        },
        lat: Number,
        lng: Number,
        placeId: {
          type: String,
          trim: true
        }
      }
    },
    status: {
      type: String,
      enum: ['approved', 'pending', 'rejected'],
      default: 'approved'
    },
    role: {
      type: String,
      enum: ['member', 'lead', 'admin'],
      default: 'member'
    },
    isCampLead: {
      type: Boolean,
      default: false,
      // Camp Lead is a delegated admin role for this specific camp
      // Grants permission to manage roster, applications, and camp operations
      // Can only be assigned by Main Camp Admin (camp owner)
      // User must be on roster with status='approved' to be eligible
    },
    // Legacy boolean field kept for migration safety.
    paid: {
      type: Boolean
    },
    duesStatus: {
      type: String,
      enum: Object.values(DUES_STATUS),
      default: DUES_STATUS.UNPAID
    },
    duesInstructedAt: {
      type: Date,
      default: null
    },
    duesPaidAt: {
      type: Date,
      default: null
    },
    duesReceiptSentAt: {
      type: Date,
      default: null
    },
    duesPaidByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  archivedAt: {
    type: Date
  },
  archivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Ensure only one active roster per camp
rosterSchema.index({ camp: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

rosterSchema.pre('validate', function(next) {
  if (Array.isArray(this.members)) {
    this.members.forEach((memberEntry) => {
      memberEntry.duesStatus = normalizeDuesStatus(memberEntry.duesStatus);
      if (memberEntry.paid === undefined || memberEntry.paid === null) {
        memberEntry.paid = memberEntry.duesStatus === DUES_STATUS.PAID;
      }
    });
  }
  next();
});

module.exports = mongoose.model('Roster', rosterSchema);
