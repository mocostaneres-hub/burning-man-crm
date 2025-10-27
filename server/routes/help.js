const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/databaseAdapter');
const { authenticateToken } = require('../middleware/auth');
const FAQ = require('../models/FAQ');

const router = express.Router();

// Optional authentication middleware
const optionalAuth = (req, res, next) => {
  // Try to authenticate, but don't fail if no token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // If token exists, use normal authentication
    return authenticateToken(req, res, next);
  } else {
    // No token, continue without user
    req.user = null;
    next();
  }
};

// @route   GET /api/help/faqs
// @desc    Get all active FAQs filtered by account type
// @access  Public (with optional authentication)
router.get('/faqs', optionalAuth, async (req, res) => {
  try {
    // Build audience filter based on user account type
    let audienceFilter = ['both', 'homepage']; // Default for non-authenticated users
    
    if (req.user) {
      if (req.user.accountType === 'admin') {
        // Admin users see all FAQs
        audienceFilter = ['both', 'camps', 'members', 'homepage'];
      } else if (req.user.accountType === 'camp') {
        audienceFilter = ['both', 'camps'];
      } else if (req.user.accountType === 'personal') {
        audienceFilter = ['both', 'members'];
      }
    }

    const faqs = await db.findFAQs({
      isActive: true,
      audience: audienceFilter
    });

    res.json({ faqs });
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
