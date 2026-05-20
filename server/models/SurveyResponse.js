const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SurveyQuestion',
      required: true
    },
    blockType: {
      type: String,
      required: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    valueType: {
      type: String,
      default: 'mixed'
    }
  },
  { _id: false }
);

const responseEditSchema = new mongoose.Schema(
  {
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    editedAt: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      default: ''
    }
  },
  { _id: false }
);

const surveyResponseSchema = new mongoose.Schema(
  {
    surveyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Survey',
      required: true,
      index: true
    },
    campId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camp',
      required: true,
      index: true
    },
    submittedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    submittedByMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true
    },
    coveredMemberIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Member'
      }
    ],
    answers: {
      type: [answerSchema],
      default: []
    },
    editHistory: {
      type: [responseEditSchema],
      default: []
    },
    submittedAt: {
      type: Date,
      default: Date.now
    },
    lastEditedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

surveyResponseSchema.index({ surveyId: 1, submittedByUserId: 1, createdAt: -1 });

module.exports = mongoose.model('SurveyResponse', surveyResponseSchema);
