const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['work-shift', 'resource', 'skill', 'financial', 'other'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  hours: Number, // For work shifts
  value: Number, // For financial contributions
  currency: {
    type: String,
    default: 'USD'
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'verified', 'disputed'],
    default: 'pending'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  notes: String
});

const roleChangeSchema = new mongoose.Schema({
  fromRole: {
    type: String,
    enum: ['member', 'project-lead', 'camp-lead']
  },
  toRole: {
    type: String,
    enum: ['member', 'project-lead', 'camp-lead'],
    required: true
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: String,
  effectiveDate: {
    type: Date,
    default: Date.now
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  }
});

const memberSchema = new mongoose.Schema({
  // References
  camp: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camp',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Member info
  role: {
    type: String,
    enum: ['member', 'project-lead', 'camp-lead'],
    default: 'member'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'inactive', 'suspended', 'rejected'],
    default: 'pending'
  },
  
  // Application info
  applicationData: {
    type: mongoose.Schema.Types.Mixed, // Dynamic form data
    default: {}
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: Date,
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewNotes: String,
  
  // Member details
  nickname: String, // Camp-specific nickname
  bio: String, // Camp-specific bio
  skills: [String],
  interests: [String],
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  
  // Contact preferences
  contactPreferences: {
    email: { type: Boolean, default: true },
    phone: { type: Boolean, default: false },
    text: { type: Boolean, default: false }
  },
  
  // Projects and responsibilities
  projects: [{
    name: String,
    description: String,
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ['planning', 'active', 'completed', 'cancelled'],
      default: 'planning'
    },
    isLead: {
      type: Boolean,
      default: false
    }
  }],
  
  // Contributions
  contributions: [contributionSchema],
  
  // Role history
  roleHistory: [roleChangeSchema],
  
  // Attendance
  attendance: {
    confirmed: {
      type: Boolean,
      default: false
    },
    arrivalDate: Date,
    departureDate: Date,
    transportation: {
      type: String,
      enum: ['driving', 'flying', 'bus', 'other']
    },
    vehicleInfo: String,
    needs: [String] // Special needs or requests
  },
  
  // Dues and payments
  dues: {
    amount: Number,
    currency: {
      type: String,
      default: 'USD'
    },
    paid: {
      type: Boolean,
      default: false
    },
    paidAt: Date,
    paymentMethod: String,
    notes: String
  },
  
  // Work shifts
  workShifts: [{
    title: String,
    description: String,
    startTime: Date,
    endTime: Date,
    location: String,
    required: {
      type: Boolean,
      default: true
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Notes and communication
  notes: [{
    content: String,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    isPrivate: {
      type: Boolean,
      default: false
    }
  }],
  
  // Settings
  settings: {
    notifications: {
      announcements: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      reminders: { type: Boolean, default: true }
    },
    privacy: {
      showContactInfo: { type: Boolean, default: true },
      showContributions: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true
});

// Indexes
memberSchema.index({ camp: 1, user: 1 }, { unique: true });
memberSchema.index({ camp: 1, role: 1 });
memberSchema.index({ camp: 1, status: 1 });
memberSchema.index({ user: 1 });

// Virtual for full name
memberSchema.virtual('fullName').get(function() {
  if (this.user && this.user.firstName && this.user.lastName) {
    return `${this.user.firstName} ${this.user.lastName}`;
  }
  return this.nickname || 'Unknown';
});

// Virtual for total contributions
memberSchema.virtual('totalContributions').get(function() {
  return this.contributions.reduce((total, contribution) => {
    if (contribution.status === 'completed' || contribution.status === 'verified') {
      return total + (contribution.hours || 0);
    }
    return total;
  }, 0);
});

// Method to check if user can manage this member
memberSchema.methods.canBeManagedBy = function(userId, userRole) {
  if (userRole === 'super-admin') return true;
  if (userRole === 'camp-lead' && this.camp.owner.toString() === userId.toString()) return true;
  if (userRole === 'project-lead' && this.projects.some(p => p.isLead)) return true;
  return false;
};

module.exports = mongoose.model('Member', memberSchema);
