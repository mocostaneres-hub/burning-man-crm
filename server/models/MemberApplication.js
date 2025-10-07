const mongoose = require('mongoose');

const memberApplicationSchema = new mongoose.Schema({
  // Applicant (User with accountType: 'personal')
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Camp they're applying to
  camp: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camp',
    required: true
  },
  
  // Application details
  applicationData: {
    motivation: {
      type: String,
      required: true,
      maxlength: 1000
    },
    experience: {
      type: String,
      maxlength: 1000
    },
    skills: [String],
    availability: {
      arriveDate: Date,
      departDate: Date,
      workShifts: {
        type: String,
        maxlength: 500
      }
    },
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String
    }
  },
  
  // Application status
  status: {
    type: String,
    enum: ['pending', 'call-scheduled', 'pending-orientation', 'under-review', 'approved', 'rejected', 'unresponsive'],
    default: 'pending'
  },
  
  // Review details
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  reviewNotes: String,
  
  // Call scheduling
  chosenCallSlot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CallSlot'
  },
  
  // Additional notes
  notes: String,
  
  // Dues status
  duesStatus: {
    type: String,
    enum: ['Unpaid', 'Paid'],
    default: 'Unpaid'
  },
  
  // Important dates
  appliedAt: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  // Communication
  messages: [{
    from: {
      type: String,
      enum: ['applicant', 'camp'],
      required: true
    },
    message: {
      type: String,
      required: true,
      maxlength: 2000
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    readBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      readAt: Date
    }]
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
memberApplicationSchema.index({ camp: 1, status: 1 });
memberApplicationSchema.index({ applicant: 1, status: 1 });
memberApplicationSchema.index({ appliedAt: -1 });
memberApplicationSchema.index({ camp: 1, appliedAt: -1 });

// Virtual for unread message count
memberApplicationSchema.virtual('unreadMessagesCount').get(function() {
  if (!this.messages || this.messages.length === 0) return 0;
  
  const lastMessage = this.messages[this.messages.length - 1];
  if (lastMessage.from === 'camp') {
    // Applicant hasn't read the last camp message
    return 1;
  }
  
  // Count unread camp messages for camp admins
  return this.messages.filter(msg => 
    msg.from === 'applicant' && 
    !msg.readBy.some(read => read.user.toString() === this.camp.owner.toString())
  ).length;
});

// Pre-save middleware to update lastUpdated
memberApplicationSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('MemberApplication', memberApplicationSchema);
