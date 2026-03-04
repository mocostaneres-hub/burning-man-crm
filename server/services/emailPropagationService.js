const db = require('../database/databaseAdapter');
const { normalizeEmail } = require('../utils/emailUtils');

function asStringId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value.toString) return value.toString();
  return String(value);
}

/**
 * Propagate a user's new email to denormalized/snapshot locations.
 * This keeps legacy payloads and admin views consistent while canonical auth email lives on User.email.
 */
async function propagateUserEmailChange({ userId, newEmail }) {
  const normalizedEmail = normalizeEmail(newEmail);
  const userIdStr = asStringId(userId);
  const result = {
    applicationsUpdated: 0,
    rostersUpdated: 0,
    campsUpdated: 0,
    errors: []
  };

  if (!userIdStr || !normalizedEmail) {
    return result;
  }

  // 1) Sync denormalized applicantDetails.email snapshots.
  try {
    const applications = await db.findMemberApplications({ applicant: userId });
    for (const app of applications || []) {
      try {
        const applicantDetails = app.applicantDetails || {};
        await db.updateMemberApplication(app._id, {
          applicantDetails: {
            ...applicantDetails,
            email: normalizedEmail
          }
        });
        result.applicationsUpdated += 1;
      } catch (appErr) {
        result.errors.push(`application:${asStringId(app._id)}:${appErr.message}`);
      }
    }
  } catch (err) {
    result.errors.push(`applications_query:${err.message}`);
  }

  // 2) Sync denormalized roster memberDetails.userDetails.email snapshots.
  try {
    const members = await db.findMembers({ user: userId });
    const memberIds = new Set((members || []).map((m) => asStringId(m._id)));
    if (memberIds.size > 0) {
      const rosters = await db.findRosters({});
      for (const roster of rosters || []) {
        let changed = false;
        const nextMembers = (roster.members || []).map((entry) => {
          const memberId = asStringId(entry?.member);
          if (!memberIds.has(memberId)) return entry;
          changed = true;
          return {
            ...entry,
            memberDetails: {
              ...(entry.memberDetails || {}),
              userDetails: {
                ...((entry.memberDetails && entry.memberDetails.userDetails) || {}),
                email: normalizedEmail
              }
            }
          };
        });
        if (changed) {
          try {
            await db.updateRoster(roster._id, { members: nextMembers });
            result.rostersUpdated += 1;
          } catch (rosterErr) {
            result.errors.push(`roster:${asStringId(roster._id)}:${rosterErr.message}`);
          }
        }
      }
    }
  } catch (err) {
    result.errors.push(`rosters_query:${err.message}`);
  }

  // 3) Sync deprecated camp contactEmail for owned camps (legacy fallback compatibility).
  try {
    const ownedCamps = await db.findCamps({ owner: userId });
    for (const camp of ownedCamps || []) {
      try {
        await db.updateCampById(camp._id, { contactEmail: normalizedEmail });
        result.campsUpdated += 1;
      } catch (campErr) {
        result.errors.push(`camp:${asStringId(camp._id)}:${campErr.message}`);
      }
    }
  } catch (err) {
    result.errors.push(`camps_query:${err.message}`);
  }

  return result;
}

module.exports = {
  propagateUserEmailChange
};
