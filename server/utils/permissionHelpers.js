/**
 * Permission Helper Functions
 * Standardizes permission checks across all routes
 * RULE: Always use campId (immutable) for camp lookups, never email or name
 */

const db = require('../database/databaseAdapter');

/**
 * Get the camp ID for the authenticated user
 * For camp/admin accounts: Uses req.user.campId (immutable identifier)
 * Falls back to email lookup only if campId is not available in JWT
 * 
 * @param {Object} req - Express request object with req.user
 * @returns {Promise<string|null>} - Camp ID or null
 */
async function getUserCampId(req) {
  // Primary: Use campId from JWT (immutable)
  if (req.user.campId) {
    console.log('✅ [Permission] Using campId from JWT:', req.user.campId);
    return req.user.campId.toString();
  }

  // Fallback: Look up by email (only for backwards compatibility)
  if ((req.user.accountType === 'camp' || req.user.accountType === 'admin') && req.user.email) {
    console.log('⚠️ [Permission] campId not in JWT, falling back to email lookup');
    const camp = await db.findCamp({ contactEmail: req.user.email });
    if (camp) {
      console.log('✅ [Permission] Found camp by email:', camp._id);
      return camp._id.toString();
    }
  }

  console.log('❌ [Permission] Could not determine camp ID');
  return null;
}

/**
 * Check if user has permission to access a specific camp
 * RULE: Camp accounts and admin accounts with campId have FULL power over their own camp
 * 
 * @param {Object} req - Express request object with req.user
 * @param {string} targetCampId - The camp ID being accessed
 * @returns {Promise<boolean>} - true if user has access
 */
async function canAccessCamp(req, targetCampId) {
  // Camp accounts and admin accounts (with campId) can access camps
  if (req.user.accountType !== 'camp' && req.user.accountType !== 'admin') {
    console.log('❌ [Permission] Not a camp or admin account, got:', req.user.accountType);
    return false;
  }

  const userCampId = await getUserCampId(req);
  if (!userCampId) {
    console.log('❌ [Permission] Could not determine user camp ID');
    return false;
  }

  const hasAccess = userCampId.toString() === targetCampId.toString();
  console.log(`${hasAccess ? '✅' : '❌'} [Permission] Camp access check:`, {
    userAccountType: req.user.accountType,
    userCampId: userCampId.toString(),
    targetCampId: targetCampId.toString(),
    hasAccess
  });

  return hasAccess;
}

/**
 * Middleware to ensure user is a camp account
 * Responds with 403 if not a camp account
 */
function requireCampAccount(req, res, next) {
  if (req.user.accountType !== 'camp') {
    console.log('❌ [Permission] Camp account required, got:', req.user.accountType);
    return res.status(403).json({ message: 'Camp account required' });
  }
  next();
}

/**
 * Middleware to ensure user owns the camp specified in params
 * Checks req.params.campId against user's camp
 */
async function requireCampOwnership(req, res, next) {
  try {
    const targetCampId = req.params.campId || req.body.campId;
    if (!targetCampId) {
      return res.status(400).json({ message: 'Camp ID required' });
    }

    const hasAccess = await canAccessCamp(req, targetCampId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied - you can only manage your own camp' });
    }

    next();
  } catch (error) {
    console.error('❌ [Permission] Error checking camp ownership:', error);
    res.status(500).json({ message: 'Server error checking permissions' });
  }
}

/**
 * Check if a personal account user is an active member of a camp's roster
 * RULE: Personal accounts must be on the active roster to access camp resources
 * 
 * @param {Object} req - Express request object with req.user
 * @param {string} targetCampId - The camp ID being accessed
 * @returns {Promise<boolean>} - true if user is an active roster member
 */
async function isActiveRosterMember(req, targetCampId) {
  // Only applies to personal accounts
  if (req.user.accountType !== 'personal') {
    return false;
  }

  try {
    const currentUserId = req.user._id.toString();
    console.log('🔍 [Permission] Checking roster membership for user:', currentUserId);
    
    // CRITICAL: Find all Member records for this user
    const Member = require('../models/Member');
    const members = await Member.find({ user: currentUserId });
    
    if (!members || members.length === 0) {
      console.log('❌ [Permission] No member records found for user');
      return false;
    }
    
    console.log('🔍 [Permission] Found member records:', members.map(m => m._id));
    
    // Get the active roster for the camp
    const activeRoster = await db.findActiveRoster({ camp: targetCampId });
    
    if (!activeRoster || !activeRoster.members || activeRoster.members.length === 0) {
      console.log('❌ [Permission] No active roster found for camp:', targetCampId);
      return false;
    }

    console.log('🔍 [Permission] Roster has', activeRoster.members.length, 'members');

    // Check if member is in the active roster using Member ID
    const memberIds = new Set(members.map(m => m._id.toString()));
    const isMember = activeRoster.members.some(rosterEntry => {
      if (!rosterEntry.member) return false;
      
      // rosterEntry.member could be:
      // 1. Populated Member object with _id
      // 2. Member ObjectId string
      const memberId = typeof rosterEntry.member === 'object' && rosterEntry.member._id 
        ? rosterEntry.member._id.toString() 
        : rosterEntry.member.toString();
      
      return memberIds.has(memberId);
    });

    console.log(`${isMember ? '✅' : '❌'} [Permission] Roster member check:`, {
      userId: currentUserId,
      memberIds: Array.from(memberIds),
      campId: targetCampId.toString(),
      isMember
    });

    return isMember;
  } catch (error) {
    console.error('❌ [Permission] Error checking roster membership:', error);
    return false;
  }
}

