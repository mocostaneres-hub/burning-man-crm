const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/databaseAdapter');

// Test route
router.get('/debug-test', (req, res) => {
  res.json({ message: 'Minimal shifts router working', timestamp: new Date().toISOString() });
});

// Simple events route
router.get('/events', authenticateToken, async (req, res) => {
  try {
    res.json({ message: 'Events route working', events: [] });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
