const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    subject: {
      type: String,
      required: true
    },
    htmlContent: {
      type: String,
      required: true
    },
    textContent: {
      type: String,
      default: ''
    },
    variables: [
      {
        type: String
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
