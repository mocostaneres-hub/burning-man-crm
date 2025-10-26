const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'General',
      'Account Management',
      'Camp Management',
      'Applications',
      'Tasks',
      'Members',
      'Technical Support',
      'Billing'
    ]
  },
  order: {
    type: Number,
    required: true,
    min: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  audience: {
    type: String,
    required: true,
    enum: ['both', 'camps', 'members'],
    default: 'both'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for efficient querying
faqSchema.index({ category: 1, order: 1 });
faqSchema.index({ isActive: 1, audience: 1 });

module.exports = mongoose.model('FAQ', faqSchema);
