const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/databaseAdapter');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/messages/inbox
// @desc    Get user's message inbox
// @access  Private
router.get('/inbox', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // For now, return mock data since we don't have a messages collection yet
    const mockMessages = [
      {
        _id: '1',
        from: {
          _id: 1000001,
          name: 'John Doe',
          email: 'john@example.com',
          accountType: 'personal'
        },
        to: {
          _id: userId,
          name: req.user.accountType === 'camp' ? req.user.campName : `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email,
          accountType: req.user.accountType
        },
        subject: 'Question about camp membership',
        message: 'Hi, I\'m interested in joining your camp. Could you tell me more about the requirements?',
        category: 'camp-management',
        status: 'unread',
        priority: 'normal',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        threadId: 'thread_1',
        replies: []
      },
      {
        _id: '2',
        from: {
          _id: 1000002,
          name: 'Jane Smith',
          email: 'jane@example.com',
          accountType: 'personal'
        },
        to: {
          _id: userId,
          name: req.user.accountType === 'camp' ? req.user.campName : `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email,
          accountType: req.user.accountType
        },
        subject: 'Technical support request',
        message: 'I\'m having trouble logging into my account. Can you help?',
        category: 'technical',
        status: 'read',
        priority: 'high',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        threadId: 'thread_2',
        replies: [
          {
            _id: 'reply_1',
            from: {
              _id: userId,
              name: req.user.accountType === 'camp' ? req.user.campName : `${req.user.firstName} ${req.user.lastName}`,
              email: req.user.email,
              accountType: req.user.accountType
            },
            message: 'I\'ve reset your password. Please check your email.',
            createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000) // 12 hours ago
          }
        ]
      }
    ];

    // Filter messages where current user is the recipient
    const inboxMessages = mockMessages.filter(msg => msg.to._id === userId);
    
    res.json(inboxMessages);
  } catch (error) {
    console.error('Get inbox error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/sent
// @desc    Get user's sent messages
// @access  Private
router.get('/sent', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Mock sent messages
    const mockSentMessages = [
      {
        _id: '3',
        from: {
          _id: userId,
          name: req.user.accountType === 'camp' ? req.user.campName : `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email,
          accountType: req.user.accountType
        },
        to: {
          _id: 1000003,
          name: 'Support Team',
          email: 'support@burningmancrm.com',
          accountType: 'camp'
        },
        subject: 'Feature request',
        message: 'It would be great to have a mobile app for managing camp members.',
        category: 'feature',
        status: 'sent',
        priority: 'normal',
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        threadId: 'thread_3',
        replies: []
      }
    ];

    res.json(mockSentMessages);
  } catch (error) {
    console.error('Get sent messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/messages
// @desc    Send a new message
// @access  Private
router.post('/', authenticateToken, [
  body('to').notEmpty().withMessage('Recipient is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('message').notEmpty().withMessage('Message is required'),
  body('category').notEmpty().withMessage('Category is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { to, subject, message, category, priority = 'normal', threadId } = req.body;
    const fromUserId = req.user._id;

    // For now, create mock message
    const newMessage = {
      _id: `msg_${Date.now()}`,
      from: {
        _id: fromUserId,
        name: req.user.accountType === 'camp' ? req.user.campName : `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        accountType: req.user.accountType
      },
      to: {
        _id: to,
        name: 'Recipient', // In real app, would fetch from database
        email: 'recipient@example.com',
        accountType: 'personal'
      },
      subject,
      message,
      category,
      status: 'sent',
      priority,
      createdAt: new Date(),
      updatedAt: new Date(),
      threadId: threadId || `thread_${Date.now()}`,
      replies: []
    };

    // TODO: Save to database when messages collection is implemented
    console.log('New message sent:', newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/messages/:id/reply
// @desc    Reply to a message
// @access  Private
router.post('/:id/reply', authenticateToken, [
  body('message').notEmpty().withMessage('Reply message is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user._id;

    // For now, return mock reply
    const reply = {
      _id: `reply_${Date.now()}`,
      from: {
        _id: userId,
        name: req.user.accountType === 'camp' ? req.user.campName : `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        accountType: req.user.accountType
      },
      message,
      createdAt: new Date()
    };

    // TODO: Save reply to database and update original message
    console.log('Reply sent:', { messageId: id, reply });

    res.json(reply);
  } catch (error) {
    console.error('Reply to message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/messages/:id/status
// @desc    Update message status (read/unread)
// @access  Private
router.put('/:id/status', authenticateToken, [
  body('status').isIn(['read', 'unread']).withMessage('Status must be read or unread'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status } = req.body;

    // TODO: Update message status in database
    console.log('Message status updated:', { messageId: id, status });

    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('Update message status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/contacts
// @desc    Get available contacts for messaging
// @access  Private
router.get('/contacts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Mock contacts - in real app, would fetch from users/camps database
    const mockContacts = [
      {
        _id: 'support',
        name: 'Support Team',
        email: 'support@burningmancrm.com',
        accountType: 'camp',
        type: 'support'
      },
      {
        _id: 'admin',
        name: 'Admin Team',
        email: 'admin@burningmancrm.com',
        accountType: 'camp',
        type: 'admin'
      }
    ];

    // If user is a camp account, add other camps as contacts
    if (req.user.accountType === 'camp') {
      mockContacts.push(
        {
          _id: 'camp_1',
          name: 'Awesome Camp',
          email: 'contact@awesomecamp.com',
          accountType: 'camp',
          type: 'camp'
        },
        {
          _id: 'camp_2',
          name: 'Cool Camp',
          email: 'hello@coolcamp.com',
          accountType: 'camp',
          type: 'camp'
        }
      );
    }

    // If user is personal account, add camps as contacts
    if (req.user.accountType === 'personal') {
      mockContacts.push(
        {
          _id: 'camp_1',
          name: 'Awesome Camp',
          email: 'contact@awesomecamp.com',
          accountType: 'camp',
          type: 'camp'
        },
        {
          _id: 'camp_2',
          name: 'Cool Camp',
          email: 'hello@coolcamp.com',
          accountType: 'camp',
          type: 'camp'
        }
      );
    }

    res.json(mockContacts);
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
