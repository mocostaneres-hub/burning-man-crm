const express = require('express');
const mongoose = require('mongoose');

const { authenticateToken } = require('../middleware/auth');
const db = require('../database/databaseAdapter');
const {
  canManageCamp,
  canAccessCamp
} = require('../utils/permissionHelpers');
const { createBulkNotifications } = require('../services/notificationService');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');
const { recordActivity } = require('../services/activityLogger');
const { resolveAssignmentCandidates } = require('../services/shiftService');
const {
  analyzePublicFormUrl,
  PARSER_VERSION
} = require('../services/surveyImportService');

const Survey = require('../models/Survey');
const SurveyQuestion = require('../models/SurveyQuestion');
const SurveyAssignment = require('../models/SurveyAssignment');
const SurveyResponse = require('../models/SurveyResponse');
const SurveyResponseMember = require('../models/SurveyResponseMember');
const SurveyImportSuggestion = require('../models/SurveyImportSuggestion');
const Member = require('../models/Member');
const User = require('../models/User');

const router = express.Router();

const MONGO_FEATURE_ENABLED = !!process.env.MONGODB_URI || !!process.env.MONGO_URI;

function ensureMongoFeature(res) {
  if (!MONGO_FEATURE_ENABLED) {
    res.status(503).json({
      message: 'Survey feature requires MongoDB. Please configure MONGODB_URI.'
    });
    return false;
  }
  return true;
}

function toIdString(value) {
  if (!value) return null;
  if (typeof value === 'object' && value._id) return value._id.toString();
  return value.toString();
}

function dedupeIdList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => toIdString(item)).filter(Boolean))];
}

const SUPPORTED_BLOCK_TYPES = new Set([
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
]);

function normalizeLocalId(value, fallback) {
  const raw = String(value || fallback || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 120);
  return raw || fallback;
}

function normalizeSectionTarget(value) {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 120);
}

function normalizeQuestionInput(question, fallbackOrder) {
  const requestedBlockType = String(question?.blockType || 'short_answer');
  const blockType = SUPPORTED_BLOCK_TYPES.has(requestedBlockType) ? requestedBlockType : 'unsupported';
  const options = Array.isArray(question?.options)
    ? question.options
        .map((option) => ({
          label: String(option?.label || option?.value || '').trim(),
          value: String(option?.value || option?.label || '').trim(),
          isOther: option?.isOther === true,
          nextSectionId: normalizeSectionTarget(option?.nextSectionId)
        }))
        .filter((option) => option.label && option.value)
    : [];
  const fallbackLocalId = `${blockType === 'section_header' ? 'section' : 'question'}_${fallbackOrder + 1}`;

  return {
    order: Number.isFinite(Number(question?.order)) ? Number(question.order) : fallbackOrder,
    localId: normalizeLocalId(question?.localId || question?.clientId, fallbackLocalId),
    blockType,
    prompt: String(question?.prompt || '').trim(),
    helpText: String(question?.helpText || '').trim(),
    required: question?.required === true,
    options,
    rows: Array.isArray(question?.rows) ? question.rows.map((row) => String(row || '').trim()).filter(Boolean) : [],
    columns: Array.isArray(question?.columns) ? question.columns.map((col) => String(col || '').trim()).filter(Boolean) : [],
    linearScale: {
      min: Number.isFinite(Number(question?.linearScale?.min)) ? Number(question.linearScale.min) : 1,
      max: Number.isFinite(Number(question?.linearScale?.max)) ? Number(question.linearScale.max) : 5,
      minLabel: String(question?.linearScale?.minLabel || '').trim(),
      maxLabel: String(question?.linearScale?.maxLabel || '').trim()
    },
    validation: {
      kind: ['text', 'number', 'email', 'url', 'none'].includes(question?.validation?.kind)
        ? question.validation.kind
        : 'none',
      min: Number.isFinite(Number(question?.validation?.min)) ? Number(question.validation.min) : null,
      max: Number.isFinite(Number(question?.validation?.max)) ? Number(question.validation.max) : null,
      pattern: question?.validation?.pattern ? String(question.validation.pattern) : null
    },
    navigation: {
      defaultNextSectionId: normalizeSectionTarget(question?.navigation?.defaultNextSectionId)
    },
    mediaUrl: question?.mediaUrl ? String(question.mediaUrl).trim() : null,
    supportLevel: ['supported', 'partial', 'unsupported'].includes(question?.supportLevel)
      ? question.supportLevel
      : 'supported',
    warnings: Array.isArray(question?.warnings) ? question.warnings.map((warning) => String(warning)).filter(Boolean) : [],
    sourceMeta: {
      externalType: question?.sourceMeta?.externalType || null,
      confidence: Number.isFinite(Number(question?.sourceMeta?.confidence)) ? Number(question.sourceMeta.confidence) : null,
      rawName: question?.sourceMeta?.rawName || null
    },
    isSuggestion: question?.isSuggestion === true
  };
}

async function getActiveRosterMemberMap(campId) {
  const activeRoster = await db.findActiveRoster({ camp: campId });
  if (!activeRoster || !Array.isArray(activeRoster.members)) {
    return {
      memberMap: new Map(),
      memberIds: [],
      activeRoster
    };
  }

  const memberMap = new Map();
  for (const entry of activeRoster.members) {
    const status = String(entry?.status || '').toLowerCase();
    if (!['approved', 'active'].includes(status)) continue;
    const memberDoc = entry?.member;
    const memberId = memberDoc?._id ? memberDoc._id.toString() : memberDoc?.toString();
    if (!memberId) continue;
    memberMap.set(memberId, memberDoc);
  }

  return { memberMap, memberIds: Array.from(memberMap.keys()), activeRoster };
}

async function resolveSubmitterMember(req, campId) {
  return Member.findOne({
    camp: campId,
    user: req.user._id,
    status: { $in: ['active', 'approved'] }
  }).lean();
}

