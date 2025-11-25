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
    // Check if MongoDB is available (ActivityLog requires MongoDB)
    if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
      console.warn(`⚠️ [ActivityLog] MongoDB not configured - skipping activity log for ${activityType}`);
      return null;
    }
    
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
    
    console.log(`🔍 [ActivityLog] Recording ${activityType} for ${entityType} ${entityId} by user ${actingUserId}`);
    console.log(`🔍 [ActivityLog] Formatted entityId: ${formattedEntityId}, actingUserId: ${formattedActingUserId}`);
    
    const activityLog = new ActivityLog({
      entityType,
      entityId: formattedEntityId,
      actingUserId: formattedActingUserId,
      activityType,
      details,
      timestamp: new Date()
    });

    const savedLog = await activityLog.save();
    
    console.log(`✅ [ActivityLog] Recorded ${activityType} for ${entityType} ${entityId} by user ${actingUserId}`);
    console.log(`✅ [ActivityLog] Saved log ID: ${savedLog._id}, entityId: ${savedLog.entityId}, actingUserId: ${savedLog.actingUserId}`);
    
    return savedLog;
  } catch (error) {
    console.error(`❌ [ActivityLog] Error recording activity:`, error);
    console.error(`❌ [ActivityLog] Error details:`, {
      entityType,
      entityId,
      actingUserId,
      activityType,
      error: error.message,
      errorName: error.name,
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
    // Check if MongoDB is available
    if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
      console.warn(`⚠️ [ActivityLog] MongoDB not configured - returning empty log`);
      return [];
    }
    
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
    console.log(`🔍 [ActivityLog] Query entityId: ${queryEntityId} (type: ${typeof queryEntityId})`);
    
    // Try querying with both formats to handle any edge cases
    let query = ActivityLog.find({
      entityType,
      $or: [
        { entityId: queryEntityId },
        { entityId: entityId.toString() }
      ]
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
    if (logs.length > 0) {
      console.log(`🔍 [ActivityLog] Sample log entityId: ${logs[0].entityId} (type: ${typeof logs[0].entityId})`);
      console.log(`🔍 [ActivityLog] Sample log activityType: ${logs[0].activityType}`);
    } else {
      // Debug: Try to find ANY logs for this entityType to see if the issue is with the entityId
      const allLogsForType = await ActivityLog.find({ entityType }).limit(5).lean();
      console.log(`🔍 [ActivityLog] Found ${allLogsForType.length} total logs for entityType ${entityType}`);
      if (allLogsForType.length > 0) {
        console.log(`🔍 [ActivityLog] Sample entityId from other logs: ${allLogsForType[0].entityId}`);
      }
    }
    
    return logs;
  } catch (error) {
    console.error(`❌ [ActivityLog] Error fetching activity log:`, error);
    console.error(`❌ [ActivityLog] Error stack:`, error.stack);
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

