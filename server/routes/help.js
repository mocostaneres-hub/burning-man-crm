const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/databaseAdapter');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/help/faqs
// @desc    Get all active FAQs
// @access  Public
router.get('/faqs', async (req, res) => {
  try {
    // For now, return mock data since we don't have a FAQs collection yet
    const mockFAQs = [
      {
        _id: '1',
        question: 'How do I create a camp profile?',
        answer: 'To create a camp profile, go to your dashboard and click "Create Camp". Fill out all the required information including camp name, contact email, and Playa location.',
        category: 'camp-management',
        order: 1,
        isActive: true,
        showForCamps: true,
        showForMembers: false,
      },
      {
        _id: '2',
        question: 'How do I add members to my camp?',
        answer: 'You can add members by going to the "Manage Members" section in your dashboard. Click "Add Member" and fill out their information.',
        category: 'camp-management',
        order: 2,
        isActive: true,
        showForCamps: true,
        showForMembers: false,
      },
      {
        _id: '3',
        question: 'Can I edit my camp profile after creating it?',
        answer: 'Yes! You can edit your camp profile at any time by going to "Your Camp" in the navigation menu.',
        category: 'camp-management',
        order: 3,
        isActive: true,
        showForCamps: true,
        showForMembers: false,
      },
      {
        _id: '4',
        question: 'How do I contact support?',
        answer: 'You can contact our support team using the contact form on the Help page. We typically respond within 24 hours.',
        category: 'support',
        order: 1,
        isActive: true,
        showForCamps: false,
        showForMembers: false,
      },
      {
        _id: '5',
        question: 'What if I forget my password?',
        answer: 'Click "Forgot your password?" on the login page and enter your email address. We\'ll send you a link to reset your password.',
        category: 'account',
        order: 1,
        isActive: true,
        showForCamps: false,
        showForMembers: false,
      },
      {
        _id: '6',
        question: 'How do I find a camp to join?',
        answer: 'Use the "Discover Camps" section to browse available camps. You can search by interests, location, or camp type. Read camp profiles to learn about their mission and what they\'re looking for in members.',
        category: 'camp-discovery',
        order: 1,
        isActive: true,
        showForCamps: false,
        showForMembers: true,
      },
      {
        _id: '7',
        question: 'What should I include in my camp application?',
        answer: 'Be honest about your G8Road experience, skills you can contribute, availability during the event, and what you hope to get out of joining the camp. Include relevant experience with art, cooking, construction, or other valuable skills.',
        category: 'camp-discovery',
        order: 2,
        isActive: true,
        showForCamps: false,
        showForMembers: true,
      },
      {
        _id: '8',
        question: 'How long does it take to hear back from camps?',
        answer: 'Response times vary by camp, but most camps try to respond within a few days to a week. If you don\'t hear back, you can send a follow-up message or apply to other camps that interest you.',
        category: 'camp-discovery',
        order: 3,
        isActive: true,
        showForCamps: false,
        showForMembers: true,
      },
      {
        _id: '9',
        question: 'Can I apply to multiple camps?',
        answer: 'Yes! You can apply to multiple camps to increase your chances of finding the right fit. Just be transparent with camps if you\'re accepted by multiple and need to make a decision.',
        category: 'camp-discovery',
        order: 4,
        isActive: true,
        showForCamps: false,
        showForMembers: true,
      },
      {
        _id: '10',
        question: 'What if I\'m new to G8Road?',
        answer: 'Many camps welcome newcomers! Look for camps that specifically mention being newbie-friendly or that offer orientation programs. Don\'t be afraid to mention your new status in applications - enthusiasm and willingness to learn are valuable qualities.',
        category: 'camp-discovery',
        order: 5,
        isActive: true,
        showForCamps: false,
        showForMembers: true,
      },
      {
        _id: '11',
        question: 'How do I discover events and experiences?',
        answer: 'Use our events calendar to find workshops, art installations, performances, and community events happening throughout G8Road week. You can filter by type, time, location, and interests.',
        category: 'events',
        order: 1,
        isActive: true,
        showForCamps: false,
        showForMembers: true,
      },
      {
        _id: '12',
        question: 'Can I message camps directly?',
        answer: 'Yes! Our messaging system allows you to communicate directly with camp leaders to ask questions, learn more about their community, and discuss your potential fit with the camp.',
        category: 'communication',
        order: 1,
        isActive: true,
        showForCamps: false,
        showForMembers: true,
      },
    ];

    res.json(mockFAQs);
  } catch (error) {
    console.error('Get FAQs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/help/support-messages
// @desc    Get support messages for the current user
// @access  Private
router.get('/support-messages', authenticateToken, async (req, res) => {
  try {
    // For now, return mock data since we don't have a support messages collection yet
    const mockSupportMessages = [
      {
        _id: '1',
        subject: 'Welcome to the platform!',
        message: 'Thank you for joining our community. If you have any questions, feel free to reach out.',
        status: 'resolved',
        priority: 'low',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    res.json(mockSupportMessages);
  } catch (error) {
    console.error('Get support messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/help/contact
// @desc    Submit contact form
// @access  Public
router.post('/contact', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('message').notEmpty().withMessage('Message is required'),
  body('category').notEmpty().withMessage('Category is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, subject, message, category } = req.body;

    // For now, just log the contact form submission
    console.log('Contact Form Submission:', {
      name,
      email,
      subject,
      message,
      category,
      timestamp: new Date().toISOString(),
      ip: req.ip,
    });

    // TODO: In a real application, you would:
    // 1. Save to database
    // 2. Send email notification to support team
    // 3. Send confirmation email to user
    // 4. Create a support ticket

    res.json({ 
      message: 'Contact form submitted successfully',
      ticketId: `TICKET-${Date.now()}`, // Mock ticket ID
    });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/help/faqs
// @desc    Create a new FAQ
// @access  Private (Admin only)
router.post('/faqs', authenticateToken, [
  body('question').notEmpty().withMessage('Question is required'),
  body('answer').notEmpty().withMessage('Answer is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('order').isInt({ min: 1 }).withMessage('Order must be a positive integer'),
], async (req, res) => {
  try {
    // Check if user is admin (for now, just check if it's a camp account)
    if (req.user.accountType !== 'camp') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { question, answer, category, order, isActive = true } = req.body;

    // For now, return mock data since we don't have a FAQs collection
    const newFAQ = {
      _id: `faq_${Date.now()}`,
      question,
      answer,
      category,
      order,
      isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // TODO: Save to database when FAQ collection is implemented
    console.log('New FAQ created:', newFAQ);

    res.status(201).json(newFAQ);
  } catch (error) {
    console.error('Create FAQ error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/help/faqs/:id
// @desc    Update an FAQ
// @access  Private (Admin only)
router.put('/faqs/:id', authenticateToken, [
  body('question').notEmpty().withMessage('Question is required'),
  body('answer').notEmpty().withMessage('Answer is required'),
  body('category').notEmpty().withMessage('Category is required'),
  body('order').isInt({ min: 1 }).withMessage('Order must be a positive integer'),
], async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.accountType !== 'camp') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { question, answer, category, order, isActive = true } = req.body;

    // For now, return mock data
    const updatedFAQ = {
      _id: id,
      question,
      answer,
      category,
      order,
      isActive,
      updatedAt: new Date(),
    };

    // TODO: Update in database when FAQ collection is implemented
    console.log('FAQ updated:', updatedFAQ);

    res.json(updatedFAQ);
  } catch (error) {
    console.error('Update FAQ error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/help/faqs/:id
// @desc    Delete an FAQ
// @access  Private (Admin only)
router.delete('/faqs/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.accountType !== 'camp') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { id } = req.params;

    // TODO: Delete from database when FAQ collection is implemented
    console.log('FAQ deleted:', id);

    res.json({ message: 'FAQ deleted successfully' });
  } catch (error) {
    console.error('Delete FAQ error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
