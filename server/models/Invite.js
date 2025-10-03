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

// Instance method to generate invite link
inviteSchema.methods.generateInviteLink = function(baseUrl = 'http://localhost:3000') {
  return `${baseUrl}/apply?token=${this.token}`;
};

module.exports = mongoose.model('Invite', inviteSchema);
