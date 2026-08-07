const db = require('../database/databaseAdapter');
const { EMAIL_TEMPLATE_KEYS } = require('../constants/emailTemplateKeys');

const normalizeId = (value) => value?._id?.toString?.() || value?.toString?.() || '';

/**
 * Email only users whose SurveyAssignment record was newly created. Delivery
 * failures are reported but never roll back or hide the saved assignment.
 */
const sendSurveyAssignmentEmails = async ({ userIds = [], campId, survey }) => {
  const normalizedUserIds = [...new Set(userIds.map(normalizeId).filter(Boolean))];
  if (normalizedUserIds.length === 0) {
    return { attemptedCount: 0, sentCount: 0, failedCount: 0, skippedCount: 0 };
  }

  try {
    // Load lazily so survey reads and tests do not require email credentials.
    const { sendTemplate } = require('./emailService');
    const [camp, users] = await Promise.all([
      db.findCamp({ _id: campId }),
      db.findUsers({ _id: { $in: normalizedUserIds } })
    ]);
    const usersById = new Map((users || []).map((user) => [normalizeId(user), user]));
    const recipients = normalizedUserIds
      .map((userId) => usersById.get(userId))
      .filter((user) => user?.email);
    const clientUrl = (process.env.CLIENT_URL || 'https://www.g8road.com').replace(/\/$/, '');
    const templateData = {
      camp_name: camp?.name || camp?.campName || 'Your camp',
      survey_title: survey?.title || 'Camp Survey',
      survey_link: `${clientUrl}/surveys/${normalizeId(survey)}`
    };

    const deliveryResults = await Promise.all(recipients.map(async (user) => {
      try {
        await sendTemplate(EMAIL_TEMPLATE_KEYS.SURVEY_ASSIGNMENT, user, templateData);
        return true;
      } catch (error) {
        console.error('Survey assignment email error for user', normalizeId(user), error);
        return false;
      }
    }));
    const sentCount = deliveryResults.filter(Boolean).length;

    return {
      attemptedCount: recipients.length,
      sentCount,
      failedCount: recipients.length - sentCount,
      skippedCount: normalizedUserIds.length - recipients.length
    };
  } catch (error) {
    console.error('Survey assignment email preparation error:', error);
    return {
      attemptedCount: 0,
      sentCount: 0,
      failedCount: normalizedUserIds.length,
      skippedCount: 0
    };
  }
};

module.exports = {
  sendSurveyAssignmentEmails
};
