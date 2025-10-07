// Helper functions for camp-related operations
const db = require('../database/databaseAdapter');

/**
 * Get camp ID from authenticated user
 * Works for both camp accounts and admin accounts with camp access
 * @param {Object} user - The authenticated user object from req.user
 * @returns {Promise<string|null>} - The camp ID or null if not found
 */
async function getCampIdFromUser(user) {
  // If user has campId field, use it directly
  if (user.campId) {
    return user.campId.toString();
  }

  // Fallback: find camp by contactEmail (for backward compatibility)
  if (user.email) {
    const camp = await db.findCamp({ contactEmail: user.email });
    return camp ? camp._id.toString() : null;
  }

  return null;
}

/**
 * Check if user has camp admin access
 * @param {Object} user - The authenticated user object from req.user
 * @returns {boolean} - True if user is camp admin/lead
 */
function isCampAdmin(user) {
  return user.accountType === 'camp' || (user.accountType === 'admin' && user.campId);
}

/**
 * Verify user has access to a specific camp
 * @param {Object} user - The authenticated user object from req.user
 * @param {string} campId - The camp ID to check access for
 * @returns {Promise<boolean>} - True if user has access
 */
async function hasAccessToCamp(user, campId) {
  if (!campId) return false;

  const userCampId = await getCampIdFromUser(user);
  if (!userCampId) return false;

  return userCampId === campId.toString();
}

module.exports = {
  getCampIdFromUser,
  isCampAdmin,
  hasAccessToCamp
};

