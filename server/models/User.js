const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const socialMediaSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['instagram', 'facebook', 'twitter', 'linkedin', 'website', 'youtube', 'tiktok'],
    required: true
  },
  url: {
    type: String,
    required: true
  }
});

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // OAuth fields
  googleId: {
    type: String,
    sparse: true // Allows multiple null values
  },
  appleId: {
    type: String,
    sparse: true // Allows multiple null values
  },
  accountType: {
    type: String,
    enum: ['personal', 'camp'],
    required: true
  },
  
  // Personal account fields
  firstName: {
    type: String,
    trim: true
  },
  lastName: {
    type: String,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  yearsBurned: {
    type: Number,
    min: 0,
    max: 50
  },
  previousCamps: {
    type: String,
    maxlength: 1000
  },
  bio: {
    type: String,
    maxlength: 1000
  },
  playaName: {
    type: String,
    trim: true,
    maxlength: 100
  },
  profilePhoto: {
    type: String // Cloudinary URL
  },
  photos: [{
    type: String // Array of Cloudinary URLs
  }],
  socialMedia: {
    instagram: String,
    facebook: String,
    linkedin: String
  },
  skills: [{
    type: String,
    trim: true
  }],
  interests: [{
    type: String,
    trim: true
  }],
  burningManExperience: {
    type: String,
    enum: ['first-timer', '1-2-years', '3-5-years', '5+ years', 'veteran']
  },
  location: {
    city: String,
    state: String,
    country: String
  },
  
  // G8Road specific fields
  hasTicket: {
    type: Boolean,
    default: false
  },
  hasVehiclePass: {
    type: Boolean,
    default: false
  },
  arrivalDate: {
    type: Date
  },
  departureDate: {
    type: Date
  },
  interestedInEAP: {
    type: Boolean,
    default: false
  },
  
  // Camp account fields
  campName: {
    type: String,
    trim: true
  },
  campBio: {
    type: String,
    maxlength: 2000
  },
  campPhotos: [{
    type: String // Array of Cloudinary URLs
  }],
  campSocialMedia: [socialMediaSchema],
  campLocation: {
    city: String,
    state: String,
    country: String
  },
  campTheme: {
    type: String,
    trim: true
  },
  campSize: {
    type: String,
    enum: ['small', 'medium', 'large', 'mega']
  },
  campYearFounded: {
    type: Number
  },
  campWebsite: {
    type: String
  },
  campEmail: {
    type: String
  },
  
  // Common fields
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    privacy: {
      profileVisibility: { type: String, enum: ['public', 'private'], default: 'public' }
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
userSchema.index({ email: 1 });
userSchema.index({ accountType: 1 });
userSchema.index({ 'location.city': 1, 'location.state': 1 });
userSchema.index({ 'campLocation.city': 1, 'campLocation.state': 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Get display name based on account type
userSchema.methods.getDisplayName = function() {
  if (this.accountType === 'camp') {
    return this.campName || 'Unnamed Camp';
  } else {
    return `${this.firstName || ''} ${this.lastName || ''}`.trim() || 'Anonymous';
  }
};

// Get profile photo
userSchema.methods.getProfilePhoto = function() {
  if (this.accountType === 'camp') {
    return this.campPhotos && this.campPhotos.length > 0 ? this.campPhotos[0] : null;
  } else {
    return this.profilePhoto;
  }
};

module.exports = mongoose.model('User', userSchema);
