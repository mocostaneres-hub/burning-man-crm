/**
 * Permanent Deletion Service
 * 
 * Handles irreversible deletion of CAMP and MEMBER accounts with specific data-handling rules.
 * 
 * CAMP ACCOUNT DELETION:
 * - Deletes the user account only
 * - Preserves all camp-related entities (roster, applications, profile, events, shifts, tasks)
 * - Entities remain accessible to other camp admins
 * 
 * MEMBER ACCOUNT DELETION:
 * - Deletes the user account
 * - Transfers task ownership to associated camp
 * - Replaces member name with "Unknown User" in tasks
 * - Tasks appear under camp's task list
 */

const User = require('../models/User');
const Camp = require('../models/Camp');
const Task = require('../models/Task');
const Event = require('../models/Event');
const Member = require('../models/Member');
const Roster = require('../models/Roster');
const MemberApplication = require('../models/MemberApplication');
const { recordActivity } = require('./activityLogger');

/**
 * Permanently delete a CAMP account
 * @param {string} userId - ID of the camp user account to delete
 * @param {string} adminId - ID of the admin performing the deletion
 * @returns {Promise<{success: boolean, message: string, campId?: string}>}
 */
async function permanentlyDeleteCampAccount(userId, adminId) {
  try {
    console.log(`🗑️  [Permanent Deletion] Starting CAMP account deletion for user: ${userId}`);
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Verify this is a camp account
    if (user.accountType !== 'camp') {
      return { success: false, message: 'This deletion method is only for camp accounts' };
    }

    // Find associated camp (if any)
    const camp = await Camp.findOne({ owner: userId });
    const campId = user.campId || camp?._id;

    // Log the deletion activity for the camp (before deletion)
    if (campId) {
      await recordActivity('CAMP', campId, adminId, 'ACCOUNT_DELETED', {
        field: 'userAccount',
        deletedUserId: userId,
        deletedEmail: user.email,
        deletionType: 'permanent',
        note: 'Camp user account permanently deleted. Camp entities preserved.'
      });
    }

    // IMPORTANT: Do NOT delete camp-related entities
    // - Camp profile, roster, applications, events, shifts, tasks all remain
    // - These are preserved for other camp admins to access
    console.log(`ℹ️  [Permanent Deletion] Preserving all camp entities for camp: ${campId}`);

    // Delete the user account
    await User.findByIdAndDelete(userId);
    
    console.log(`✅ [Permanent Deletion] CAMP user account deleted: ${user.email}`);
    console.log(`✅ [Permanent Deletion] All camp entities preserved for camp: ${campId}`);

    return {
      success: true,
      message: 'Camp account permanently deleted. All camp entities preserved.',
      campId: campId?.toString(),
      email: user.email
    };
  } catch (error) {
    console.error(`❌ [Permanent Deletion] Error deleting CAMP account:`, error);
    return {
      success: false,
      message: `Error deleting camp account: ${error.message}`
    };
  }
}

/**
 * Permanently delete a MEMBER account
 * @param {string} userId - ID of the member user account to delete
 * @param {string} adminId - ID of the admin performing the deletion
 * @returns {Promise<{success: boolean, message: string, tasksTransferred?: number}>}
 */
