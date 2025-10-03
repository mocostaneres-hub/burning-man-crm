const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const Camp = require('../models/Camp');
const Invite = require('../models/Invite');
const { authenticateToken, requireCampLead } = require('../middleware/auth');
const db = require('../database/databaseAdapter');

const router = express.Router();

// @route   GET /api/camps/:campId/invites/template
// @desc    Get invite templates for a camp
// @access  Private (Camp Lead only)
router.get('/camps/:campId/invites/template', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;
    
    // Check if user is camp account (user ID matches camp ID) or admin
    const isOwnCamp = req.user._id.toString() === campId.toString();
    const isAdmin = req.user.accountType === 'admin';
    
    if (!isOwnCamp && !isAdmin) {
      return res.status(403).json({ message: 'Access denied. Camp Lead role required.' });
    }
    
    // Get camp with invite templates
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }
    
    // Provide default templates if they don't exist
    const defaultEmailTemplate = "Hello! You've been personally invited to apply to join our camp, {{campName}}, for Burning Man. Click here to start your application: {{link}}";
    const defaultSMSTemplate = "You're invited to {{campName}}! Apply here: {{link}}";
    
    res.json({
      inviteTemplateEmail: camp.inviteTemplateEmail || defaultEmailTemplate,
      inviteTemplateSMS: camp.inviteTemplateSMS || defaultSMSTemplate
    });
    
  } catch (error) {
    console.error('Get invite templates error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/camps/:campId/invites/template
// @desc    Update invite templates for a camp
// @access  Private (Camp Lead only)
router.put('/camps/:campId/invites/template', 
  authenticateToken,
  [
    body('inviteTemplateEmail')
      .notEmpty()
      .withMessage('Email template is required')
      .contains('{{campName}}')
      .withMessage('Email template must contain {{campName}} placeholder')
      .contains('{{link}}')
      .withMessage('Email template must contain {{link}} placeholder'),
    body('inviteTemplateSMS')
      .notEmpty()
      .withMessage('SMS template is required')
      .contains('{{campName}}')
      .withMessage('SMS template must contain {{campName}} placeholder')
      .contains('{{link}}')
      .withMessage('SMS template must contain {{link}} placeholder')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { campId } = req.params;
      const { inviteTemplateEmail, inviteTemplateSMS } = req.body;
      
      // Check if user is camp account (user ID matches camp ID) or admin
      const isOwnCamp = req.user._id.toString() === campId.toString();
      const isAdmin = req.user.accountType === 'admin';
      
      if (!isOwnCamp && !isAdmin) {
        return res.status(403).json({ message: 'Access denied. Camp Lead role required.' });
      }
      
      // Update camp templates
      const updatedCamp = await db.updateCampById(campId, {
        inviteTemplateEmail,
        inviteTemplateSMS
      });
      
      if (!updatedCamp) {
        return res.status(404).json({ message: 'Camp not found' });
      }
      
      res.json({
        message: 'Invite templates updated successfully',
        inviteTemplateEmail: updatedCamp.inviteTemplateEmail,
        inviteTemplateSMS: updatedCamp.inviteTemplateSMS
      });
      
    } catch (error) {
      console.error('Update invite templates error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// @route   POST /api/invites
// @desc    Send invitations to recipients
// @access  Private (Members and Camp Leads)
router.post('/invites',
  authenticateToken,
  [
    body('recipients')
      .isArray({ min: 1 })
      .withMessage('At least one recipient is required'),
    body('recipients.*')
      .notEmpty()
      .withMessage('Recipient cannot be empty'),
    body('method')
      .isIn(['email', 'sms'])
      .withMessage('Method must be email or sms'),
    body('campId')
      .notEmpty()
      .withMessage('Camp ID is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { recipients, method, campId } = req.body;
      
      // Verify user has permission to send invites for this camp
      // Check if user is camp account (user ID matches camp ID) or admin
      const isOwnCamp = req.user._id.toString() === campId.toString();
      const isAdmin = req.user.accountType === 'admin';
      
      // Also check if user is a member or camp lead of this camp
      const campMember = await db.findMember({ 
        user: req.user._id, 
        camp: campId 
      });
      const isCampMember = campMember && ['member', 'camp-lead', 'project-lead'].includes(campMember.role);
      
      if (!isOwnCamp && !isAdmin && !isCampMember) {
        return res.status(403).json({ message: 'Access denied. Must be a camp member or lead to send invites.' });
      }
      
      // Get camp data for template
      const camp = await db.findCamp({ _id: campId });
      if (!camp) {
        return res.status(404).json({ message: 'Camp not found' });
      }
      
      const invitesSent = [];
      const sendErrors = [];
      
      for (const recipient of recipients) {
        try {
          // Generate secure token
          const token = crypto.randomBytes(32).toString('hex');
          
          // Create invite record
          const inviteData = {
            campId,
            senderId: req.user._id,
            recipient: recipient.trim(),
            method,
            token,
            status: 'pending'
          };
          
          // For mock database, we'll create a simplified invite record
          const invite = await db.createInvite(inviteData);
          
          // Generate invite link
          const inviteLink = `http://localhost:3000/apply?token=${token}`;
          
          // Get template and replace placeholders
          const defaultEmailTemplate = "Hello! You've been personally invited to apply to join our camp, {{campName}}, for Burning Man. Click here to start your application: {{link}}";
          const defaultSMSTemplate = "You're invited to {{campName}}! Apply here: {{link}}";
          
          const template = method === 'email' 
            ? (camp.inviteTemplateEmail || defaultEmailTemplate)
            : (camp.inviteTemplateSMS || defaultSMSTemplate);
            
          const message = template
            .replace(/\{\{campName\}\}/g, camp.name || camp.campName)
            .replace(/\{\{link\}\}/g, inviteLink);
          
          // Mock sending process - log to console
          console.log(`📧 ${method.toUpperCase()} INVITE SENT:`);
          console.log(`To: ${recipient}`);
          console.log(`From: ${req.user.firstName} ${req.user.lastName} (${camp.name || camp.campName})`);
          console.log(`Message: ${message}`);
          console.log(`Invite Link: ${inviteLink}`);
          console.log('---');
          
          // Update invite status to sent
          await db.updateInviteById(invite._id, { status: 'sent' });
          
          invitesSent.push({
            recipient,
            token,
            inviteLink,
            status: 'sent'
          });
          
        } catch (error) {
          console.error(`Error sending invite to ${recipient}:`, error);
          sendErrors.push({
            recipient,
            error: error.message
          });
        }
      }
      
      res.json({
        message: `Successfully sent ${invitesSent.length} invites`,
        invitesSent,
        errors: sendErrors.length > 0 ? sendErrors : undefined,
        summary: {
          total: recipients.length,
          sent: invitesSent.length,
          failed: sendErrors.length
        }
      });
      
    } catch (error) {
      console.error('Send invites error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// @route   GET /api/camps/:campId/invites
// @desc    Get all invites for a camp
// @access  Private (Camp Lead only)
router.get('/camps/:campId/invites', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;
    const { status } = req.query;
    
    // Check if user is camp account (user ID matches camp ID) or admin
    const isOwnCamp = req.user._id.toString() === campId.toString();
    const isAdmin = req.user.accountType === 'admin';
    
    if (!isOwnCamp && !isAdmin) {
      return res.status(403).json({ message: 'Access denied. Camp Lead role required.' });
    }
    
    // Build query
    const query = { campId };
    if (status) {
      query.status = status;
    }
    
    // Get invites with sender information
    const invites = await db.findInvites(query);
    
    // Populate sender information
    const populatedInvites = await Promise.all(invites.map(async (invite) => {
      const sender = await db.findUser({ _id: invite.senderId });
      return {
        ...invite,
        sender: sender ? {
          _id: sender._id,
          firstName: sender.firstName,
          lastName: sender.lastName,
          email: sender.email
        } : null
      };
    }));
    
    res.json({
      invites: populatedInvites,
      total: populatedInvites.length
    });
    
  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