/**
 * Check if user is a Camp Lead for a specific camp
 * Camp Leads have delegated admin permissions scoped to a single camp
 * 
 * @param {Object} req - Express request object with req.user
 * @param {string} targetCampId - The camp ID being accessed
 * @returns {Promise<boolean>} - true if user is a Camp Lead for this camp
 */
async function isCampLeadForCamp(req, targetCampId) {
  // Must be authenticated
  if (!req.user) {
    return false;
  }

  try {
    const currentUserId = req.user._id.toString();
    console.log('🔍 [Permission] Checking Camp Lead status for user:', currentUserId);
    
    // CRITICAL: Find all Member records for this user
    const Member = require('../models/Member');
    const members = await Member.find({ user: currentUserId });
    
    if (!members || members.length === 0) {
      console.log('❌ [Permission] No member records found for user');
      return false;
    }
    
    console.log('🔍 [Permission] Found member records:', members.map(m => m._id));
    
    const memberIds = members.map(m => m._id);
    const memberIdsSet = new Set(memberIds.map(id => id.toString()));

    // Primary: Query roster directly (matches /auth/me behavior)
    const Roster = require('../models/Roster');
    const roster = await Roster.findOne({
      camp: targetCampId,
      isActive: true,
      isArchived: false,
      members: {
        $elemMatch: {
          member: { $in: memberIds },
          isCampLead: true,
          $or: [
            { status: { $in: ['approved', 'active'] } },
            { status: { $exists: false } }
          ]
        }
      }
    }).select('_id');

    if (roster) {
      console.log('✅ [Permission] Camp Lead access granted via roster query');
      return true;
    }

    // Fallback: Use active roster data if roster query didn't match
    const activeRoster = await db.findActiveRoster({ camp: targetCampId });
    if (!activeRoster || !activeRoster.members || activeRoster.members.length === 0) {
      console.log('❌ [Permission] No active roster found for camp:', targetCampId);
      return false;
    }

    const rosterEntry = activeRoster.members.find(entry => {
      if (!entry.member) return false;
      const memberId = typeof entry.member === 'object' && entry.member._id
        ? entry.member._id.toString()
        : entry.member.toString();
      return memberIdsSet.has(memberId);
    });

    if (!rosterEntry) {
      console.log('❌ [Permission] Member not found in roster');
      return false;
    }

    const isCampLead = rosterEntry.isCampLead === true;
    const rosterStatus = rosterEntry.status || 'approved';
    const isApproved = rosterStatus === 'approved' || rosterStatus === 'active';
    const hasAccess = isCampLead && isApproved;

    console.log(`${hasAccess ? '✅' : '❌'} [Permission] Camp Lead check (fallback):`, {
      userId: currentUserId,
      memberIds: Array.from(memberIdsSet),
      campId: targetCampId.toString(),
      isCampLead,
      isApproved,
      hasAccess
    });

    return hasAccess;
  } catch (error) {
    console.error('❌ [Permission] Error checking Camp Lead status:', error);
    return false;
  }
}

/**
 * Check if user has admin-level access to a camp
 * Includes: Camp owners, system admins, AND Camp Leads
 * 
 * @param {Object} req - Express request object with req.user
 * @param {string} targetCampId - The camp ID being accessed
 * @returns {Promise<boolean>} - true if user has admin-level access
 */
async function canManageCamp(req, targetCampId) {
  // System admins have access to everything
  if (req.user.accountType === 'admin' && !req.user.campId) {
    console.log('✅ [Permission] System admin access granted');
    return true;
  }

  // Camp owners and camp-affiliated admins
  const isCampOwner = await canAccessCamp(req, targetCampId);
  if (isCampOwner) {
    console.log('✅ [Permission] Camp owner access granted');
    return true;
  }

  // Camp Leads (delegated admin permissions)
  const isCampLead = await isCampLeadForCamp(req, targetCampId);
  if (isCampLead) {
    console.log('✅ [Permission] Camp Lead access granted');
    return true;
  }

  console.log('❌ [Permission] No camp management access');
  return false;
}

/**
 * Comprehensive access check for camp resources (tasks, rosters, etc.)
 * Grants access if user is:
 * - Camp owner/admin with campId
 * - Camp Lead (delegated admin)
 * - Active roster member (personal account)
 * - System admin
 * 
 * @param {Object} req - Express request object with req.user
 * @param {string} targetCampId - The camp ID being accessed
 * @returns {Promise<boolean>} - true if user has access
 */
async function canAccessCampResources(req, targetCampId) {
  // Use the new canManageCamp which includes Camp Leads
  const canManage = await canManageCamp(req, targetCampId);
  if (canManage) {
    return true;
  }

  // Active roster members (personal accounts) - view-only access
  const isRosterMember = await isActiveRosterMember(req, targetCampId);
  if (isRosterMember) {
    console.log('✅ [Permission] Active roster member access granted');
    return true;
  }

  console.log('❌ [Permission] No camp resource access');
  return false;
}

module.exports = {
  getUserCampId,
  canAccessCamp,
  requireCampAccount,
  requireCampOwnership,
  isActiveRosterMember,
  canAccessCampResources,
  isCampLeadForCamp,
  canManageCamp
};

