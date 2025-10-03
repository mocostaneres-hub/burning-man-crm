const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Simple test route
router.get('/test', (req, res) => {
  res.json({ message: 'Test route working' });
});

// Authenticated test route
router.put('/auth-test', authenticateToken, (req, res) => {
  res.json({ message: 'Authenticated test route working', userId: req.user.id });
});

module.exports = router;
