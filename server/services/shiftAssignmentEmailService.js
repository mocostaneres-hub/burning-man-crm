const db = require('../database/databaseAdapter');
const { EMAIL_TEMPLATE_KEYS } = require('../constants/emailTemplateKeys');
const { sendTemplate } = require('./emailService');

const DISPLAY_TIME_ZONE = 'America/Los_Angeles';

const normalizeId = (value) => value?._id?.toString?.() || value?.toString?.() || '';

const formatShiftDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Date to be confirmed';
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: DISPLAY_TIME_ZONE
  });
};

const formatShiftTime = (startValue, endValue) => {
  const formatTime = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: DISPLAY_TIME_ZONE
    });
  };

  const start = formatTime(startValue);
  const end = formatTime(endValue);
  if (!start && !end) return 'Time to be confirmed';
  if (!start || !end) return `${start || end} PDT`;
  return `${start} – ${end} PDT`;
};

/**
 * Email only people who have just been added to a direct-assignment lock.
 * Delivery failures are reported but never roll back the saved assignment.
 */
const sendDirectAssignmentEmails = async ({ userIds = [], campId, event, shift }) => {
  const normalizedUserIds = [...new Set(userIds.map(normalizeId).filter(Boolean))];
  if (normalizedUserIds.length === 0) {
    return { attemptedCount: 0, sentCount: 0, failedCount: 0, skippedCount: 0 };
  }

  try {
    const [camp, users] = await Promise.all([
      db.findCamp({ _id: campId }),
      db.findUsers({ _id: { $in: normalizedUserIds } })
    ]);
    const usersById = new Map((users || []).map((user) => [normalizeId(user), user]));
    const recipients = normalizedUserIds
      .map((userId) => usersById.get(userId))
      .filter((user) => user?.email);
    const campName = camp?.name || camp?.campName || 'Your camp';
    const clientUrl = (process.env.CLIENT_URL || 'https://www.g8road.com').replace(/\/$/, '');
    const templateData = {
      camp_name: campName,
      event_name: event?.eventName || 'Volunteer Event',
      shift_title: shift?.title || 'Volunteer Shift',
      shift_date: formatShiftDate(shift?.date),
      shift_time: formatShiftTime(shift?.startTime, shift?.endTime),
      confirmation_link: `${clientUrl}/my-shifts`
    };

    const deliveryResults = await Promise.all(recipients.map(async (user) => {
      try {
        await sendTemplate(EMAIL_TEMPLATE_KEYS.SHIFT_DIRECT_ASSIGNMENT, user, templateData);
        return true;
      } catch (error) {
        console.error('Direct shift assignment email error for user', normalizeId(user), error);
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
    console.error('Direct shift assignment email preparation error:', error);
    return {
      attemptedCount: 0,
      sentCount: 0,
      failedCount: normalizedUserIds.length,
      skippedCount: 0
    };
  }
};

module.exports = {
  formatShiftDate,
  formatShiftTime,
  sendDirectAssignmentEmails
};