async function buildCompletionStats({ survey, memberIds, memberMap }) {
  const [assignedCount, completedCount] = await Promise.all([
    SurveyAssignment.countDocuments({ surveyId: survey._id }),
    SurveyResponseMember.countDocuments({ surveyId: survey._id, memberId: { $in: memberIds } })
  ]);

  const completionRate = memberIds.length > 0 ? Math.round((completedCount / memberIds.length) * 100) : 0;
  return {
    totalRosterMembers: memberIds.length,
    assignedUsers: assignedCount,
    completedMembers: completedCount,
    pendingMembers: Math.max(memberIds.length - completedCount, 0),
    completionRate,
    hasRoster: memberMap.size > 0
  };
}

function isManagerCampAdmin(req, campId) {
  return canAccessCamp(req, campId);
}

async function canUserRespondToSurvey(req, survey) {
  const [manager, assignment] = await Promise.all([
    canManageCamp(req, survey.campId),
    SurveyAssignment.exists({ surveyId: survey._id, userId: req.user._id })
  ]);
  if (manager) return { allowed: true, manager: true, assigned: !!assignment };
  return { allowed: !!assignment, manager: false, assigned: !!assignment };
}

function getMemberDisplayName(memberDoc, userById) {
  if (!memberDoc) return 'Unknown';
  const userId = toIdString(memberDoc.user);
  const user = userId ? userById.get(userId) : null;
  if (user) {
    const combined = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (combined) return combined;
  }
  return memberDoc.name || memberDoc.playaName || memberDoc.nickname || 'Unknown';
}

function getRosterMemberDisplayName(memberDoc) {
  if (!memberDoc) return 'Unknown';
  if (memberDoc.user && typeof memberDoc.user === 'object') {
    const combined = `${memberDoc.user.firstName || ''} ${memberDoc.user.lastName || ''}`.trim();
    if (combined) return combined;
    if (memberDoc.user.email) return memberDoc.user.email;
  }
  return memberDoc.name || memberDoc.playaName || memberDoc.nickname || memberDoc.email || 'Unknown';
}

async function saveQuestionsForSurvey(surveyId, rawQuestions = [], { session = null } = {}) {
  const normalized = rawQuestions.map((question, index) => normalizeQuestionInput(question, index));
  const usedLocalIds = new Set();
  for (const question of normalized) {
    const baseLocalId = question.localId || `${question.blockType === 'section_header' ? 'section' : 'question'}_${question.order + 1}`;
    let nextLocalId = baseLocalId;
    let suffix = 2;
    while (usedLocalIds.has(nextLocalId)) {
      nextLocalId = normalizeLocalId(`${baseLocalId}_${suffix}`, `${baseLocalId}_${suffix}`);
      suffix += 1;
    }
    question.localId = nextLocalId;
    usedLocalIds.add(nextLocalId);
  }
  await SurveyQuestion.deleteMany({ surveyId }).session(session || null);
  if (!normalized.length) return [];
  const docs = normalized.map((question) => ({
    surveyId,
    ...question
  }));
  const created = await SurveyQuestion.insertMany(docs, { session: session || undefined });
  return created;
}

function extractPeopleMemberIdsFromAnswerValue(value) {
  if (!Array.isArray(value)) return [];
  return dedupeIdList(
    value.map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        return item.memberId || item._id || item.id || item.value;
      }
      return null;
    })
  );
}

function getQuestionForAnswer(answer, questionById) {
  const questionId = toIdString(answer?.questionId);
  return questionId ? questionById.get(questionId) : null;
}

function extractPeopleMemberIdsFromAnswers(answers, questionById) {
  const selectedIds = [];
  for (const answer of Array.isArray(answers) ? answers : []) {
    const question = getQuestionForAnswer(answer, questionById);
    const blockType = answer?.blockType || question?.blockType;
    if (blockType !== 'people') continue;
    selectedIds.push(...extractPeopleMemberIdsFromAnswerValue(answer.value));
  }
  return dedupeIdList(selectedIds);
}

function normalizeSurveyAnswers(rawAnswers, questionById, memberMap = null) {
  if (!Array.isArray(rawAnswers)) return [];
  return rawAnswers
    .filter((answer) => answer?.questionId)
    .map((answer) => {
      const question = getQuestionForAnswer(answer, questionById);
      const blockType = answer.blockType || question?.blockType || 'short_answer';
      if (blockType !== 'people') {
        return {
          questionId: answer.questionId,
          blockType,
          value: answer.value ?? null,
          valueType: answer.valueType || typeof answer.value
        };
      }

      const memberIds = extractPeopleMemberIdsFromAnswerValue(answer.value).filter((memberId) =>
        memberMap ? memberMap.has(memberId) : true
      );
      return {
        questionId: answer.questionId,
        blockType: 'people',
        value: memberIds.map((memberId) => ({
          memberId,
          name: getRosterMemberDisplayName(memberMap?.get(memberId))
        })),
        valueType: 'array'
      };
    });
}

