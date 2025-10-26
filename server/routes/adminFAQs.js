const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const FAQ = require('../models/FAQ');

const router = express.Router();

// @route   GET /api/admin/faqs
// @desc    Get all FAQs for admin management
// @access  Private (Admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const faqs = await FAQ.find()
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .sort({ category: 1, order: 1 });

    res.json({ faqs });
  } catch (error) {
    console.error('Get FAQs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/faqs
// @desc    Create a new FAQ
// @access  Private (Admin only)
router.post('/', authenticateToken, requireAdmin, [
  body('question').notEmpty().withMessage('Question is required'),
  body('answer').notEmpty().withMessage('Answer is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('order').isInt({ min: 1 }).withMessage('Order must be a positive integer'),
  body('audience').isIn(['both', 'camps', 'members']).withMessage('Invalid audience type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { question, answer, category, order, isActive = true, audience = 'both' } = req.body;

    const newFAQ = new FAQ({
      question,
      answer,
      category,
      order,
      isActive,
      audience,
      createdBy: req.user._id
    });

    await newFAQ.save();
    await newFAQ.populate('createdBy', 'firstName lastName email');

    res.status(201).json({ faq: newFAQ });
  } catch (error) {
    console.error('Create FAQ error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/faqs/:id
// @desc    Update an FAQ
// @access  Private (Admin only)
router.put('/:id', authenticateToken, requireAdmin, [
  body('question').notEmpty().withMessage('Question is required'),
  body('answer').notEmpty().withMessage('Answer is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('order').isInt({ min: 1 }).withMessage('Order must be a positive integer'),
  body('audience').isIn(['both', 'camps', 'members']).withMessage('Invalid audience type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { question, answer, category, order, isActive, audience } = req.body;

    const faq = await FAQ.findById(id);
    if (!faq) {
      return res.status(404).json({ message: 'FAQ not found' });
    }

    faq.question = question;
    faq.answer = answer;
    faq.category = category;
    faq.order = order;
    faq.isActive = isActive;
    faq.audience = audience;
    faq.updatedBy = req.user._id;

    await faq.save();
    await faq.populate('createdBy', 'firstName lastName email');
    await faq.populate('updatedBy', 'firstName lastName email');

    res.json({ faq });
  } catch (error) {
    console.error('Update FAQ error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/admin/faqs/:id
// @desc    Delete an FAQ
// @access  Private (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const faq = await FAQ.findById(id);
    if (!faq) {
      return res.status(404).json({ message: 'FAQ not found' });
    }

    await FAQ.findByIdAndDelete(id);

    res.json({ message: 'FAQ deleted successfully' });
  } catch (error) {
    console.error('Delete FAQ error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
