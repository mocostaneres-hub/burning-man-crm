const mongoose = require('mongoose');

const campCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 100
  }
}, {
  timestamps: true
});

// Create index for better query performance
campCategorySchema.index({ name: 1 });

module.exports = mongoose.model('CampCategory', campCategorySchema);
