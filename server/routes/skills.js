const express = require('express');
const router = express.Router();
const db = require('../database/databaseAdapter');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// @route   GET /api/skills
// @desc    Get all active skills
// @access  Public
router.get('/', async (req, res) => {
  try {
    const skills = await db.findSkills({ isActive: true });
    res.json(skills);
  } catch (error) {
    console.error('Get skills error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/skills/all
// @desc    Get all skills (including inactive) - Admin only
// @access  Private (Admin)
router.get('/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const skills = await db.findSkills({ });
    res.json(skills);
  } catch (error) {
    console.error('Get all skills error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/skills/:id
// @desc    Get skill by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const skill = await db.findSkillById(req.params.id);
    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }
    res.json(skill);
  } catch (error) {
    console.error('Get skill by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   POST /api/skills
// @desc    Create a new skill - Admin only
// @access  Private (Admin)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Skill name is required' });
    }
    
    // Check if skill already exists
    const existing = await db.findSkillByName(name);
    if (existing) {
      return res.status(400).json({ message: 'A skill with this name already exists' });
    }
    
    const skillData = {
      name: name.trim(),
      description: description?.trim() || '',
      isActive: true,
      createdBy: req.user._id
    };
    
    const skill = await db.createSkill(skillData);
    res.status(201).json(skill);
  } catch (error) {
    console.error('Create skill error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/skills/:id
// @desc    Update a skill - Admin only
// @access  Private (Admin)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, isActive } = req.body;
    
    const skill = await db.findSkillById(req.params.id);
    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }
    
    const updates = {};
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ message: 'Skill name cannot be empty' });
      }
      
      // Check if new name is already taken by another skill
      const existing = await db.findSkillByName(name);
      if (existing && existing._id.toString() !== req.params.id) {
        return res.status(400).json({ message: 'A skill with this name already exists' });
      }
      updates.name = name.trim();
    }
    if (description !== undefined) {
      updates.description = description.trim();
    }
    if (isActive !== undefined) {
      updates.isActive = isActive;
    }
    
    const updatedSkill = await db.updateSkill(req.params.id, updates);
    res.json(updatedSkill);
  } catch (error) {
    console.error('Update skill error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/skills/:id
// @desc    Delete a skill (soft delete by setting isActive to false) - Admin only
// @access  Private (Admin)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const skill = await db.findSkillById(req.params.id);
    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }
    
    // Soft delete by setting isActive to false
    const updatedSkill = await db.updateSkill(req.params.id, { isActive: false });
    res.json({ message: 'Skill deactivated successfully', skill: updatedSkill });
  } catch (error) {
    console.error('Delete skill error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/skills/:id/permanent
// @desc    Permanently delete a skill - Admin only
// @access  Private (Admin)
router.delete('/:id/permanent', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const skill = await db.findSkillById(req.params.id);
    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }
    
    await db.deleteSkill(req.params.id);
    res.json({ message: 'Skill permanently deleted successfully' });
  } catch (error) {
    console.error('Permanent delete skill error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

