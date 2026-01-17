const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const {
  sendEmail,
  sendTestEmail,
  sendApplicationStatusEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendRosterInviteEmail
} = require('../services/emailService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * @route   POST /api/email/test
 * @desc    Send a test email (Admin only)
 * @access  Private (Admin)
 */
router.post('/test', authenticateToken, requireAdmin, [
  body('to').isEmail().withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { to } = req.body;

    await sendTestEmail(to);

    res.json({
      success: true,
      message: `Test email sent successfully to ${to}`
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/email/send
 * @desc    Send a custom email (Admin only)
 * @access  Private (Admin)
 */
router.post('/send', authenticateToken, requireAdmin, [
  body('to').isEmail().withMessage('Valid email is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('html').notEmpty().withMessage('HTML content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { to, subject, html, text } = req.body;

    await sendEmail({ to, subject, html, text });

    res.json({
      success: true,
      message: `Email sent successfully to ${to}`
    });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/email/welcome
 * @desc    Send welcome email to a user (Admin only)
 * @access  Private (Admin)
 */
router.post('/welcome', authenticateToken, requireAdmin, [
  body('userId').notEmpty().withMessage('User ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.body;
    const db = req.app.get('db');

    const user = await db.findUser({ _id: userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await sendWelcomeEmail(user);

    res.json({
      success: true,
      message: `Welcome email sent to ${user.email}`
    });
  } catch (error) {
    console.error('Welcome email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send welcome email',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/email/status
 * @desc    Check Resend configuration status
 * @access  Private (Admin)
 */
router.get('/status', authenticateToken, requireAdmin, (req, res) => {
  const isConfigured = !!process.env.RESEND_API_KEY;

  res.json({
    configured: isConfigured,
    fromEmail: process.env.RESEND_FROM_EMAIL || 'Not set',
    fromName: process.env.RESEND_FROM_NAME || 'Not set',
    message: isConfigured
      ? 'Resend is properly configured'
      : 'Resend API key is missing. Please set RESEND_API_KEY in environment variables.'
  });
});

module.exports = router;

