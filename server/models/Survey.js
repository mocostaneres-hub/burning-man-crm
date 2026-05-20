const mongoose = require('mongoose');

const surveySchema = new mongoose.Schema(
  {
    campId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Camp',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240
    },
    description: {
      type: String,
      default: '',
      maxlength: 8000
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'closed'],
      default: 'draft',
      index: true
    },
    isLocked: {
      type: Boolean,
      default: false
    },
    lockReason: {
      type: String,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    sentAt: {
      type: Date,
      default: null
    },
    closedAt: {
      type: Date,
      default: null
    },
    targeting: {
      assignmentMode: {
        type: String,
        enum: ['ALL_ROSTER', 'LEADS_ONLY', 'SELECTED_USERS'],
        default: 'ALL_ROSTER'
      },
      selectedUserIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      ],
      manualAddIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      ],
      manualRemoveIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      ],
      snapshotAssignmentUserIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      ]
    },
    sourceImport: {
      sourceUrl: {
        type: String,
        default: null
      },
      importSuggestionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SurveyImportSuggestion',
        default: null
      },
      parserVersion: {
        type: String,
        default: null
      },
      importedAt: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true
  }
);

surveySchema.index({ campId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Survey', surveySchema);
