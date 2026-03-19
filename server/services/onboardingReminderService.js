const Camp = require('../models/Camp');
const Invite = require('../models/Invite');
const db = require('../database/databaseAdapter');
const { sendTemplate } = require('./emailService');
const { EMAIL_TEMPLATE_KEYS } = require('../constants/emailTemplateKeys');
const { recordActivity } = require('./activityLogger');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const INVITE_VALIDITY_EXTENSION_MS = 90 * DAY_MS;

const utcNow = () => new Date();

function buildInviteApplyLink(token) {
  const clientUrl = process.env.CLIENT_URL || 'https://www.g8road.com';
  return `${clientUrl}/apply?invite_token=${token}`;
}

async function ensureInviteTokenValid(inviteDoc) {
  let needsUpdate = false;
  const update = {};
  if (!inviteDoc.expiresAt || new Date(inviteDoc.expiresAt).getTime() <= Date.now()) {
    update.expiresAt = new Date(Date.now() + INVITE_VALIDITY_EXTENSION_MS);
    needsUpdate = true;
  }
  if (inviteDoc.status === 'expired') {
    update.status = 'sent';
    needsUpdate = true;
  }
  if (needsUpdate) {
    await Invite.updateOne({ _id: inviteDoc._id }, { $set: update });
  }
}

async function sendCampReminderBatch() {
  const now = utcNow();
  const reminderWindows = [
    {
      templateKey: EMAIL_TEMPLATE_KEYS.CAMP_REMINDER_24H,
      sentField: 'campReminder24hSentAt',
      threshold: new Date(now.getTime() - DAY_MS),
      elapsedLabel: '24 hours'
    },
    {
      templateKey: EMAIL_TEMPLATE_KEYS.CAMP_REMINDER_7D,
      sentField: 'campReminder7dSentAt',
      threshold: new Date(now.getTime() - 7 * DAY_MS),
      elapsedLabel: '7 days'
    }
  ];

  for (const rule of reminderWindows) {
    const camps = await Camp.find({
      [rule.sentField]: null,
      $or: [{ accountCreatedAt: { $lte: rule.threshold } }, { createdAt: { $lte: rule.threshold } }],
      $or: [{ rosterCreatedAt: null }, { invitesSentAt: null }]
    })
      .select('_id owner name campName accountCreatedAt createdAt')
      .lean();

    for (const camp of camps) {
      const owner = await db.findUser({ _id: camp.owner });
      if (!owner?.email) continue;

      const updated = await Camp.findOneAndUpdate(
        {
          _id: camp._id,
          [rule.sentField]: null,
          $or: [{ rosterCreatedAt: null }, { invitesSentAt: null }]
        },
        { $set: { [rule.sentField]: now } },
        { new: true }
      ).lean();

      if (!updated) continue;

      try {
        await sendTemplate(rule.templateKey, owner, {
          camp_name: camp.name || camp.campName || 'your camp',
          user_name: owner.firstName || owner.email,
          invite_link: `${process.env.CLIENT_URL || 'https://www.g8road.com'}/roster`,
          time_since_signup: rule.elapsedLabel
        });
      } catch (error) {
        // Roll back marker if send fails so next run retries.
        await Camp.updateOne({ _id: camp._id }, { $set: { [rule.sentField]: null } });
        console.error(`[ReminderJob] Camp ${rule.templateKey} send failed:`, error.message);
        continue;
      }

      await recordActivity('CAMP', camp._id, owner._id, 'COMMUNICATION_SENT', {
        field: 'emailReminder',
        templateKey: rule.templateKey,
        campName: camp.name || camp.campName || 'Camp'
      });
    }
  }
}

async function sendMemberReminderBatch() {
  const now = utcNow();
  const reminderWindows = [
    {
      templateKey: EMAIL_TEMPLATE_KEYS.MEMBER_REMINDER_24H,
      sentField: 'memberReminder24hSentAt',
      threshold: new Date(now.getTime() - DAY_MS),
      elapsedLabel: '24 hours'
    },
    {
      templateKey: EMAIL_TEMPLATE_KEYS.MEMBER_REMINDER_7D,
      sentField: 'memberReminder7dSentAt',
      threshold: new Date(now.getTime() - 7 * DAY_MS),
      elapsedLabel: '7 days'
    }
  ];

  for (const rule of reminderWindows) {
    const invites = await Invite.find({
      accountCreatedAt: { $ne: null, $lte: rule.threshold },
      applicationCompletedAt: null,
      [rule.sentField]: null
    })
      .select('_id campId token recipient invitedUserId accountCreatedAt expiresAt status')
      .lean();

    for (const invite of invites) {
      const camp = await db.findCamp({ _id: invite.campId });
      if (!camp) continue;

      let user = invite.invitedUserId ? await db.findUser({ _id: invite.invitedUserId }) : null;
      if (!user?.email) {
        user = await db.findUser({ email: (invite.recipient || '').toLowerCase() });
      }
      if (!user?.email) continue;

      await ensureInviteTokenValid(invite);
      const inviteLink = buildInviteApplyLink(invite.token);

      const updated = await Invite.findOneAndUpdate(
        {
          _id: invite._id,
          applicationCompletedAt: null,
          [rule.sentField]: null
        },
        { $set: { [rule.sentField]: now } },
        { new: true }
      ).lean();

      if (!updated) continue;

      try {
        await sendTemplate(rule.templateKey, user, {
          camp_name: camp.name || camp.campName || 'your camp',
          user_name: user.firstName || user.email,
          invite_link: inviteLink,
          time_since_signup: rule.elapsedLabel
        });
      } catch (error) {
        await Invite.updateOne({ _id: invite._id }, { $set: { [rule.sentField]: null } });
        console.error(`[ReminderJob] Member ${rule.templateKey} send failed:`, error.message);
        continue;
      }

      await recordActivity('MEMBER', user._id, user._id, 'COMMUNICATION_SENT', {
        field: 'emailReminder',
        templateKey: rule.templateKey,
        campName: camp.name || camp.campName || 'Camp'
      });
    }
  }
}

async function runOnboardingReminderPass() {
  await sendCampReminderBatch();
  await sendMemberReminderBatch();
}

module.exports = {
  runOnboardingReminderPass
};