async function writeResponseWithCoverage({
  survey,
  submitterMember,
  coveredMemberIds,
  answers
}) {
  const responsePayload = {
    surveyId: survey._id,
    campId: survey.campId,
    submittedByUserId: submitterMember.user,
    submittedByMemberId: submitterMember._id,
    coveredMemberIds,
    answers: Array.isArray(answers) ? answers : [],
    submittedAt: new Date()
  };

  const coverageDocs = coveredMemberIds.map((memberId) => ({
    surveyId: survey._id,
    campId: survey.campId,
    responseId: null,
    memberId,
    submitterMemberId: submitterMember._id,
    submittedByUserId: submitterMember.user
  }));

  const createWithoutTransaction = async () => {
    const existing = await SurveyResponseMember.find({
      surveyId: survey._id,
      memberId: { $in: coveredMemberIds }
    }).lean();
    if (existing.length > 0) {
      const err = new Error('Some selected members have already been covered by another response');
      err.code = 'MEMBER_ALREADY_COVERED';
      err.conflicts = existing.map((item) => item.memberId.toString());
      throw err;
    }

    const response = await SurveyResponse.create(responsePayload);
    const docs = coverageDocs.map((doc) => ({ ...doc, responseId: response._id }));
    try {
      await SurveyResponseMember.insertMany(docs, { ordered: true });
    } catch (error) {
      if (error?.code === 11000 || Array.isArray(error?.writeErrors)) {
        const duplicate = new Error('Some selected members were submitted at the same time by another responder');
        duplicate.code = 'MEMBER_ALREADY_COVERED';
        throw duplicate;
      }
      throw error;
    }
    return response;
  };

  try {
    const session = await mongoose.startSession();
    let createdResponse = null;
    try {
      await session.withTransaction(async () => {
        const existing = await SurveyResponseMember.find({
          surveyId: survey._id,
          memberId: { $in: coveredMemberIds }
        })
          .session(session)
          .lean();
        if (existing.length > 0) {
          const err = new Error('Some selected members have already been covered by another response');
          err.code = 'MEMBER_ALREADY_COVERED';
          err.conflicts = existing.map((item) => item.memberId.toString());
          throw err;
        }

        const [response] = await SurveyResponse.create([responsePayload], { session });
        createdResponse = response;
        await SurveyResponseMember.insertMany(
          coverageDocs.map((doc) => ({ ...doc, responseId: response._id })),
          { session, ordered: true }
        );
      });
      return createdResponse;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    const message = String(error?.message || '');
    if (
      message.includes('Transaction numbers are only allowed') ||
      message.includes('replica set') ||
      error?.code === 20
    ) {
      return createWithoutTransaction();
    }
    if (error?.code === 11000 || Array.isArray(error?.writeErrors)) {
      const duplicate = new Error('Some selected members were submitted at the same time by another responder');
      duplicate.code = 'MEMBER_ALREADY_COVERED';
      throw duplicate;
    }
    throw error;
  }
}

// @route   POST /api/surveys/import-suggestion
// @desc    Build survey draft suggestion from a public form URL (Camp Admin only)
// @access  Private
router.post('/import-suggestion', authenticateToken, async (req, res) => {
  try {
    if (!ensureMongoFeature(res)) return;

    const { campId, url, saveDraft = true } = req.body || {};
    if (!campId) {
      return res.status(400).json({ message: 'campId is required' });
    }
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'A public form URL is required' });
    }

    const hasCampOwnerAccess = await isManagerCampAdmin(req, campId);
    if (!hasCampOwnerAccess) {
      return res.status(403).json({
        message: 'Only Camp Admins can create survey suggestions from public form links'
      });
    }

    const camp = await db.findCamp({ _id: campId });
    if (!camp) return res.status(404).json({ message: 'Camp not found' });

    const analysis = await analyzePublicFormUrl(url);

    const suggestionRecord = await SurveyImportSuggestion.create({
      campId,
      createdBy: req.user._id,
      sourceUrl: url,
      normalizedUrl: analysis.normalizedUrl || url,
      status: analysis.status,
      suggestion: analysis.suggestion || {
        title: '',
        description: '',
        blocks: [],
        warnings: [analysis.errorMessage || 'Unable to parse this URL'],
        unsupportedCount: 0,
        parserVersion: PARSER_VERSION
      },
      fetchMeta: analysis.fetchMeta || {},
      errorMessage: analysis.errorMessage || null
    });

    if (!analysis.ok) {
      return res.status(400).json({
        message:
          analysis.errorMessage ||
          'This link could not be accessed as a public form. You can continue by creating a survey manually.',
        suggestionId: suggestionRecord._id,
        canContinueManually: true
      });
    }

    let survey = null;
    let createdQuestions = [];

    if (saveDraft) {
      survey = await Survey.create({
        campId,
        title: analysis.suggestion.title || 'Imported Survey Draft',
        description: analysis.suggestion.description || '',
        status: 'draft',
        createdBy: req.user._id,
        isLocked: false,
        sourceImport: {
          sourceUrl: analysis.normalizedUrl,
          importSuggestionId: suggestionRecord._id,
          parserVersion: analysis.suggestion.parserVersion || PARSER_VERSION,
          importedAt: new Date()
        }
      });

      createdQuestions = await saveQuestionsForSurvey(
        survey._id,
        (analysis.suggestion.blocks || []).map((block, index) => ({
          ...block,
          order: index
        }))
      );

      suggestionRecord.surveyId = survey._id;
      await suggestionRecord.save();

      await recordActivity('CAMP', campId, req.user._id, 'SURVEY_IMPORT_SUGGESTION_CREATED', {
        sourceUrl: analysis.normalizedUrl,
        surveyId: survey._id,
        suggestionId: suggestionRecord._id,
        unsupportedCount: analysis.suggestion.unsupportedCount || 0
      });
    }

    return res.status(201).json({
      message: 'Survey suggestion generated successfully',
      suggestionId: suggestionRecord._id,
      survey: survey
        ? {
            ...survey.toObject(),
            questions: createdQuestions,
            importWarnings: analysis.suggestion.warnings || []
          }
        : null,
      suggestion: analysis.suggestion
    });
  } catch (error) {
    console.error('Survey import suggestion error:', error);
    res.status(500).json({ message: 'Server error generating import suggestion' });
  }
});

// @route   POST /api/surveys
// @desc    Create a manual survey draft
// @access  Private (Camp admins and leads)
router.post('/', authenticateToken, async (req, res) => {
  try {
    if (!ensureMongoFeature(res)) return;

    const {
      campId,
      title,
      description = '',
      questions = []
    } = req.body || {};
    if (!campId || !title) {
      return res.status(400).json({ message: 'campId and title are required' });
    }

    const hasPermission = await canManageCamp(req, campId);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    const camp = await db.findCamp({ _id: campId });
    if (!camp) return res.status(404).json({ message: 'Camp not found' });

    const survey = await Survey.create({
      campId,
      title: String(title).trim(),
      description: String(description || '').trim(),
      status: 'draft',
      createdBy: req.user._id,
      isLocked: false
    });

    const createdQuestions = await saveQuestionsForSurvey(survey._id, questions);
    await recordActivity('CAMP', campId, req.user._id, 'SURVEY_CREATED', {
      surveyId: survey._id,
      questionCount: createdQuestions.length
    });

    res.status(201).json({
      survey: survey.toObject(),
      questions: createdQuestions
    });
  } catch (error) {
    console.error('Create survey error:', error);
    res.status(500).json({ message: 'Server error creating survey' });
  }
});

