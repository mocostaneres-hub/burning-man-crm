const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
  // Camp that this invite is for
  campId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camp',
    required: true
  },
  
  // User who sent the invite
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Recipient contact information
  recipient: {
    type: String,
    required: true,
    trim: true
  },
  
  // Method of invitation
  method: {
    type: String,
    enum: ['email', 'sms'],
    required: true
  },
  
  // Status of the invitation
  status: {
    type: String,
    enum: ['pending', 'sent', 'applied', 'expired'],
    default: 'pending'
  },
  
  // Secure token for redemption
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Expiration date (default: 7 days from creation)
  expiresAt: {
    type: Date,
    required: true,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }
  },
  
  // Track who applied using this invite
  appliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  
  // When the invite was used to apply
  appliedAt: {
    type: Date,
    required: false
  }
}, {
  timestamps: true
});

// Indexes for performance
inviteSchema.index({ campId: 1, status: 1 });
inviteSchema.index({ token: 1 });
inviteSchema.index({ expiresAt: 1 });
inviteSchema.index({ senderId: 1 });

// Automatic cleanup of expired invites
inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to validate email format if method is email
inviteSchema.pre('save', function(next) {
  if (this.method === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.recipient)) {
      return next(new Error('Invalid email format'));
    }
  }
  next();
});

// Static method to find active invites
inviteSchema.statics.findActiveInvites = function(campId, status = null) {
  const query = { 
    campId, 
    expiresAt: { $gt: new Date() } 
  };
  
  if (status) {
    query.status = status;
  }
  
  return this.find(query).populate('senderId', 'firstName lastName email');
};

// Instance method to check if invite is expired
inviteSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// ============================================================================
// CRITICAL: Invitation Links Must Never Hardcode localhost
// ============================================================================
// Email links MUST use environment-based URLs for production safety.
// 
// WHY email links must never hardcode localhost:
// 1. Emails are sent to external recipients (not just developers)
// 2. Localhost links don't work outside local machine
// 3. Production emails with localhost links are broken
// 4. Users can't click links in real invitation emails
// 
// WHY environment-based URLs are required:
// 1. Development: CLIENT_URL = http://localhost:3000
// 2. Production: CLIENT_URL = https://www.g8road.com
// 3. Staging: CLIENT_URL = https://staging.g8road.com
// 4. Future: Deep links for mobile apps (g8road://apply?token=...)
// 
// This method REQUIRES CLIENT_URL to be set and throws if missing.
// This prevents silent failures and broken production emails.
// ============================================================================

// Instance method to generate invite link
inviteSchema.methods.generateInviteLink = function(baseUrl) {
  // NEVER provide a default - force explicit configuration
  if (!baseUrl) {
    throw new Error(
      'CLIENT_URL environment variable is required for invitation links. ' +
      'Set CLIENT_URL in your environment (e.g., https://www.g8road.com for production, ' +
      'http://localhost:3000 for development)'
    );
  }
  
  // Validate that it's not localhost in production-like environments
  if (process.env.NODE_ENV === 'production' && baseUrl.includes('localhost')) {
    console.error('❌ [CRITICAL] CLIENT_URL is set to localhost in production environment!');
    throw new Error(
      'CLIENT_URL cannot be localhost in production. ' +
      'Set CLIENT_URL=https://www.g8road.com in your production environment variables.'
    );
  }
  
  return `${baseUrl}/apply?token=${this.token}`;
};

module.exports = mongoose.model('Invite', inviteSchema);
