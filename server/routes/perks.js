const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const db = require('../database/databaseAdapter');

const router = express.Router();

// Public: list all global perks (public access)
router.get('/', async (req, res) => {
  try {
    const perks = await db.findGlobalPerks();
    res.json({ perks });
  } catch (error) {
    console.error('Get perks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: create a new global perk
router.post('/admin', authenticateToken, requireAdmin, [
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('icon').trim().isLength({ min: 1 }).withMessage('Icon is required'),
  body('color').trim().isLength({ min: 1 }).withMessage('Color is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const perk = await db.createGlobalPerk(req.body);
    res.status(201).json({ perk });
  } catch (error) {
    console.error('Create perk error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: update an existing global perk
router.put('/admin/:id', authenticateToken, requireAdmin, [
  body('name').optional().trim().isLength({ min: 1 }),
  body('icon').optional().trim().isLength({ min: 1 }),
  body('color').optional().trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updated = await db.updateGlobalPerk(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: 'Perk not found' });
    }
    res.json({ perk: updated });
  } catch (error) {
    console.error('Update perk error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: delete a global perk
router.delete('/admin/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await db.deleteGlobalPerk(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Perk not found' });
    }
    res.json({ message: 'Perk deleted', perk: deleted });
  } catch (error) {
    console.error('Delete perk error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


