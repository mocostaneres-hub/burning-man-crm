const mongoose = require('mongoose');

const surveyAssignmentSchema = new mongoose.Schema(
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    assignmentModeSnapshot: {
      type: String,
      enum: ['ALL_ROSTER', 'LEADS_ONLY', 'SELECTED_USERS'],
      default: 'ALL_ROSTER'
    }
  },
  {
    timestamps: true
  }
);

surveyAssignmentSchema.index({ surveyId: 1, userId: 1 }, { unique: true });
surveyAssignmentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SurveyAssignment', surveyAssignmentSchema);