// @route   GET /api/surveys/camp/:campId
// @desc    List surveys for a camp with completion stats
// @access  Private (Camp admins and leads)
router.get('/camp/:campId', authenticateToken, async (req, res) => {
  try {
    if (!ensureMongoFeature(res)) return;
    const { campId } = req.params;
    const hasPermission = await canManageCamp(req, campId);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    const [surveys, rosterData] = await Promise.all([
      Survey.find({ campId }).sort({ createdAt: -1 }).lean(),
      getActiveRosterMemberMap(campId)
    ]);

    const enriched = [];
    for (const survey of surveys) {
      // eslint-disable-next-line no-await-in-loop
      const stats = await buildCompletionStats({
        survey,
        memberIds: rosterData.memberIds,
        memberMap: rosterData.memberMap
      });
      enriched.push({
        ...survey,
        completionStats: stats
      });
    }

    res.json({ surveys: enriched });
  } catch (error) {
    console.error('List camp surveys error:', error);
    res.status(500).json({ message: 'Server error loading surveys' });
  }
});

// @route   GET /api/surveys/camp/:campId/roster-groups
// @desc    Response grouping summary for roster indicator UI
// @access  Private (Camp admins and leads)
router.get('/camp/:campId/roster-groups', authenticateToken, async (req, res) => {
  try {
    if (!ensureMongoFeature(res)) return;
    const { campId } = req.params;
    const hasPermission = await canManageCamp(req, campId);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    let targetSurveyId = req.query.surveyId ? String(req.query.surveyId) : null;
    if (!targetSurveyId) {
      const latest = await Survey.findOne({
        campId,
        status: { $in: ['sent', 'closed'] }
      })
        .sort({ sentAt: -1, createdAt: -1 })
        .select('_id title')
        .lean();
      if (!latest) {
        return res.json({ surveyId: null, groupsByPrimary: {}, memberToPrimary: {} });
      }
      targetSurveyId = latest._id.toString();
    }

    const [survey, responses] = await Promise.all([
      Survey.findOne({ _id: targetSurveyId, campId }).lean(),
      SurveyResponse.find({ surveyId: targetSurveyId }).lean()
    ]);

    if (!survey) {
      return res.status(404).json({ message: 'Survey not found for this camp' });
    }

    const allMemberIds = dedupeIdList(
      responses.flatMap((response) => [
        response.submittedByMemberId,
        ...(response.coveredMemberIds || [])
      ])
    );
    const memberDocs = await Member.find({ _id: { $in: allMemberIds } }).lean();
    const userIds = dedupeIdList(memberDocs.map((member) => member.user));
    const users = await User.find({ _id: { $in: userIds } }).select('firstName lastName').lean();
    const userById = new Map(users.map((user) => [user._id.toString(), user]));
    const memberById = new Map(memberDocs.map((member) => [member._id.toString(), member]));

    const groupsByPrimary = {};
    const memberToPrimary = {};
    for (const response of responses) {
      const primaryId = toIdString(response.submittedByMemberId);
      if (!primaryId) continue;
      const coveredIds = dedupeIdList(response.coveredMemberIds || []);
      const others = coveredIds.filter((memberId) => memberId !== primaryId);
      const otherNames = others.map((memberId) => getMemberDisplayName(memberById.get(memberId), userById));

      groupsByPrimary[primaryId] = {
        responseId: response._id.toString(),
        surveyId: survey._id.toString(),
        extraCount: others.length,
        otherMemberIds: others,
        otherNames
      };
      for (const coveredId of coveredIds) {
        memberToPrimary[coveredId] = primaryId;
      }
    }

    res.json({
      surveyId: survey._id,
      surveyTitle: survey.title,
      groupsByPrimary,
      memberToPrimary
    });
  } catch (error) {
    console.error('Roster groups summary error:', error);
    res.status(500).json({ message: 'Server error loading roster response groups' });
  }
});

// @route   GET /api/surveys/my-pending
// @desc    Get pending/completed surveys for the authenticated personal user
// @access  Private (Personal accounts)
router.get('/my-pending', authenticateToken, async (req, res) => {
  try {
    if (!ensureMongoFeature(res)) return;
    if (req.user.accountType !== 'personal') {
      return res.status(403).json({ message: 'Personal account required' });
    }

    const assignments = await SurveyAssignment.find({ userId: req.user._id }).lean();
    if (assignments.length === 0) {
      return res.json({ pendingSurveys: [], completedSurveys: [] });
    }

    const surveyIds = dedupeIdList(assignments.map((item) => item.surveyId));
    const surveys = await Survey.find({ _id: { $in: surveyIds } }).lean();
    const surveyById = new Map(surveys.map((survey) => [survey._id.toString(), survey]));

    const campIds = dedupeIdList(surveys.map((survey) => survey.campId));
    const [camps, myMembers] = await Promise.all([
      db.findCamps({ _id: { $in: campIds } }),
      Member.find({
        user: req.user._id,
        camp: { $in: campIds },
        status: { $in: ['active', 'approved'] }
      }).lean()
    ]);
    const campById = new Map((camps || []).map((camp) => [toIdString(camp._id), camp]));

    const myMemberIds = dedupeIdList(myMembers.map((member) => member._id));
    const coveredDocs = await SurveyResponseMember.find({
      surveyId: { $in: surveyIds },
      memberId: { $in: myMemberIds }
    }).lean();
    const coveredBySurveyId = new Map();
    coveredDocs.forEach((doc) => {
      coveredBySurveyId.set(toIdString(doc.surveyId), doc);
    });

    const responseIds = dedupeIdList(coveredDocs.map((doc) => doc.responseId));
    const responses = await SurveyResponse.find({ _id: { $in: responseIds } }).lean();
    const responseById = new Map(responses.map((response) => [toIdString(response._id), response]));

    const submitterMemberIds = dedupeIdList(responses.map((response) => response.submittedByMemberId));
    const submitterMembers = await Member.find({ _id: { $in: submitterMemberIds } }).lean();
    const submitterUsers = await User.find({
      _id: { $in: dedupeIdList(submitterMembers.map((member) => member.user)) }
    })
      .select('firstName lastName')
      .lean();
    const submitterUserById = new Map(submitterUsers.map((user) => [toIdString(user._id), user]));
    const submitterMemberById = new Map(submitterMembers.map((member) => [toIdString(member._id), member]));

    const pendingSurveys = [];
    const completedSurveys = [];
    for (const assignment of assignments) {
      const survey = surveyById.get(toIdString(assignment.surveyId));
      if (!survey) continue;
      const camp = campById.get(toIdString(survey.campId));
      const covered = coveredBySurveyId.get(toIdString(survey._id));

      const payload = {
        surveyId: survey._id,
        title: survey.title,
        description: survey.description || '',
        status: survey.status,
        campId: survey.campId,
        campName: camp?.name || camp?.campName || 'Camp',
        sentAt: survey.sentAt || null,
        assignedAt: assignment.assignedAt || assignment.createdAt || null
      };

      if (covered) {
        const response = responseById.get(toIdString(covered.responseId));
        const submitterMember = response ? submitterMemberById.get(toIdString(response.submittedByMemberId)) : null;
        const submitterUser = submitterMember ? submitterUserById.get(toIdString(submitterMember.user)) : null;
        const submitterName = submitterUser
          ? `${submitterUser.firstName || ''} ${submitterUser.lastName || ''}`.trim() || 'A camp member'
          : submitterMember?.name || 'A camp member';
        completedSurveys.push({
          ...payload,
          completedByCoverage: true,
          coveredByResponseId: covered.responseId,
          coveredBySubmitterName: submitterName
        });
      } else if (survey.status === 'sent') {
        pendingSurveys.push(payload);
      }
    }

    res.json({ pendingSurveys, completedSurveys });
  } catch (error) {
    console.error('Get my pending surveys error:', error);
    res.status(500).json({ message: 'Server error loading your surveys' });
  }
});

