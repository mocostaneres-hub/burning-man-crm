const mongoose = require('mongoose');

const surveyImportSuggestionSchema = new mongoose.Schema(
  {
    campId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camp',
      required: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    surveyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Survey',
      default: null
    },
    sourceUrl: {
      type: String,
      required: true
    },
    normalizedUrl: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['parsed', 'failed', 'rejected_private', 'rejected_inaccessible'],
      required: true
    },
    suggestion: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      blocks: { type: [mongoose.Schema.Types.Mixed], default: [] },
      warnings: { type: [String], default: [] },
      unsupportedCount: { type: Number, default: 0 },
      parserVersion: { type: String, default: 'v1' }
    },
    fetchMeta: {
      finalUrl: { type: String, default: null },
      httpStatus: { type: Number, default: null },
      contentType: { type: String, default: null },
      byteSize: { type: Number, default: null },
      durationMs: { type: Number, default: null }
    },
    errorMessage: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

surveyImportSuggestionSchema.index({ campId: 1, createdAt: -1 });

module.exports = mongoose.model('SurveyImportSuggestion', surveyImportSuggestionSchema);
