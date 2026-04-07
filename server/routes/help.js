const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/databaseAdapter');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { sendSupportContactEmail } = require('../services/emailService');

const router = express.Router();
const VALID_AUDIENCES = new Set(['both', 'camps', 'members', 'homepage', 'all']);

const normalizeAudience = (value) => {
  const audience = String(value || '').toLowerCase().trim();
  if (audience === 'camp' || audience === 'camps') return 'camps';
  if (audience === 'member' || audience === 'members' || audience === 'personal') return 'members';
  if (audience === 'homepage' || audience === 'home' || audience === 'public') return 'homepage';
  if (audience === 'both' || audience === 'all' || audience === 'shared') return 'both';
  return 'both';
};

const resolveRequestedAudience = (rawAudience) => {
  const normalized = normalizeAudience(rawAudience);
  if (String(rawAudience || '').toLowerCase().trim() === 'all') return 'all';
  if (VALID_AUDIENCES.has(normalized)) return normalized;
  return null;
};

const resolveAudienceFilter = ({ user, requestedAudience }) => {
  if (!user) {
    return ['both', 'homepage'];
  }

  const isAdmin = user.accountType === 'admin' || user.isSystemAdmin === true;
  if (isAdmin) {
    if (requestedAudience === 'camps') return ['both', 'camps', 'homepage'];
    if (requestedAudience === 'members') return ['both', 'members', 'homepage'];
    if (requestedAudience === 'homepage') return ['homepage'];
    return ['both', 'camps', 'members', 'homepage'];
  }

  // Honor page context (camp/member help routes), not only accountType.
  if (requestedAudience === 'camps') return ['both', 'camps', 'homepage'];
  if (requestedAudience === 'members') return ['both', 'members', 'homepage'];
  if (requestedAudience === 'homepage') return ['both', 'homepage'];

  if (user.accountType === 'camp') return ['both', 'camps', 'homepage'];
  if (user.accountType === 'personal') return ['both', 'members', 'homepage'];
  return ['both', 'homepage'];
};

// @route   GET /api/help/faqs
// @desc    Get all active FAQs filtered by account type
// @access  Public (with optional authentication)
router.get('/faqs', optionalAuth, async (req, res) => {
  try {
    const requestedAudience = resolveRequestedAudience(req.query?.audience);
    const audienceFilter = resolveAudienceFilter({
      user: req.user,
      requestedAudience
    });

    // Pull active FAQs and apply visibility rules here so legacy values
    // (camp/member/missing audience) are still displayed correctly.
    const allActiveFaqs = await db.findFAQs({ isActive: true });
    const faqs = allActiveFaqs
      .map((faq) => {
        const plainFaq = typeof faq?.toObject === 'function' ? faq.toObject() : faq;
        return {
          ...plainFaq,
          audience: normalizeAudience(plainFaq?.audience)
        };
      })
      .filter((faq) => audienceFilter.includes(faq.audience));

    res.json({ faqs, audienceFilter });
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
// @desc    Submit contact form and notify support inbox
// @access  Public (optional auth)
router.post('/contact', optionalAuth, [
  body('requesterType').isIn(['camp', 'member', 'other']).withMessage('Requester type must be camp, member, or other'),
  body('requesterEmail').isEmail().withMessage('Valid email is required'),
  body('requesterPhone').optional({ checkFalsy: true }).isString().withMessage('Phone must be a valid string'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('message').notEmpty().withMessage('Message is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { requesterType, requesterEmail, requesterPhone, subject, message } = req.body;
    const submissionTimestamp = new Date().toISOString();

    console.log('Contact Form Submission:', {
      requesterType,
      requesterEmail,
      requesterPhone,
      subject,
      message,
      timestamp: submissionTimestamp,
      ip: req.ip
    });

    await sendSupportContactEmail({
      requesterType,
      requesterEmail,
      requesterPhone,
      subject,
      message,
      submittedByUser: req.user,
      submittedAt: submissionTimestamp
    });

    res.json({ 
      message: 'Contact form submitted successfully',
      ticketId: `TICKET-${Date.now()}`,
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
