const mongoose = require('mongoose');

const surveyOptionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 1000 },
    value: { type: String, required: true, trim: true, maxlength: 1000 },
    isOther: { type: Boolean, default: false },
    nextSectionId: { type: String, default: '', trim: true, maxlength: 120 }
  },
  { _id: false }
);

const surveyQuestionSchema = new mongoose.Schema(
  {
    surveyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Survey',
      required: true,
      index: true
    },
    order: {
      type: Number,
      required: true
    },
    localId: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120
    },
    blockType: {
      type: String,
      enum: [
        'form_title',
        'description',
        'section_header',
        'image_block',
        'video_block',
        'short_answer',
        'paragraph',
        'multiple_choice',
        'checkboxes',
        'dropdown',
        'linear_scale',
        'multiple_choice_grid',
        'checkbox_grid',
        'people',
        'date',
        'time',
        'unsupported'
      ],
      required: true,
      index: true
    },
    prompt: {
      type: String,
      default: '',
      maxlength: 8000
    },
    helpText: {
      type: String,
      default: '',
      maxlength: 8000
    },
    required: {
      type: Boolean,
      default: false
    },
    options: {
      type: [surveyOptionSchema],
      default: []
    },
    rows: {
      type: [String],
      default: []
    },
    columns: {
      type: [String],
      default: []
    },
    linearScale: {
      min: { type: Number, default: 1 },
      max: { type: Number, default: 5 },
      minLabel: { type: String, default: '' },
      maxLabel: { type: String, default: '' }
    },
    validation: {
      kind: {
        type: String,
        enum: ['text', 'number', 'email', 'url', 'none'],
        default: 'none'
      },
      min: { type: Number, default: null },
      max: { type: Number, default: null },
      pattern: { type: String, default: null }
    },
    navigation: {
      defaultNextSectionId: { type: String, default: '', trim: true, maxlength: 120 }
    },
    mediaUrl: {
      type: String,
      default: null
    },
    supportLevel: {
      type: String,
      enum: ['supported', 'partial', 'unsupported'],
      default: 'supported'
    },
    warnings: {
      type: [String],
      default: []
    },
    sourceMeta: {
      externalType: { type: String, default: null },
      confidence: { type: Number, default: null },
      rawName: { type: String, default: null }
    },
    isSuggestion: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

surveyQuestionSchema.index({ surveyId: 1, order: 1 }, { unique: true });

module.exports = mongoose.model('SurveyQuestion', surveyQuestionSchema);
