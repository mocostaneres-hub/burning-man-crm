const express = require('express');
const router = express.Router();

// Simple test routes
router.get('/test-simple', (req, res) => {
  res.json({ message: 'Simple test route working', timestamp: new Date().toISOString() });
});

router.get('/test-auth', require('../middleware/auth').authenticateToken, (req, res) => {
  res.json({ message: 'Auth test route working', user: req.user?._id });
});

module.exports = router;
