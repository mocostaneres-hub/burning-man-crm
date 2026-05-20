const mongoose = require('mongoose');

const surveyResponseMemberSchema = new mongoose.Schema(
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
    responseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SurveyResponse',
      required: true,
      index: true
    },
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true,
      index: true
    },
    submitterMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: true
    },
    submittedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

surveyResponseMemberSchema.index({ surveyId: 1, memberId: 1 }, { unique: true });
surveyResponseMemberSchema.index({ memberId: 1, surveyId: 1 });

module.exports = mongoose.model('SurveyResponseMember', surveyResponseMemberSchema);
