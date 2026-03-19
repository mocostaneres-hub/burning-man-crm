const EmailTemplate = require('../models/EmailTemplate');
const { EMAIL_TEMPLATE_KEYS } = require('../constants/emailTemplateKeys');

const DEFAULT_TEMPLATE_VARIABLES = ['camp_name', 'user_name', 'invite_link', 'time_since_signup'];

const DEFAULT_TEMPLATE_DATA = {
  [EMAIL_TEMPLATE_KEYS.CAMP_REMINDER_24H]: {
    key: EMAIL_TEMPLATE_KEYS.CAMP_REMINDER_24H,
    name: 'Camp Onboarding Reminder (24h)',
    description: 'Sent 24 hours after camp signup if roster or invites are still incomplete.',
    subject: 'Finish onboarding for {{camp_name}}',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2>Hi {{user_name}},</h2>
        <p>Your camp account for <strong>{{camp_name}}</strong> is live, and <strong>{{camp_name}}</strong> is one quick step away from receiving applications.</p>
        <p>Please create your roster and send invites so people can apply to <strong>{{camp_name}}</strong>.</p>
        <p style="margin: 20px 0;">
          <a href="{{invite_link}}" style="background: #FF6B35; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 6px; display: inline-block; font-weight: bold;">
            Finish Camp Setup
          </a>
        </p>
        <p>It only takes seconds to complete onboarding for {{camp_name}}.</p>
      </div>
    `,
    textContent:
      'Hi {{user_name}}, your camp account for {{camp_name}} is live. Please create your roster and send invites so people can apply to {{camp_name}}. Finish setup: {{invite_link}}',
    variables: DEFAULT_TEMPLATE_VARIABLES
  },
  [EMAIL_TEMPLATE_KEYS.CAMP_REMINDER_7D]: {
    key: EMAIL_TEMPLATE_KEYS.CAMP_REMINDER_7D,
    name: 'Camp Onboarding Reminder (7d)',
    description: 'Sent 7 days after camp signup if roster or invites are still incomplete.',
    subject: '{{camp_name}} still needs setup to receive members',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2>Hi {{user_name}},</h2>
        <p>It has been {{time_since_signup}} since you created {{camp_name}}, and {{camp_name}} still needs onboarding completion.</p>
        <p>To start receiving applications for <strong>{{camp_name}}</strong>, create your roster and send your first invites.</p>
        <p style="margin: 20px 0;">
          <a href="{{invite_link}}" style="background: #FF6B35; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 6px; display: inline-block; font-weight: bold;">
            Complete {{camp_name}} Onboarding
          </a>
        </p>
      </div>
    `,
    textContent:
      'Hi {{user_name}}, it has been {{time_since_signup}} since you created {{camp_name}}. Create your roster and send invites to complete onboarding: {{invite_link}}',
    variables: DEFAULT_TEMPLATE_VARIABLES
  },
  [EMAIL_TEMPLATE_KEYS.MEMBER_REMINDER_24H]: {
    key: EMAIL_TEMPLATE_KEYS.MEMBER_REMINDER_24H,
    name: 'Member Application Reminder (24h)',
    description: 'Sent 24 hours after invited member signup if camp application is incomplete.',
    subject: 'Finish your {{camp_name}} application',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2>Hi {{user_name}},</h2>
        <p>You already created your account and you are invited to join <strong>{{camp_name}}</strong>.</p>
        <p>Finishing your application for <strong>{{camp_name}}</strong> takes seconds.</p>
        <p style="margin: 20px 0;">
          <a href="{{invite_link}}" style="background: #FF6B35; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 6px; display: inline-block; font-weight: bold;">
            Complete Application for {{camp_name}}
          </a>
        </p>
        <p>Click the button above to continue your {{camp_name}} application now.</p>
      </div>
    `,
    textContent:
      'Hi {{user_name}}, you already created your account and are invited to {{camp_name}}. Finishing your application takes seconds: {{invite_link}}',
    variables: DEFAULT_TEMPLATE_VARIABLES
  },
  [EMAIL_TEMPLATE_KEYS.MEMBER_REMINDER_7D]: {
    key: EMAIL_TEMPLATE_KEYS.MEMBER_REMINDER_7D,
    name: 'Member Application Reminder (7d)',
    description: 'Sent 7 days after invited member signup if camp application is incomplete.',
    subject: 'Last reminder to finish your {{camp_name}} application',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
        <h2>Hi {{user_name}},</h2>
        <p>It has been {{time_since_signup}} since account signup, and your {{camp_name}} application is still incomplete.</p>
        <p>You are already invited to <strong>{{camp_name}}</strong>. It only takes seconds to finish and submit.</p>
        <p style="margin: 20px 0;">
          <a href="{{invite_link}}" style="background: #FF6B35; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 6px; display: inline-block; font-weight: bold;">
            Finish {{camp_name}} Application
          </a>
        </p>
      </div>
    `,
    textContent:
      'Hi {{user_name}}, it has been {{time_since_signup}} and your {{camp_name}} application is incomplete. Finish now: {{invite_link}}',
    variables: DEFAULT_TEMPLATE_VARIABLES
  }
};

const FALLBACK_VARIABLES = {
  camp_name: 'your camp',
  user_name: 'there',
  invite_link: `${process.env.CLIENT_URL || 'https://www.g8road.com'}/dashboard`,
  time_since_signup: 'recently'
};

const renderTemplateString = (input, data = {}) => {
  if (!input) return '';
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, variable) => {
    const value = data[variable];
    if (value !== undefined && value !== null && String(value).length > 0) {
      return String(value);
    }
    if (FALLBACK_VARIABLES[variable] !== undefined) {
      return String(FALLBACK_VARIABLES[variable]);
    }
    return '';
  });
};

async function ensureDefaultTemplates() {
  const keys = Object.keys(DEFAULT_TEMPLATE_DATA);
  for (const key of keys) {
    const defaults = DEFAULT_TEMPLATE_DATA[key];
    await EmailTemplate.updateOne(
      { key },
      { $setOnInsert: defaults },
      { upsert: true }
    );
  }
}

async function getTemplateByKey(key) {
  const template = await EmailTemplate.findOne({ key, isActive: true }).lean();
  if (template) return template;
  return DEFAULT_TEMPLATE_DATA[key] || null;
}

module.exports = {
  DEFAULT_TEMPLATE_DATA,
  ensureDefaultTemplates,
  getTemplateByKey,
  renderTemplateString
};
