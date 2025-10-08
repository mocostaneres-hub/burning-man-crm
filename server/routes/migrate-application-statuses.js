// Temporary endpoint to migrate old application statuses
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const MemberApplication = require('../models/MemberApplication');

const statusMapping = {
  'ApplicationSubmitted': 'pending',
  'PendingFinalReview': 'under-review',
  'Accepted': 'approved',
  'Rejected': 'rejected'
};

// @route   POST /api/migrate/application-statuses
// @desc    Migrate old application status values to new enum values
// @access  Private (Admin only)
router.post('/application-statuses', authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 [POST /api/migrate/application-statuses] Starting migration...');

    const applications = await MemberApplication.find({});
    console.log(`📊 Found ${applications.length} applications`);

    const results = {
      updated: [],
      unchanged: [],
      errors: []
    };

    for (const app of applications) {
      const oldStatus = app.status;
      const newStatus = statusMapping[oldStatus];
      
      if (newStatus && newStatus !== oldStatus) {
        try {
          app.status = newStatus;
          await app.save();
          results.updated.push({ id: app._id, old: oldStatus, new: newStatus });
          console.log(`✅ Updated ${app._id}: "${oldStatus}" → "${newStatus}"`);
        } catch (err) {
          results.errors.push({ id: app._id, error: err.message });
          console.error(`❌ Failed to update ${app._id}:`, err.message);
        }
      } else {
        results.unchanged.push({ id: app._id, status: oldStatus });
      }
    }

    console.log(`✅ Migration complete: ${results.updated.length} updated, ${results.unchanged.length} unchanged, ${results.errors.length} errors`);

    res.json({
      success: true,
      message: 'Migration complete',
      results
    });

  } catch (error) {
    console.error('❌ [POST /api/migrate/application-statuses] Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