async function permanentlyDeleteMemberAccount(userId, adminId) {
  try {
    console.log(`🗑️  [Permanent Deletion] Starting MEMBER account deletion for user: ${userId}`);
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Verify this is a personal/member account
    if (user.accountType !== 'personal') {
      return { success: false, message: 'This deletion method is only for personal/member accounts' };
    }

    const memberName = `${user.firstName} ${user.lastName}`;
    const memberEmail = user.email;

    // Find all tasks associated with this member
    const tasksQuery = {
      $or: [
        { assignedTo: userId },      // Tasks assigned to member
        { createdBy: userId },        // Tasks created by member
        { watchers: userId }          // Tasks member is watching
      ]
    };

    const memberTasks = await Task.find(tasksQuery);
    console.log(`📋 [Permanent Deletion] Found ${memberTasks.length} tasks associated with member`);

    let tasksTransferred = 0;

    // Process each task
    for (const task of memberTasks) {
      try {
        // Get the associated camp
        const camp = await Camp.findById(task.camp);
        
        if (!camp) {
          console.warn(`⚠️  [Permanent Deletion] Task ${task._id} has no associated camp, skipping`);
          continue;
        }

        // Transfer ownership to camp if member was the owner
        if (task.createdBy && task.createdBy.toString() === userId) {
          task.createdBy = camp.owner || null;
          console.log(`  ↪️  Transferred ownership of task "${task.title}" to camp ${camp.name}`);
        }

        // Remove member from assignedTo
        if (task.assignedTo && task.assignedTo.toString() === userId) {
          task.assignedTo = null;
          task.assignedToName = 'Unknown User'; // Replace with "Unknown User"
          console.log(`  ↪️  Updated assigned user to "Unknown User" for task "${task.title}"`);
        }

        // Remove member from watchers array
        if (task.watchers && task.watchers.length > 0) {
          const watcherIndex = task.watchers.findIndex(w => w.toString() === userId);
          if (watcherIndex !== -1) {
            task.watchers.splice(watcherIndex, 1);
            console.log(`  ↪️  Removed member from watchers for task "${task.title}"`);
          }
        }

        // Save the updated task
        await task.save();
        tasksTransferred++;

        // Log the task transfer activity
        await recordActivity('TASK', task._id, adminId, 'OWNERSHIP_TRANSFERRED', {
          field: 'ownership',
          from: memberName,
          to: camp.name,
          reason: 'Member account permanently deleted',
          deletedUserId: userId
        });

      } catch (taskError) {
        console.error(`❌ [Permanent Deletion] Error processing task ${task._id}:`, taskError);
        // Continue with other tasks
      }
    }

    // Find all rosters containing this member
    const rosters = await Roster.find({ 'members.user': userId });
    for (const roster of rosters) {
      // Update member entries to show "Unknown User"
      roster.members.forEach(member => {
        if (member.user && member.user.toString() === userId) {
          member.firstName = 'Unknown';
          member.lastName = 'User';
          member.email = 'deleted@example.com';
          // Keep other roster data (dues status, travel plans, etc.)
        }
      });
      await roster.save();
      console.log(`  ↪️  Updated roster ${roster._id} to show "Unknown User"`);
    }

    // Update member applications to show "Unknown User"
    const applications = await MemberApplication.find({ applicant: userId });
    for (const application of applications) {
      // Keep the application but update applicant reference
      application.applicantDeleted = true;
      application.applicantName = 'Unknown User';
      application.applicantEmail = 'deleted@example.com';
      await application.save();
      console.log(`  ↪️  Updated application ${application._id} to show "Unknown User"`);
    }

    // Find and update Member records
    const memberRecords = await Member.find({ user: userId });
    for (const memberRecord of memberRecords) {
      memberRecord.firstName = 'Unknown';
      memberRecord.lastName = 'User';
      memberRecord.email = 'deleted@example.com';
      memberRecord.deletedAt = new Date();
      await memberRecord.save();
      console.log(`  ↪️  Updated Member record ${memberRecord._id} to show "Unknown User"`);
    }

    // Log the deletion activity for the member (before deletion)
    await recordActivity('MEMBER', userId, adminId, 'ACCOUNT_DELETED', {
      field: 'userAccount',
      deletedEmail: memberEmail,
      deletedName: memberName,
      deletionType: 'permanent',
      tasksTransferred: tasksTransferred,
      note: 'Member account permanently deleted. Tasks transferred to camps. Name replaced with "Unknown User".'
    });

    // Delete the user account
    await User.findByIdAndDelete(userId);
    
    console.log(`✅ [Permanent Deletion] MEMBER user account deleted: ${memberEmail}`);
    console.log(`✅ [Permanent Deletion] ${tasksTransferred} tasks transferred/updated`);

    return {
      success: true,
      message: 'Member account permanently deleted. Tasks transferred to camps.',
      email: memberEmail,
      tasksTransferred
    };
  } catch (error) {
    console.error(`❌ [Permanent Deletion] Error deleting MEMBER account:`, error);
    return {
      success: false,
      message: `Error deleting member account: ${error.message}`
    };
  }
}

/**
 * Permanently delete a user account (routes to appropriate handler)
 * @param {string} userId - ID of the user account to delete
 * @param {string} adminId - ID of the admin performing the deletion
 * @returns {Promise<{success: boolean, message: string, details?: object}>}
 */
async function permanentlyDeleteAccount(userId, adminId) {
  try {
    // Find the user to determine account type
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    console.log(`🗑️  [Permanent Deletion] Account type: ${user.accountType}, Email: ${user.email}`);

    // Route to appropriate deletion handler
    if (user.accountType === 'camp') {
      return await permanentlyDeleteCampAccount(userId, adminId);
    } else if (user.accountType === 'personal') {
      return await permanentlyDeleteMemberAccount(userId, adminId);
    } else {
      return {
        success: false,
        message: `Account type '${user.accountType}' is not supported for permanent deletion`
      };
    }
  } catch (error) {
    console.error(`❌ [Permanent Deletion] Error in permanentlyDeleteAccount:`, error);
    return {
      success: false,
      message: `Error deleting account: ${error.message}`
    };
  }
}

module.exports = {
  permanentlyDeleteAccount,
  permanentlyDeleteCampAccount,
  permanentlyDeleteMemberAccount
};