// @route   GET /api/surveys/:surveyId
// @desc    Get survey details and viewer context
// @access  Private
router.get('/:surveyId', authenticateToken, async (req, res) => {
  try {
    if (!ensureMongoFeature(res)) return;
    const { surveyId } = req.params;

    const [survey, questions] = await Promise.all([
      Survey.findById(surveyId).lean(),
      SurveyQuestion.find({ surveyId }).sort({ order: 1 }).lean()
    ]);
    if (!survey) return res.status(404).json({ message: 'Survey not found' });

    const [manager, assignmentExists, submitterMember] = await Promise.all([
      canManageCamp(req, survey.campId),
      SurveyAssignment.exists({ surveyId, userId: req.user._id }),
      resolveSubmitterMember(req, survey.campId)
    ]);

    const coveredDoc = submitterMember
      ? await SurveyResponseMember.findOne({ surveyId, memberId: submitterMember._id }).lean()
      : null;
    const coveredResponse = coveredDoc
      ? await SurveyResponse.findById(coveredDoc.responseId).lean()
      : null;
    let coveredBySubmitterName = null;
    let coveredBySelf = false;
    if (coveredResponse) {
      coveredBySelf = toIdString(coveredResponse.submittedByMemberId) === toIdString(submitterMember?._id);
      const coveredSubmitterMember = await Member.findById(coveredResponse.submittedByMemberId).lean();
      const coveredSubmitterUser = coveredSubmitterMember?.user
        ? await User.findById(coveredSubmitterMember.user).select('firstName lastName email').lean()
        : null;
      const userById = coveredSubmitterUser
        ? new Map([[toIdString(coveredSubmitterUser._id), coveredSubmitterUser]])
        : new Map();
      coveredBySubmitterName = getMemberDisplayName(coveredSubmitterMember, userById);
    }

    const canAccess = manager || assignmentExists || !!coveredDoc;
    if (!canAccess) {
      return res.status(403).json({ message: 'Access denied for this survey' });
    }

    const responsePayload = {
      survey,
      questions,
      viewer: {
        canManage: manager,
        canEditSurveyDefinition: manager,
        canEditSubmittedResponses: manager,
        isAssigned: !!assignmentExists,
        canRespond: !!submitterMember && survey.status === 'sent' && !coveredDoc,
        submitterMemberId: submitterMember?._id || null,
        isCovered: !!coveredDoc,
        coveredByResponseId: coveredDoc?.responseId || null,
        coveredBySubmitterName,
        coveredBySelf
      }
    };

    if (coveredResponse) {
      responsePayload.viewer.coveredResponse = coveredResponse;
    }

    if (manager) {
      const rosterData = await getActiveRosterMemberMap(survey.campId);
      responsePayload.completionStats = await buildCompletionStats({
        survey,
        memberIds: rosterData.memberIds,
        memberMap: rosterData.memberMap
      });
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Get survey detail error:', error);
    res.status(500).json({ message: 'Server error loading survey detail' });
  }
});

// @route   PUT /api/surveys/:surveyId
// @desc    Update survey content/questions
// @access  Private (Camp admins/leads)
router.put('/:surveyId', authenticateToken, async (req, res) => {
  try {
    if (!ensureMongoFeature(res)) return;
    const { surveyId } = req.params;
    const survey = await Survey.findById(surveyId);
    if (!survey) return res.status(404).json({ message: 'Survey not found' });

    const hasPermission = await canManageCamp(req, survey.campId);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    const { title, description, questions } = req.body || {};
    if (typeof title === 'string' && title.trim()) {
      survey.title = title.trim();
    }
    if (typeof description === 'string') {
      survey.description = description.trim();
    }
    await survey.save();

    let savedQuestions = null;
    if (Array.isArray(questions)) {
      savedQuestions = await saveQuestionsForSurvey(survey._id, questions);
    }

    await recordActivity('CAMP', survey.campId, req.user._id, 'SURVEY_UPDATED', {
      surveyId: survey._id,
      questionCount: Array.isArray(savedQuestions) ? savedQuestions.length : undefined
    });

    res.json({
      survey: survey.toObject(),
      questions: savedQuestions || (await SurveyQuestion.find({ surveyId }).sort({ order: 1 }).lean())
    });
  } catch (error) {
    console.error('Update survey draft error:', error);
    res.status(500).json({ message: 'Server error updating survey' });
  }
});

// @route   POST /api/surveys/:surveyId/send
// @desc    Send survey using shift-like targeting rules
// @access  Private (Camp admins/leads)
router.post('/:surveyId/send', authenticateToken, async (req, res) => {
  try {
    if (!ensureMongoFeature(res)) return;
    const { surveyId } = req.params;
    const survey = await Survey.findById(surveyId);
    if (!survey) return res.status(404).json({ message: 'Survey not found' });

    const hasPermission = await canManageCamp(req, survey.campId);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    if (survey.status !== 'draft' || survey.isLocked) {
      return res.status(400).json({
        message: 'Survey has already been sent or locked and cannot be modified'
      });
    }

    const questionCount = await SurveyQuestion.countDocuments({ surveyId });
    if (questionCount === 0) {
      return res.status(400).json({ message: 'Add at least one survey question before sending' });
    }

    const incomingMode = req.body?.assignmentMode || survey.targeting?.assignmentMode || 'ALL_ROSTER';
    const assignmentMode =
      incomingMode === 'LEADS_ONLY' || incomingMode === 'SELECTED_USERS' || incomingMode === 'ALL_ROSTER'
        ? incomingMode
        : 'ALL_ROSTER';
    const selectedUserIds = dedupeIdList(req.body?.selectedUserIds || survey.targeting?.selectedUserIds || []);
    const manualAddIds = dedupeIdList(req.body?.manualAddIds || []);
    const manualRemoveIds = dedupeIdList(req.body?.manualRemoveIds || []);

    const candidates = await resolveAssignmentCandidates({
      campId: survey.campId,
      mode: assignmentMode,
      selectedUserIds,
      manualAddIds,
      manualRemoveIds
    });

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        message: 'No eligible roster members matched the selected targeting mode'
      });
    }

    survey.status = 'sent';
    survey.isLocked = true;
    survey.lockReason = 'sent';
    survey.sentAt = new Date();
    survey.sentBy = req.user._id;
    survey.targeting = {
      assignmentMode,
      selectedUserIds,
      manualAddIds,
      manualRemoveIds,
      snapshotAssignmentUserIds: candidates
    };
    await survey.save();

    const assignmentDocs = candidates.map((userId) => ({
      surveyId: survey._id,
      campId: survey.campId,
      userId,
      assignedBy: req.user._id,
      assignedAt: new Date(),
      assignmentModeSnapshot: assignmentMode
    }));

    try {
      await SurveyAssignment.insertMany(assignmentDocs, { ordered: false });
    } catch (error) {
      if (error?.code !== 11000 && !Array.isArray(error?.writeErrors)) {
        throw error;
      }
    }

    const insertedAssignments = await SurveyAssignment.find({
      surveyId: survey._id,
      userId: { $in: candidates }
    })
      .select('userId')
      .lean();
    const insertedUserIds = dedupeIdList(insertedAssignments.map((item) => item.userId));

    await createBulkNotifications(insertedUserIds, {
      actor: req.user._id,
      campId: survey.campId,
      type: NOTIFICATION_TYPES.SURVEY_ASSIGNED,
      title: `New survey: ${survey.title}`,
      message: 'A camp survey is waiting for your response.',
      link: `/surveys/${survey._id}`,
      metadata: { surveyId: survey._id }
    });

    await recordActivity('CAMP', survey.campId, req.user._id, 'SURVEY_SENT', {
      surveyId: survey._id,
      assignmentMode,
      assignedCount: insertedUserIds.length
    });

    res.json({
      message: 'Survey sent successfully',
      surveyId: survey._id,
      assignedCount: insertedUserIds.length,
      assignmentMode
    });
  } catch (error) {
    console.error('Send survey error:', error);
    res.status(500).json({ message: 'Server error sending survey' });
  }
});

