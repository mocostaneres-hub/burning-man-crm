const User = require('../models/User');
const Admin = require('../models/Admin');
const Camp = require('../models/Camp');
const Task = require('../models/Task');
const Event = require('../models/Event');
const Member = require('../models/Member');
const Roster = require('../models/Roster');
const MemberApplication = require('../models/MemberApplication');
const Invite = require('../models/Invite');
const ActivityLog = require('../models/ActivityLog');
const CallSlot = require('../models/CallSlot');
const ImpersonationToken = require('../models/ImpersonationToken');

async function permanentlyDeleteAccount(userId, adminId) {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, message: 'User not found' };
    if (adminId && userId.toString() === adminId.toString()) {
      return { success: false, message: 'You cannot permanently delete your own account' };
    }

    const deleted = {
      users: 0,
      admins: 0,
      camps: 0,
      members: 0,
      rosters: 0,
      rosterEntries: 0,
      applications: 0,
      invites: 0,
      events: 0,
      callSlots: 0,
      tasks: 0,
      activityLogs: 0,
      impersonationTokens: 0
    };

    const campIds = new Set();
    if (user.campId) campIds.add(user.campId.toString());
    const ownedCamps = await Camp.find({
      $or: [{ owner: userId }, { contactEmail: user.email }]
    }).select('_id');
    ownedCamps.forEach((camp) => campIds.add(camp._id.toString()));
    const campIdsArray = Array.from(campIds);

    // Collect member records linked to this user (used by roster.member references).
    const memberRecords = await Member.find({ user: userId }).select('_id');
    const memberIds = memberRecords.map((m) => m._id);

    // Remove user/member references from rosters first.
    const rosters = await Roster.find({
      $or: [
        { 'members.member': { $in: memberIds } },
        { 'members.addedBy': userId }
      ]
    });
    for (const roster of rosters) {
      const before = roster.members.length;
      roster.members = (roster.members || []).filter((entry) => {
        if (entry?.addedBy && entry.addedBy.toString() === userId.toString()) return false;
        if (!entry?.member) return true;
        return !memberIds.some((id) => id.toString() === entry.member.toString());
      });
      const removed = before - roster.members.length;
      if (removed > 0) {
        roster.markModified('members');
        await roster.save();
        deleted.rosterEntries += removed;
      }
    }

    // User-owned/associated records.
    const memberAppsDeleted = await MemberApplication.deleteMany({ applicant: userId });
    deleted.applications += memberAppsDeleted.deletedCount || 0;

    const membersDeleted = await Member.deleteMany({ user: userId });
    deleted.members += membersDeleted.deletedCount || 0;

    const invitesDeleted = await Invite.deleteMany({
      $or: [{ senderId: userId }, { appliedBy: userId }]
    });
    deleted.invites += invitesDeleted.deletedCount || 0;

    const eventByCreatorDeleted = await Event.deleteMany({ createdBy: userId });
    deleted.events += eventByCreatorDeleted.deletedCount || 0;

    const tasksByCreatorDeleted = await Task.deleteMany({ createdBy: userId });
    deleted.tasks += tasksByCreatorDeleted.deletedCount || 0;

    // Remove references from remaining records.
    await Task.updateMany(
      {},
      {
        $pull: {
          assignedTo: userId,
          watchers: userId,
          comments: { user: userId },
          history: { user: userId }
        }
      }
    );
    await Task.updateMany({ completedBy: userId }, { $unset: { completedBy: '' } });
    await CallSlot.updateMany({}, { $pull: { participants: userId } });

    // Camp-scoped hard delete when this user owns/is bound to camp account(s).
    if (campIdsArray.length > 0) {
      const campMembersDeleted = await Member.deleteMany({ camp: { $in: campIdsArray } });
      deleted.members += campMembersDeleted.deletedCount || 0;

      const campRostersDeleted = await Roster.deleteMany({ camp: { $in: campIdsArray } });
      deleted.rosters += campRostersDeleted.deletedCount || 0;

      const campApplicationsDeleted = await MemberApplication.deleteMany({ camp: { $in: campIdsArray } });
      deleted.applications += campApplicationsDeleted.deletedCount || 0;

      const campInvitesDeleted = await Invite.deleteMany({ campId: { $in: campIdsArray } });
      deleted.invites += campInvitesDeleted.deletedCount || 0;

      const campEventsDeleted = await Event.deleteMany({ campId: { $in: campIdsArray } });
      deleted.events += campEventsDeleted.deletedCount || 0;

      const campCallSlotsDeleted = await CallSlot.deleteMany({ campId: { $in: campIdsArray } });
      deleted.callSlots += campCallSlotsDeleted.deletedCount || 0;

      const campTasksDeleted = await Task.deleteMany({ campId: { $in: campIdsArray } });
      deleted.tasks += campTasksDeleted.deletedCount || 0;

      const campsDeleted = await Camp.deleteMany({ _id: { $in: campIdsArray } });
      deleted.camps += campsDeleted.deletedCount || 0;
    }

    const adminDeleted = await Admin.deleteMany({
      $or: [{ user: userId }, { createdBy: userId }]
    });
    deleted.admins += adminDeleted.deletedCount || 0;

    const activityDeleted = await ActivityLog.deleteMany({
      $or: [
        { actingUserId: userId },
        { entityType: 'MEMBER', entityId: userId },
        ...(campIdsArray.length > 0 ? [{ entityType: 'CAMP', entityId: { $in: campIdsArray } }] : [])
      ]
    });
    deleted.activityLogs += activityDeleted.deletedCount || 0;

    const impersonationDeleted = await ImpersonationToken.deleteMany({
      $or: [{ adminId: userId }, { targetUserId: userId }]
    });
    deleted.impersonationTokens += impersonationDeleted.deletedCount || 0;

    const userDeleted = await User.deleteOne({ _id: userId });
    deleted.users += userDeleted.deletedCount || 0;

    if (deleted.users === 0) {
      return { success: false, message: 'User deletion failed' };
    }

    return {
      success: true,
      message: 'Account permanently deleted and all direct references were removed.',
      email: user.email,
      deletedEntities: deleted
    };
  } catch (error) {
    console.error('❌ [Permanent Deletion] Error:', error);
    return { success: false, message: `Error deleting account: ${error.message}` };
  }
}

async function permanentlyDeleteCampAccount(userId, adminId) {
  return permanentlyDeleteAccount(userId, adminId);
}

async function permanentlyDeleteMemberAccount(userId, adminId) {
  return permanentlyDeleteAccount(userId, adminId);
}

module.exports = {
  permanentlyDeleteAccount,
  permanentlyDeleteCampAccount,
  permanentlyDeleteMemberAccount
};

