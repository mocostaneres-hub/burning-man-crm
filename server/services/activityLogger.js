const ActivityLog = require('../models/ActivityLog');

/**
 * Generic activity logging service
 * Records all critical changes and activities for Member and Camp accounts
 * 
 * @param {string} entityType - 'MEMBER' or 'CAMP'
 * @param {string|ObjectId} entityId - ID of the Member or Camp
 * @param {string|ObjectId} actingUserId - ID of the user performing the action
 * @param {string} activityType - Type of activity (e.g., 'PROFILE_UPDATE', 'DUES_TOGGLE')
 * @param {object} details - Additional details including field, oldValue, newValue
 * @returns {Promise<ActivityLog>}
 */
async function recordActivity(entityType, entityId, actingUserId, activityType, details = {}) {
  try {
    const activityLog = new ActivityLog({
      entityType,
      entityId,
      actingUserId,
      activityType,
      details,
      timestamp: new Date()
    });

    await activityLog.save();
    
    console.log(`✅ [ActivityLog] Recorded ${activityType} for ${entityType} ${entityId} by user ${actingUserId}`);
    
    return activityLog;
  } catch (error) {
    console.error(`❌ [ActivityLog] Error recording activity:`, error);
    // Don't throw - logging failures shouldn't break the main operation
    return null;
  }
}

/**
 * Get activity log for a specific entity
 * 
 * @param {string} entityType - 'MEMBER' or 'CAMP'
 * @param {string|ObjectId} entityId - ID of the entity
 * @param {object} options - Query options (limit, skip, sort)
 * @returns {Promise<ActivityLog[]>}
 */
async function getActivityLog(entityType, entityId, options = {}) {
  try {
    // Default to no limit to show all activities, but allow override
    const { limit = null, skip = 0, sort = { timestamp: -1 } } = options;
    
    let query = ActivityLog.find({
      entityType,
      entityId
    })
      .populate('actingUserId', 'firstName lastName email accountType')
      .sort(sort)
      .skip(skip);
    
    // Only apply limit if specified
    if (limit !== null) {
      query = query.limit(limit);
    }
    
    const logs = await query.lean();
    
    return logs;
  } catch (error) {
    console.error(`❌ [ActivityLog] Error fetching activity log:`, error);
    throw error;
  }
}

/**
 * Helper function to record field changes
 * 
 * @param {string} entityType - 'MEMBER' or 'CAMP'
 * @param {string|ObjectId} entityId - ID of the entity
 * @param {string|ObjectId} actingUserId - ID of the user making the change
 * @param {string} field - Field name that changed
 * @param {any} oldValue - Previous value
 * @param {any} newValue - New value
 * @param {string} activityType - Optional custom activity type (defaults to 'PROFILE_UPDATE')
 */
async function recordFieldChange(entityType, entityId, actingUserId, field, oldValue, newValue, activityType = 'PROFILE_UPDATE') {
  return recordActivity(entityType, entityId, actingUserId, activityType, {
    field,
    oldValue,
    newValue
  });
}

module.exports = {
  recordActivity,
  getActivityLog,
  recordFieldChange
};

