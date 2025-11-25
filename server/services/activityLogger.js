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
    // Ensure entityId and actingUserId are properly formatted (ObjectId if valid)
    const mongoose = require('mongoose');
    
    let formattedEntityId = entityId;
    let formattedActingUserId = actingUserId;
    
    // Convert string IDs to ObjectId if they're valid MongoDB ObjectIds
    if (typeof entityId === 'string' && mongoose.Types.ObjectId.isValid(entityId)) {
      formattedEntityId = new mongoose.Types.ObjectId(entityId);
    }
    if (typeof actingUserId === 'string' && mongoose.Types.ObjectId.isValid(actingUserId)) {
      formattedActingUserId = new mongoose.Types.ObjectId(actingUserId);
    }
    
    const activityLog = new ActivityLog({
      entityType,
      entityId: formattedEntityId,
      actingUserId: formattedActingUserId,
      activityType,
      details,
      timestamp: new Date()
    });

    await activityLog.save();
    
    console.log(`✅ [ActivityLog] Recorded ${activityType} for ${entityType} ${entityId} by user ${actingUserId}`);
    console.log(`🔍 [ActivityLog] Saved with entityId: ${activityLog.entityId}, actingUserId: ${activityLog.actingUserId}`);
    
    return activityLog;
  } catch (error) {
    console.error(`❌ [ActivityLog] Error recording activity:`, error);
    console.error(`❌ [ActivityLog] Error details:`, {
      entityType,
      entityId,
      actingUserId,
      activityType,
      error: error.message,
      stack: error.stack
    });
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
    
    // Handle both string and ObjectId formats for entityId
    const mongoose = require('mongoose');
    let queryEntityId = entityId;
    
    // If entityId is a string that looks like an ObjectId, convert it
    if (typeof entityId === 'string' && mongoose.Types.ObjectId.isValid(entityId)) {
      queryEntityId = new mongoose.Types.ObjectId(entityId);
    }
    
    console.log(`🔍 [ActivityLog] Fetching logs for ${entityType} with entityId: ${entityId} (type: ${typeof entityId})`);
    
    let query = ActivityLog.find({
      entityType,
      entityId: queryEntityId
    })
      .populate('actingUserId', 'firstName lastName email accountType')
      .sort(sort)
      .skip(skip);
    
    // Only apply limit if specified
    if (limit !== null) {
      query = query.limit(limit);
    }
    
    const logs = await query.lean();
    
    console.log(`✅ [ActivityLog] Found ${logs.length} logs for ${entityType} ${entityId}`);
    
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

