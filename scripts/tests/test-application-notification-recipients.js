const assert = require('assert');
const { resolveApplicationNotificationRecipients } = require('../../server/services/notifications');

async function run() {
  const campId = 'camp-1';
  const applicant = { _id: 'applicant-1', email: 'applicant@example.com' };

  const baseCamp = {
    _id: campId,
    name: 'Dusty Camp',
    contactEmail: null,
    owner: { _id: 'owner-1', email: 'owner@example.com' }
  };

  // 1) Admin only
  {
    const recipients = await resolveApplicationNotificationRecipients(baseCamp, applicant, {
      getActiveRoster: async () => ({ members: [] })
    });
    assert.strictEqual(recipients.length, 1, 'Admin-only should produce exactly one recipient');
    assert.strictEqual(recipients[0].email, 'owner@example.com', 'Admin-only recipient should be owner');
  }

  // 2) Admin + 1 Camp Lead
  {
    const recipients = await resolveApplicationNotificationRecipients(baseCamp, applicant, {
      getActiveRoster: async () => ({
        members: [
          {
            isCampLead: true,
            status: 'approved',
            member: {
              user: { _id: 'lead-1', email: 'lead1@example.com', isActive: true, preferences: { notifications: { email: true } } }
            }
          }
        ]
      })
    });
    assert.strictEqual(recipients.length, 2, 'Admin + 1 lead should produce two recipients');
    assert.ok(recipients.some((r) => r.email === 'owner@example.com'), 'Owner missing from recipients');
    assert.ok(recipients.some((r) => r.email === 'lead1@example.com'), 'Camp Lead missing from recipients');
  }

  // 3) Multiple Camp Leads
  {
    const recipients = await resolveApplicationNotificationRecipients(baseCamp, applicant, {
      getActiveRoster: async () => ({
        members: [
          {
            isCampLead: true,
            status: 'approved',
            member: { user: { _id: 'lead-1', email: 'lead1@example.com', isActive: true, preferences: { notifications: { email: true } } } }
          },
          {
            isCampLead: true,
            status: 'approved',
            member: { user: { _id: 'lead-2', email: 'lead2@example.com', isActive: true, preferences: { notifications: { email: true } } } }
          }
        ]
      })
    });
    assert.strictEqual(recipients.length, 3, 'Admin + 2 leads should produce three recipients');
  }

  // 4) Admin also being Camp Lead (dedupe)
  {
    const recipients = await resolveApplicationNotificationRecipients(baseCamp, applicant, {
      getActiveRoster: async () => ({
        members: [
          {
            isCampLead: true,
            status: 'approved',
            member: { user: { _id: 'owner-1', email: 'owner@example.com', isActive: true, preferences: { notifications: { email: true } } } }
          }
        ]
      })
    });
    assert.strictEqual(recipients.length, 1, 'Owner duplicated as Camp Lead should only receive one notification');
    assert.strictEqual(recipients[0].email, 'owner@example.com');
  }

  console.log('✅ Application notification recipient tests passed');
}

run().catch((error) => {
  console.error('❌ Application notification recipient tests failed');
  console.error(error);
  process.exit(1);
});
