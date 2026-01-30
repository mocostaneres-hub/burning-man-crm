// Temporary debug endpoint to test database queries
const express = require('express');
const router = express.Router();
const db = require('../database/databaseAdapter');
const mongoose = require('mongoose');

// @route   GET /api/debug-db
// @desc    Debug database queries
// @access  Public (remove after debugging)
router.get('/', async (req, res) => {
  try {
    console.log('🔍 [Debug] Testing database queries...');
    
    // Test connection
    const connectionInfo = {
      isConnected: mongoose.connection.readyState === 1,
      dbName: mongoose.connection.name,
      host: mongoose.connection.host,
      usingMongoDB: db.useMongoDB
    };
    
    console.log('📊 [Debug] Connection:', connectionInfo);

    // Test raw collection queries
    const rawCounts = {};
    try {
      rawCounts.users = await mongoose.connection.db.collection('users').countDocuments();
      rawCounts.camps = await mongoose.connection.db.collection('camps').countDocuments();
      rawCounts.members = await mongoose.connection.db.collection('members').countDocuments();
      rawCounts.rosters = await mongoose.connection.db.collection('rosters').countDocuments();
      console.log('📊 [Debug] Raw counts:', rawCounts);
    } catch (err) {
      console.error('❌ [Debug] Raw query error:', err.message);
      rawCounts.error = err.message;
    }

    // Test database adapter queries
    const adapterCounts = {};
    try {
      const allUsers = await db.findUsers();
      const allCamps = await db.findCamps();
      const allMembers = await db.findMembers();
      
      adapterCounts.users = allUsers.length;
      adapterCounts.camps = allCamps.length;
      adapterCounts.members = allMembers.length;
      
      console.log('📊 [Debug] Adapter counts:', adapterCounts);
      
      // Sample data
      const sampleData = {
        sampleUser: allUsers[0] ? { 
          id: allUsers[0]._id,
          email: allUsers[0].email,
          accountType: allUsers[0].accountType
        } : null,
        sampleCamp: allCamps[0] ? {
          id: allCamps[0]._id,
          name: allCamps[0].campName || allCamps[0].name,
          status: allCamps[0].status
        } : null,
        sampleMember: allMembers[0] ? {
          id: allMembers[0]._id,
          name: allMembers[0].name
        } : null
      };
      
      console.log('📊 [Debug] Sample data:', JSON.stringify(sampleData, null, 2));
      
      res.json({
        connection: connectionInfo,
        rawCounts,
        adapterCounts,
        sampleData,
        message: 'Database queries executed successfully'
      });
    } catch (err) {
      console.error('❌ [Debug] Adapter query error:', err.message);
      console.error('❌ [Debug] Stack:', err.stack);
      
      res.status(500).json({
        connection: connectionInfo,
        rawCounts,
        adapterError: err.message,
        stack: err.stack
      });
    }

  } catch (error) {
    console.error('❌ [Debug] Overall error:', error.message);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