// @route   POST /api/surveys/:surveyId/close
// @desc    Close a sent survey (no further responses allowed)
// @access  Private (Camp admins/leads)
router.post('/:surveyId/close', authenticateToken, async (req, res) => {
  try {
    if (!ensureMongoFeature(res)) return;
    const survey = await Survey.findById(req.params.surveyId);
    if (!survey) return res.status(404).json({ message: 'Survey not found' });
    const hasPermission = await canManageCamp(req, survey.campId);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }
    if (survey.status === 'closed') {
      return res.status(400).json({ message: 'Survey is already closed' });
    }
    survey.status = 'closed';
    survey.closedAt = new Date();
    survey.isLocked = true;
    survey.lockReason = survey.lockReason || 'sent';
    await survey.save();

    await recordActivity('CAMP', survey.campId, req.user._id, 'SURVEY_CLOSED', {
      surveyId: survey._id
    });

    res.json({ message: 'Survey closed', survey });
  } catch (error) {
    console.error('Close survey error:', error);
    res.status(500).json({ message: 'Server error closing survey' });
  }
});

// @route   GET /api/surveys/:surveyId/responses
// @desc    List submitted responses for manager review/edit
// @access  Private (Camp admins/leads)
router.get('/:surveyId/responses', authenticateToken, async (req, res) => {
  try {
    if (!ensureMongoFeature(res)) return;
    const survey = await Survey.findById(req.params.surveyId).lean();
    if (!survey) return res.status(404).json({ message: 'Survey not found' });
    const hasPermission = await canManageCamp(req, survey.campId);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    const responses = await SurveyResponse.find({ surveyId: survey._id })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean();

    const memberIds = dedupeIdList(
      responses.flatMap((response) => [
        response.submittedByMemberId,
        ...(response.coveredMemberIds || [])
      ])
    );
    const memberDocs = await Member.find({ _id: { $in: memberIds } }).lean();
    const userDocs = await User.find({
      _id: { $in: dedupeIdList(memberDocs.map((member) => member.user)) }
    })
      .select('firstName lastName email')
      .lean();
    const userById = new Map(userDocs.map((user) => [toIdString(user._id), user]));
    const memberById = new Map(memberDocs.map((member) => [toIdString(member._id), member]));

    const payload = responses.map((response) => {
      const submitter = memberById.get(toIdString(response.submittedByMemberId));
      const coveredMembers = dedupeIdList(response.coveredMemberIds).map((memberId) => {
        const memberDoc = memberById.get(memberId);
        return {
          memberId,
          name: getMemberDisplayName(memberDoc, userById)
        };
      });
      return {
        ...response,
        submitterName: getMemberDisplayName(submitter, userById),
        coveredMembers
      };
    });

    res.json({ responses: payload });
  } catch (error) {
    console.error('List survey responses error:', error);
    res.status(500).json({ message: 'Server error loading survey responses' });
  }
});

