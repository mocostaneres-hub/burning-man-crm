const mongoose = require('mongoose');

const globalPerkSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  icon: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  color: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  }
}, {
  timestamps: true
});

globalPerkSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('GlobalPerk', globalPerkSchema);


