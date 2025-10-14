const mongoose = require('mongoose');

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
    duesStatus: {
      type: String,
      enum: ['Paid', 'Unpaid'],
      default: 'Unpaid'
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

module.exports = mongoose.model('Roster', rosterSchema);