// @route   GET /api/surveys/:surveyId/eligible-members
// @desc    Search roster members eligible for a group response
// @access  Private
router.get('/:surveyId/eligible-members', authenticateToken, async (req, res) => {
  try {
    if (!ensureMongoFeature(res)) return;
    const survey = await Survey.findById(req.params.surveyId).lean();
    if (!survey) return res.status(404).json({ message: 'Survey not found' });
    if (survey.status !== 'sent') {
      return res.status(400).json({ message: 'Survey is not currently accepting responses' });
    }

    const [permission, submitterMember] = await Promise.all([
      canUserRespondToSurvey(req, survey),
      resolveSubmitterMember(req, survey.campId)
    ]);
    if (!permission.allowed || !submitterMember) {
      return res.status(403).json({ message: 'You are not eligible to respond to this survey' });
    }

    const q = String(req.query.q || '').trim().toLowerCase();
    const [rosterData, coveredRows] = await Promise.all([
      getActiveRosterMemberMap(survey.campId),
      SurveyResponseMember.find({ surveyId: survey._id }).lean()
    ]);
    const coveredMemberIds = new Set(coveredRows.map((row) => toIdString(row.memberId)));
    const coveredResponseByMemberId = new Map(coveredRows.map((row) => [toIdString(row.memberId), row]));

    const allMembers = Array.from(rosterData.memberMap.values());
    const userIds = dedupeIdList(allMembers.map((member) => member?.user));
    const users = await User.find({ _id: { $in: userIds } }).select('firstName lastName email').lean();
    const userById = new Map(users.map((user) => [toIdString(user._id), user]));

    const eligibleMembers = [];
    for (const member of allMembers) {
      const memberId = toIdString(member?._id);
      if (!memberId) continue;
      const user = userById.get(toIdString(member.user));
      const name = user
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || member.name || 'Unknown'
        : member.name || member.playaName || 'Unknown';
      const email = user?.email || member.email || '';
      const searchable = `${name} ${email}`.toLowerCase();
      if (q && !searchable.includes(q)) continue;

      const alreadyCovered = coveredMemberIds.has(memberId);
      eligibleMembers.push({
        memberId,
        name,
        email,
        alreadyCovered,
        coveredByResponseId: alreadyCovered ? toIdString(coveredResponseByMemberId.get(memberId)?.responseId) : null,
        eligible: !alreadyCovered
      });
    }

    res.json({
      submitterMemberId: submitterMember._id,
      eligibleMembers
    });
  } catch (error) {
    console.error('Get eligible survey members error:', error);
    res.status(500).json({ message: 'Server error loading eligible members' });
  }
});

// @route   POST /api/surveys/:surveyId/responses
// @desc    Submit survey response for self + additional roster members
// @access  Private
router.post('/:surveyId/responses', authenticateToken, async (req, res) => {
  try {
    if (!ensureMongoFeature(res)) return;
    const survey = await Survey.findById(req.params.surveyId).lean();
    if (!survey) return res.status(404).json({ message: 'Survey not found' });
    if (survey.status !== 'sent') {
      return res.status(400).json({ message: 'This survey is closed for responses' });
    }

    const [permission, submitterMember] = await Promise.all([
      canUserRespondToSurvey(req, survey),
      resolveSubmitterMember(req, survey.campId)
    ]);
    if (!permission.allowed || !submitterMember) {
      return res.status(403).json({ message: 'You are not eligible to submit this survey' });
    }

    const surveyQuestions = await SurveyQuestion.find({ surveyId: survey._id }).select('_id blockType').lean();
    const questionById = new Map(surveyQuestions.map((question) => [toIdString(question._id), question]));
    const preliminaryAnswers = normalizeSurveyAnswers(req.body?.answers, questionById);
    const peopleMemberIds = extractPeopleMemberIdsFromAnswers(preliminaryAnswers, questionById);
    const selectedMemberIds = dedupeIdList(req.body?.coveredMemberIds || []);
    const coveredMemberIds = dedupeIdList([submitterMember._id, ...selectedMemberIds, ...peopleMemberIds]);
    if (coveredMemberIds.length === 0) {
      return res.status(400).json({ message: 'At least one roster member must be covered' });
    }
    if (coveredMemberIds.length > 100) {
      return res.status(400).json({ message: 'Response group exceeds the allowed limit' });
    }

    const { memberMap } = await getActiveRosterMemberMap(survey.campId);
    const invalidIds = coveredMemberIds.filter((memberId) => !memberMap.has(memberId));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        message: 'Some selected members are not on the active roster for this camp',
        invalidMemberIds: invalidIds
      });
    }

    const normalizedAnswers = normalizeSurveyAnswers(req.body?.answers, questionById, memberMap);

    const response = await writeResponseWithCoverage({
      survey,
      submitterMember,
      coveredMemberIds,
      answers: normalizedAnswers
    });

    await recordActivity('CAMP', survey.campId, req.user._id, 'SURVEY_RESPONSE_SUBMITTED', {
      surveyId: survey._id,
      responseId: response._id,
      coveredMemberCount: coveredMemberIds.length
    });

    const managerUsers = await SurveyAssignment.find({ surveyId: survey._id })
      .select('assignedBy')
      .lean();
    const managerUserIds = dedupeIdList(managerUsers.map((row) => row.assignedBy)).filter(
      (userId) => userId !== req.user._id.toString()
    );
    if (managerUserIds.length > 0) {
      await createBulkNotifications(managerUserIds, {
        actor: req.user._id,
        campId: survey.campId,
        type: NOTIFICATION_TYPES.SURVEY_SUBMITTED,
        title: `Survey submitted: ${survey.title}`,
        message: `A response was submitted covering ${coveredMemberIds.length} roster member(s).`,
        link: `/camp/${survey.campId}/surveys`,
        metadata: { surveyId: survey._id, responseId: response._id }
      });
    }

    return res.status(201).json({
      message: 'Survey response submitted successfully',
      responseId: response._id,
      coveredMemberIds
    });
  } catch (error) {
    console.error('Submit survey response error:', error);
    if (error?.code === 'MEMBER_ALREADY_COVERED') {
      return res.status(409).json({
        message: 'One or more selected members were already covered by another submitted response',
        conflictMemberIds: error.conflicts || []
      });
    }
    if (error?.code === 11000 || Array.isArray(error?.writeErrors)) {
      return res.status(409).json({
        message: 'A conflicting response was submitted at the same time. Please refresh and try again.'
      });
    }
    return res.status(500).json({ message: 'Server error submitting survey response' });
  }
});

