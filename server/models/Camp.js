const mongoose = require('mongoose');


const campSchema = new mongoose.Schema({
  // Camp owner (User with accountType: 'camp')
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Camp basic info
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: false, // Generated automatically in pre-save hook
    unique: true,
    sparse: true, // Allows null values while maintaining uniqueness
    lowercase: true
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  bio: {
    type: String,
    maxlength: 5000
  },
  
  // Camp details
  theme: {
    type: String,
    trim: true
  },
  yearFounded: {
    type: Number
  },
  campSize: {
    type: String,
    enum: ['small', 'medium', 'large', 'mega'],
    default: 'medium'
  },
  maxMembers: {
    type: Number,
    default: 50
  },
  approximateSize: {
    type: Number,
    default: 10,
    min: 1,
    max: 1000
  },
  
  // Location
  location: {
    city: String,
    state: String,
    country: {
      type: String,
      default: 'USA'
    },
    playaLocation: String, // Where they camp on the playa
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  
  // Media
  photos: [{
    url: String, // Cloudinary URL
    caption: String,
    isPrimary: {
      type: Boolean,
      default: false
    }
  }],
  videos: [{
    url: String,
    platform: {
      type: String,
      enum: ['youtube', 'vimeo', 'direct']
    },
    caption: String
  }],
  
  // Contact (Internal - for camp admin use only)
  contactEmail: {
    type: String,
    required: true
  },
  contactPhone: {
    type: String,
    trim: true
  },
  website: String,
  
  // Public social media
  socialMedia: {
    facebook: String,
    instagram: String,
    twitter: String,
    tiktok: String,
    website: String
  },
  
  // Camp offerings and amenities
  customOfferings: [String],
  
  
  // Camp categories
  categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CampCategory'
  }],
  
  // Selected perks (managed globally)
  selectedPerks: [{
    perkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GlobalPerk',
      required: true
    },
    isOn: {
      type: Boolean,
      default: false
    }
  }],
  
  // Camp Offerings
  offerings: {
    // Infrastructure
    water: { type: Boolean, default: false },
    fullPower: { type: Boolean, default: false },
    partialPower: { type: Boolean, default: false },
    rvPower: { type: Boolean, default: false },
    acceptsRVs: { type: Boolean, default: false },
    shadeForTents: { type: Boolean, default: false },
    showers: { type: Boolean, default: false },
    communalKitchen: { type: Boolean, default: false },
    storage: { type: Boolean, default: false },
    wifi: { type: Boolean, default: false },
    ice: { type: Boolean, default: false },
    
    // Food & Drink
    food: { type: Boolean, default: false },
    coffee: { type: Boolean, default: false },
    bar: { type: Boolean, default: false },
    snacks: { type: Boolean, default: false },
    
    // Activities & Entertainment
    music: { type: Boolean, default: false },
    art: { type: Boolean, default: false },
    workshops: { type: Boolean, default: false },
    performances: { type: Boolean, default: false },
    games: { type: Boolean, default: false },
    yoga: { type: Boolean, default: false },
    meditation: { type: Boolean, default: false },
    
    // Services
    bikeRepair: { type: Boolean, default: false },
    massage: { type: Boolean, default: false },
    hairStyling: { type: Boolean, default: false },
    facePainting: { type: Boolean, default: false },
    costumeRental: { type: Boolean, default: false },
    
    // Community
    sharedSpace: { type: Boolean, default: false },
    campfire: { type: Boolean, default: false },
    socialEvents: { type: Boolean, default: false },
    welcomeNewbies: { type: Boolean, default: false }
  },
  
  // Member requirements
  requirements: {
    minAge: {
      type: Number,
      default: 18
    },
    dues: {
      amount: Number,
      currency: {
        type: String,
        default: 'USD'
      },
      description: String
    },
    workShifts: {
      required: {
        type: Boolean,
        default: true
      },
      hours: Number,
      description: String
    },
    skills: [String],
    experience: {
      type: String,
      enum: ['any', 'first-timer-friendly', 'experienced-preferred', 'veterans-only']
    }
  },
  
  
  // Status and public profile settings
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'archived'],
    default: 'active'
  },
  isRecruiting: {
    type: Boolean,
    default: true
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // Public profile features
  hometown: String,
  burningSince: Number, // Year they started burning
  acceptingNewMembers: {
    type: Boolean,
    default: true
  },
  showApplyNow: {
    type: Boolean,
    default: true
  },
  showMemberCount: {
    type: Boolean,
    default: true
  },
  
  // Hero and gallery photos
  heroPhoto: {
    url: String,
    caption: String
  },
  galleryPhotos: [{
    url: String,
    caption: String,
    order: { type: Number, default: 0 }
  }],
  photos: [String], // Array of photo URLs
  primaryPhotoIndex: { type: Number, default: 0 }, // Index of the primary photo
  
  // Statistics
  stats: {
    totalMembers: {
      type: Number,
      default: 0
    },
    totalApplications: {
      type: Number,
      default: 0
    },
    acceptanceRate: {
      type: Number,
      default: 0
    }
  },
  
  // Settings
  settings: {
    allowMemberInvites: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: true
    },
    autoApprove: {
      type: Boolean,
      default: false
    },
    notifications: {
      newApplications: { type: Boolean, default: true },
      memberUpdates: { type: Boolean, default: true },
      messages: { type: Boolean, default: true }
    }
  },
  
  // Invite Templates
  inviteTemplateEmail: {
    type: String,
    default: "Hello! You've been personally invited to apply to join our camp, {{campName}}, for Burning Man. Click here to start your application: {{link}}"
  },
  inviteTemplateSMS: {
    type: String,
    default: "You're invited to {{campName}}! Apply here: {{link}}"
  }
}, {
  timestamps: true
});

// Indexes
campSchema.index({ slug: 1 });
campSchema.index({ owner: 1 });
campSchema.index({ 'location.city': 1, 'location.state': 1 });
campSchema.index({ status: 1, isPublic: 1 });
campSchema.index({ isRecruiting: 1, status: 1 });

// Virtual for primary photo
campSchema.virtual('primaryPhoto').get(function() {
  const primary = this.photos.find(photo => photo.isPrimary);
  return primary ? primary.url : (this.photos.length > 0 ? this.photos[0].url : null);
});

// Pre-save middleware to generate slug
campSchema.pre('save', function(next) {
  if (this.isModified('name') || !this.slug) {
    // Always regenerate slug when name changes OR if slug doesn't exist
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('Camp', campSchema);
