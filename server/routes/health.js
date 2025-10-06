// Health check endpoint to verify MongoDB connection
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../database/databaseAdapter');

// @route   GET /api/health
// @desc    Health check and MongoDB connection status
// @access  Public
router.get('/', async (req, res) => {
  try {
    const status = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      mongodb: {
        connected: mongoose.connection.readyState === 1,
        state: mongoose.connection.readyState, // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
        host: mongoose.connection.host || 'not connected',
        name: mongoose.connection.name || 'not connected',
      },
      databaseAdapter: {
        usingMongoDB: db.useMongoDB,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'not set',
        mongoUriSet: !!process.env.MONGODB_URI,
        clientUrl: process.env.CLIENT_URL || 'not set',
      }
    };

    res.json(status);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

module.exports = router;