// @route   PUT /api/surveys/:surveyId/responses/:responseId
// @desc    Edit submitted response answers (Camp admins/leads)
// @access  Private
router.put('/:surveyId/responses/:responseId', authenticateToken, async (req, res) => {
  try {
    if (!ensureMongoFeature(res)) return;
    const { surveyId, responseId } = req.params;
    const survey = await Survey.findById(surveyId).lean();
    if (!survey) return res.status(404).json({ message: 'Survey not found' });
    const hasPermission = await canManageCamp(req, survey.campId);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    const response = await SurveyResponse.findOne({ _id: responseId, surveyId });
    if (!response) {
      return res.status(404).json({ message: 'Response not found for this survey' });
    }

    const surveyQuestions = Array.isArray(req.body?.answers)
      ? await SurveyQuestion.find({ surveyId: survey._id }).select('_id blockType').lean()
      : [];
    const questionById = new Map(surveyQuestions.map((question) => [toIdString(question._id), question]));
    const rosterDataForAnswerEdit = Array.isArray(req.body?.answers)
      ? await getActiveRosterMemberMap(survey.campId)
      : null;
    const nextAnswers = Array.isArray(req.body?.answers)
      ? normalizeSurveyAnswers(req.body.answers, questionById, rosterDataForAnswerEdit?.memberMap || null)
      : null;
    const peopleMemberIdsFromNextAnswers = nextAnswers
      ? extractPeopleMemberIdsFromAnswers(nextAnswers, questionById)
      : [];

    const requestedCoveredMembers = Array.isArray(req.body?.coveredMemberIds)
      ? dedupeIdList(req.body.coveredMemberIds)
      : null;

    if (requestedCoveredMembers || peopleMemberIdsFromNextAnswers.length > 0) {
      const safeCoverage = dedupeIdList([
        response.submittedByMemberId,
        ...(requestedCoveredMembers || response.coveredMemberIds || []),
        ...peopleMemberIdsFromNextAnswers
      ]);
      const { memberMap } = rosterDataForAnswerEdit || (await getActiveRosterMemberMap(survey.campId));
      const invalidIds = safeCoverage.filter((memberId) => !memberMap.has(memberId));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          message: 'Some selected members are not on the active roster for this camp',
          invalidMemberIds: invalidIds
        });
      }

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const conflictingRows = await SurveyResponseMember.find({
            surveyId,
            memberId: { $in: safeCoverage },
            responseId: { $ne: response._id }
          })
            .session(session)
            .lean();

          if (conflictingRows.length > 0) {
            const err = new Error('One or more selected members are already covered by another response');
            err.code = 'MEMBER_ALREADY_COVERED';
            err.conflicts = conflictingRows.map((row) => toIdString(row.memberId));
            throw err;
          }

          await SurveyResponseMember.deleteMany({ responseId: response._id }).session(session);
          await SurveyResponseMember.insertMany(
            safeCoverage.map((memberId) => ({
              surveyId,
              campId: survey.campId,
              responseId: response._id,
              memberId,
              submitterMemberId: response.submittedByMemberId,
              submittedByUserId: response.submittedByUserId
            })),
            { session, ordered: true }
          );

          response.coveredMemberIds = safeCoverage;
          if (nextAnswers) response.answers = nextAnswers;
          response.lastEditedAt = new Date();
          response.editHistory = [
            ...(response.editHistory || []),
            {
              editedBy: req.user._id,
              editedAt: new Date(),
              reason: String(req.body?.editReason || 'Manager edit')
            }
          ];
          await response.save({ session });
        });
      } finally {
        await session.endSession();
      }
    } else if (nextAnswers) {
      response.answers = nextAnswers;
      response.lastEditedAt = new Date();
      response.editHistory = [
        ...(response.editHistory || []),
        {
          editedBy: req.user._id,
          editedAt: new Date(),
          reason: String(req.body?.editReason || 'Manager edit')
        }
      ];
      await response.save();
    }

    await recordActivity('CAMP', survey.campId, req.user._id, 'SURVEY_RESPONSE_EDITED', {
      surveyId: survey._id,
      responseId: response._id
    });

    res.json({
      message: 'Survey response updated successfully',
      response: response.toObject()
    });
  } catch (error) {
    console.error('Edit survey response error:', error);
    if (error?.code === 'MEMBER_ALREADY_COVERED') {
      return res.status(409).json({
        message: 'One or more selected members are already covered by another submitted response',
        conflictMemberIds: error.conflicts || []
      });
    }
    if (error?.code === 11000 || Array.isArray(error?.writeErrors)) {
      return res.status(409).json({
        message: 'A conflicting update happened at the same time. Please refresh and try again.'
      });
    }
    res.status(500).json({ message: 'Server error editing survey response' });
  }
});

module.exports = router;
