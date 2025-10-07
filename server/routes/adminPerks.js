const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const db = require('../database/databaseAdapter');

const router = express.Router();

// GET /api/admin/perks - get all global perks
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const perks = await db.findGlobalPerks();
    res.json({ perks });
  } catch (error) {
    console.error('Admin get perks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/admin/perks - create a new global perk
router.post('/', authenticateToken, requireAdmin, [
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
    console.error('Admin create perk error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/admin/perks/:id - update a global perk
router.put('/:id', authenticateToken, requireAdmin, [
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
    console.error('Admin update perk error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/admin/perks/:id - delete a global perk
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await db.deleteGlobalPerk(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Perk not found' });
    }
    res.json({ message: 'Perk deleted', perk: deleted });
  } catch (error) {
    console.error('Admin delete perk error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


