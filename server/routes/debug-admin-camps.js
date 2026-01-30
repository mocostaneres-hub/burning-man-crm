// Debug admin camps endpoint
const express = require('express');
const router = express.Router();
const db = require('../database/databaseAdapter');

// @route   GET /api/debug-admin-camps
// @desc    Debug admin camps query
// @access  Public (remove after debugging)
router.get('/', async (req, res) => {
  try {
    console.log('🔍 [Debug Admin Camps] Testing camps query...');
    
    // Get all camps
    const allCamps = await db.findCamps();
    console.log('📊 [Debug Admin Camps] Found camps:', allCamps.length);
    
    // Sample camps data
    const sampleCamps = allCamps.slice(0, 3).map(camp => ({
      _id: camp._id,
      name: camp.name || camp.campName,
      slug: camp.slug,
      owner: camp.owner,
      status: camp.status,
      isRecruiting: camp.isRecruiting,
      createdAt: camp.createdAt
    }));
    
    console.log('📊 [Debug Admin Camps] Sample camps:', JSON.stringify(sampleCamps, null, 2));
    
    // Try enrichment process
    const User = require('../models/User');
    const Roster = require('../models/Roster');
    
    const enrichedSample = await Promise.all(sampleCamps.map(async (camp) => {
      try {
        let owner = null;
        if (camp.owner) {
          owner = await db.findUser({ _id: camp.owner.toString() });
        }
        
        let rosterCount = 0;
        try {
          rosterCount = await Roster.countDocuments({ camp: camp._id });
        } catch (err) {
          console.error('❌ Roster count error:', err.message);
        }
        
        return {
          ...camp,
          ownerFound: !!owner,
          ownerEmail: owner?.email,
          rosterCount
        };
      } catch (err) {
        console.error('❌ Enrichment error for camp:', camp._id, err.message);
        return {
          ...camp,
          enrichmentError: err.message
        };
      }
    }));
    
    res.json({
      totalCamps: allCamps.length,
      sampleCamps: enrichedSample,
      message: 'Camps query successful'
    });

  } catch (error) {
    console.error('❌ [Debug Admin Camps] Error:', error.message);
    console.error('❌ [Debug Admin Camps] Stack:', error.stack);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
