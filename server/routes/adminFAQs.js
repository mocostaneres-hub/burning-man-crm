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

// @route   POST /api/admin/faqs/restore
// @desc    Restore original FAQs (Admin only)
// @access  Private (Admin only)
router.post('/restore', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const originalFAQs = [
      {
        question: 'How do I create a camp profile?',
        answer: 'To create a camp profile, go to your dashboard and click "Create Camp". Fill out all the required information including camp name, contact email, and Playa location.',
        category: 'Camp Management',
        order: 1,
        isActive: true,
        audience: 'camps',
        createdBy: req.user._id,
      },
      {
        question: 'How do I add members to my camp?',
        answer: 'You can add members by going to the "Manage Members" section in your dashboard. Click "Add Member" and fill out their information.',
        category: 'Camp Management',
        order: 2,
        isActive: true,
        audience: 'camps',
        createdBy: req.user._id,
      },
      {
        question: 'Can I edit my camp profile after creating it?',
        answer: 'Yes! You can edit your camp profile at any time by going to "Your Camp" in the navigation menu.',
        category: 'Camp Management',
        order: 3,
        isActive: true,
        audience: 'camps',
        createdBy: req.user._id,
      },
      {
        question: 'How do I contact support?',
        answer: 'You can contact our support team using the contact form on the Help page. We typically respond within 24 hours.',
        category: 'Technical Support',
        order: 1,
        isActive: true,
        audience: 'both',
        createdBy: req.user._id,
      },
      {
        question: 'What if I forget my password?',
        answer: 'Click "Forgot your password?" on the login page and enter your email address. We\'ll send you a link to reset your password.',
        category: 'Account Management',
        order: 1,
        isActive: true,
        audience: 'both',
        createdBy: req.user._id,
      },
      {
        question: 'How do I find a camp to join?',
        answer: 'Use the "Discover Camps" section to browse available camps. You can search by interests, location, or camp type. Read camp profiles to learn about their mission and what they\'re looking for in members.',
        category: 'Applications',
        order: 1,
        isActive: true,
        audience: 'members',
        createdBy: req.user._id,
      },
      {
        question: 'What should I include in my camp application?',
        answer: 'Be honest about your G8Road experience, skills you can contribute, availability during the event, and what you hope to get out of joining the camp. Include relevant experience with art, cooking, construction, or other valuable skills.',
        category: 'Applications',
        order: 2,
        isActive: true,
        audience: 'members',
        createdBy: req.user._id,
      },
      {
        question: 'How long does it take to hear back from camps?',
        answer: 'Response times vary by camp, but most camps try to respond within a few days to a week. If you don\'t hear back, you can send a follow-up message or apply to other camps that interest you.',
        category: 'Applications',
        order: 3,
        isActive: true,
        audience: 'members',
        createdBy: req.user._id,
      },
      {
        question: 'Can I apply to multiple camps?',
        answer: 'Yes! You can apply to multiple camps to increase your chances of finding the right fit. Just be transparent with camps if you\'re accepted by multiple and need to make a decision.',
        category: 'Applications',
        order: 4,
        isActive: true,
        audience: 'members',
        createdBy: req.user._id,
      },
      {
        question: 'What if I\'m new to G8Road?',
        answer: 'Many camps welcome newcomers! Look for camps that specifically mention being newbie-friendly or that offer orientation programs. Don\'t be afraid to mention your new status in applications - enthusiasm and willingness to learn are valuable qualities.',
        category: 'Applications',
        order: 5,
        isActive: true,
        audience: 'members',
        createdBy: req.user._id,
      },
      {
        question: 'How do I discover events and experiences?',
        answer: 'Use our events calendar to find workshops, art installations, performances, and community events happening throughout G8Road week. You can filter by type, time, location, and interests.',
        category: 'General',
        order: 1,
        isActive: true,
        audience: 'members',
        createdBy: req.user._id,
      },
      {
        question: 'Can I message camps directly?',
        answer: 'Yes! Our messaging system allows you to communicate directly with camp leaders to ask questions, learn more about their community, and discuss your potential fit with the camp.',
        category: 'General',
        order: 2,
        isActive: true,
        audience: 'members',
        createdBy: req.user._id,
      },
    ];

    // Clear existing FAQs
    await FAQ.deleteMany({});
    
    // Insert the original FAQs
    const insertedFAQs = await FAQ.insertMany(originalFAQs);
    
    res.json({ 
      message: 'FAQs restored successfully',
      count: insertedFAQs.length,
      faqs: insertedFAQs
    });
  } catch (error) {
    console.error('Restore FAQs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
