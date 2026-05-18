/**
 * Roster member removal — status transitions and applicant notifications.
 *
 * Full-membership roster removals move the applicant to the undecided
 * application queue with a friendly message. Shifts-only removals keep the
 * legacy rejected/withdrawn-style handling.
 */

function resolveMemberUserId(member) {
  return member?.user?._id?.toString?.() || member?.user?.toString?.() || member?.user || null;
}

function isFullMembershipRoster(activeRoster) {
  const rosterType = activeRoster?.rosterType || 'full_membership';
  return rosterType === 'full_membership';
}

function currentYearApplicationDateFilter() {
  const year = new Date().getFullYear();
  return {
    createdAt: {
      $gte: new Date(year, 0, 1),
      $lt: new Date(year + 1, 0, 1)
    }
  };
}

/**
 * Apply post-removal member/application status updates and optional notifications.
 *
 * @returns {{ applicationStatus: string|null, memberStatus: string, notified: boolean }}
 */
async function applyRosterRemovalStatusUpdates({
  db,
  camp,
  member,
  relatedMemberDocs,
  activeRoster,
  reviewedBy,
  notifyApplicant = true,
  notifications = null
}) {
  const notify = notifications || require('./notifications');
  const fullMembership = isFullMembershipRoster(activeRoster);
  const memberStatus = fullMembership ? 'inactive' : 'rejected';
  const applicationStatus = fullMembership ? 'undecided' : 'rejected';
  const memberReviewNotes = fullMembership
    ? 'Removed from roster - moved to undecided queue'
    : 'Removed from roster - moved to rejected queue';
  const applicationReviewNotes = fullMembership
    ? 'Application moved to undecided queue after roster removal'
    : 'Application moved to rejected after roster removal';

  const docs = relatedMemberDocs?.length ? relatedMemberDocs : [member];
  const reviewedAt = new Date();

  for (const relatedMember of docs) {
    await db.updateMember(relatedMember._id, {
      status: memberStatus,
      reviewedAt,
      reviewedBy,
      reviewNotes: memberReviewNotes
    });
  }

  const memberUserId = resolveMemberUserId(member);
  let application = null;
  if (memberUserId) {
    application = await db.findMemberApplication({
      applicant: memberUserId,
      camp: camp._id,
      ...currentYearApplicationDateFilter()
    });
  }

  if (application) {
    await db.updateMemberApplication(application._id, {
      status: applicationStatus,
      reviewedAt,
      reviewedBy,
      reviewNotes: applicationReviewNotes,
      memberId: null
    });
  }

  let notified = false;
  if (notifyApplicant && fullMembership && memberUserId) {
    const applicant = await db.findUser({ _id: memberUserId });
    if (applicant?.email) {
      const memberName = applicant.firstName
        ? `${applicant.firstName}${applicant.lastName ? ` ${applicant.lastName}` : ''}`.trim()
        : 'there';
      await notify.sendRosterRemovalUndecidedNotification(applicant, camp, memberName);
      notified = true;
    }
  }

  return {
    applicationStatus: application ? applicationStatus : null,
    memberStatus,
    notified,
    queue: fullMembership ? 'undecided' : 'rejected'
  };
}

module.exports = {
  applyRosterRemovalStatusUpdates,
  isFullMembershipRoster,
  resolveMemberUserId,
  currentYearApplicationDateFilter
};
