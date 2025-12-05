/**
 * Admin-only account deletion endpoints
 * Use with EXTREME CAUTION - permanently deletes data
 */

const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Camp = require('../models/Camp');
const MemberApplication = require('../models/MemberApplication');
const Roster = require('../models/Roster');
const ActivityLog = require('../models/ActivityLog');
const Invite = require('../models/Invite');
const Task = require('../models/Task');

const router = express.Router();

// @route   DELETE /api/admin-delete/account/:idOrEmail
// @desc    Permanently delete account and all associated data
// @access  Private (Admin only) - USE WITH EXTREME CAUTION
router.delete('/account/:idOrEmail', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { idOrEmail } = req.params;
    const { confirm } = req.body;
    
    // Require explicit confirmation
    if (confirm !== 'DELETE_PERMANENTLY') {
      return res.status(400).json({ 
        message: 'Confirmation required',
        requiredConfirmation: 'DELETE_PERMANENTLY',
        warning: 'This will permanently delete the account and ALL associated data'
      });
    }

    console.log(`🗑️  [Admin Delete] Starting deletion for: ${idOrEmail}`);
    console.log(`   Requested by admin: ${req.user.email} (${req.user._id})`);

    const deletionSummary = {
      users: 0,
      camps: 0,
      applications: 0,
      rosters: 0,
      rosterMembers: 0,
      activityLogs: 0,
      invites: 0,
      tasks: 0
    };

    // Find user(s)
    let user;
    try {
      user = await User.findById(idOrEmail);
    } catch (err) {
      // Not a valid ObjectId, try email
    }
    
    const usersByEmail = await User.find({ 
      email: { $regex: new RegExp(`^${idOrEmail}$`, 'i') } 
    });
    
    const allUserIds = new Set();
    if (user) allUserIds.add(user._id.toString());
    usersByEmail.forEach(u => allUserIds.add(u._id.toString()));
    
    if (allUserIds.size === 0) {
      return res.status(404).json({ message: 'No user found with that ID or email' });
    }

    const userIds = Array.from(allUserIds);
    const campIds = new Set();
    
    // Collect camp IDs
    for (const uid of userIds) {
      const u = await User.findById(uid);
      if (u && u.campId) {
        campIds.add(u.campId.toString());
      }
    }

    // Find camps by contactEmail or owner
    const campsByEmail = await Camp.find({ 
      contactEmail: { $regex: new RegExp(`^${idOrEmail}$`, 'i') } 
    });
    
    const campsByOwner = await Camp.find({ 
      owner: { $in: userIds } 
    });
    
    campsByEmail.forEach(c => campIds.add(c._id.toString()));
    campsByOwner.forEach(c => campIds.add(c._id.toString()));

    console.log(`   Found ${userIds.length} user(s) and ${campIds.size} camp(s)`);

    // Delete applications
    const applicationsResult = await MemberApplication.deleteMany({
      $or: [
        { applicant: { $in: userIds } },
        { camp: { $in: Array.from(campIds) } }
      ]
    });
    deletionSummary.applications = applicationsResult.deletedCount;

    // Clean up rosters
    const rosters = await Roster.find({ 
      camp: { $in: Array.from(campIds) } 
    });
    
    for (const roster of rosters) {
      const originalCount = roster.members.length;
      roster.members = roster.members.filter(m => 
        !userIds.includes(m.member?.toString()) && 
        !userIds.includes(m.user?.toString())
      );
      
      deletionSummary.rosterMembers += originalCount - roster.members.length;
      
      if (roster.members.length !== originalCount) {
        await roster.save();
      }
    }
    
    const rostersDeleted = await Roster.deleteMany({
      $or: [
        { camp: { $in: Array.from(campIds) } },
        { members: { $size: 0 } }
      ]
    });
    deletionSummary.rosters = rostersDeleted.deletedCount;

    // Delete invites
    const invitesResult = await Invite.deleteMany({
      $or: [
        { camp: { $in: Array.from(campIds) } },
        { invitedBy: { $in: userIds } },
        { appliedBy: { $in: userIds } }
      ]
    });
    deletionSummary.invites = invitesResult.deletedCount;

    // Delete tasks
    const tasksResult = await Task.deleteMany({
      $or: [
        { camp: { $in: Array.from(campIds) } },
        { createdBy: { $in: userIds } },
        { 'assignments.user': { $in: userIds } }
      ]
    });
    deletionSummary.tasks = tasksResult.deletedCount;

    // Delete activity logs
    const activityLogsResult = await ActivityLog.deleteMany({
      $or: [
        { entityType: 'MEMBER', entityId: { $in: userIds } },
        { entityType: 'CAMP', entityId: { $in: Array.from(campIds) } },
        { actingUserId: { $in: userIds } }
      ]
    });
    deletionSummary.activityLogs = activityLogsResult.deletedCount;

    // Delete camps
    if (campIds.size > 0) {
      const campsResult = await Camp.deleteMany({
        _id: { $in: Array.from(campIds) }
      });
      deletionSummary.camps = campsResult.deletedCount;
    }

    // Delete users
    const usersResult = await User.deleteMany({
      _id: { $in: userIds }
    });
    deletionSummary.users = usersResult.deletedCount;

    console.log(`✅ [Admin Delete] Deletion complete:`, deletionSummary);

    // Log this admin action
    await ActivityLog.create({
      entityType: 'SYSTEM',
      entityId: req.user._id,
      actingUserId: req.user._id,
      timestamp: new Date(),
      activityType: 'ADMIN_ACCOUNT_DELETION',
      details: {
        deletedIdentifier: idOrEmail,
        deletedUserIds: userIds,
        deletedCampIds: Array.from(campIds),
        summary: deletionSummary
      }
    });

    res.json({
      success: true,
      message: 'Account and all associated data permanently deleted',
      deletionSummary
    });

  } catch (error) {
    console.error('Admin deletion error:', error);
    res.status(500).json({ 
      message: 'Error during deletion', 
      error: error.message 
    });
  }
});

module.exports = router;

