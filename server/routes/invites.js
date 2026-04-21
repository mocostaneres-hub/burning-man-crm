const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const Camp = require('../models/Camp');
const Invite = require('../models/Invite');
const { authenticateToken, requireCampLead } = require('../middleware/auth');
const db = require('../database/databaseAdapter');
const { canAccessCamp, isCampLeadForCamp } = require('../utils/permissionHelpers');
const { sendInviteEmail } = require('../services/emailService');
const { recordActivity } = require('../services/activityLogger');

const router = express.Router();

/**
 * Resolve the mode of the active roster.
 *
 * Under the current product rules, a roster is strictly one of SOR or FMR —
 * there is no "mixed" state. The Mongoose schema enforces this via the
 * `rosterType` enum (see server/models/Roster.js). We therefore read that
 * field directly and treat anything else (missing / legacy / corrupt doc) as
 * 'none' rather than re-deriving it from member heuristics.
 */
const resolveRosterMode = (activeRoster) => {
  if (!activeRoster) return 'none';
  if (activeRoster.rosterType === 'shifts_only' || activeRoster.rosterType === 'full_membership') {
    return activeRoster.rosterType;
  }
  // Legacy / malformed roster — no reliable type. Surface a warning so a
  // migration can be triggered rather than silently guessing.
  console.warn(
    '⚠️  [resolveRosterMode] Active roster is missing a valid rosterType',
    { rosterId: activeRoster._id, rosterType: activeRoster.rosterType }
  );
  return 'none';
};

// @route   GET /api/invites/validate/:token
// @desc    Validate an invitation token for signup/apply flows
// @access  Public
router.get('/invites/validate/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ valid: false, message: 'Invitation token is required' });
    }

    const invite = await db.findInvite({ token });
    if (!invite) {
      return res.status(404).json({ valid: false, message: 'Invitation link is invalid' });
    }

    const isExpired = invite.expiresAt && new Date(invite.expiresAt) <= new Date();
    if (isExpired || invite.status === 'expired') {
      // Keep invite links valid after signup: extend expired invites instead of rejecting.
      await db.updateInviteById(invite._id, {
        status: invite.status === 'expired' ? 'sent' : invite.status,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      });
    }

    const camp = await db.findCamp({ _id: invite.campId });
    if (!camp) {
      return res.status(404).json({ valid: false, message: 'Camp not found for this invitation' });
    }

    const campSlug = camp.slug || camp.urlSlug || camp.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    return res.json({
      valid: true,
      campId: invite.campId,
      campSlug,
      inviteToken: token,
      inviteType: invite.inviteType || 'standard',
      signupSource: invite.signupSource || 'standard_invite',
      isShiftsOnlyInvite: (invite.inviteType || 'standard') === 'shifts_only',
      memberId: invite.memberId || null
    });
  } catch (error) {
    console.error('Validate invite token error:', error);
    res.status(500).json({ valid: false, message: 'Server error validating invitation token' });
  }
});

// @route   GET /api/camps/:campId/invites/template
// @desc    Get invite templates for a camp
// @access  Private (Any authenticated camp member can read)
router.get('/camps/:campId/invites/template', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;
    
    // Check if user is system admin
    const Admin = require('../models/Admin');
    const admin = await Admin.findOne({ user: req.user._id, isActive: true });
    const isSystemAdmin = !!admin;
    
    // Check if user is camp owner (canAccessCamp)
    const isCampOwner = await canAccessCamp(req, campId);
    
    // Check if user is Camp Lead for this camp (from roster membership)
    const isCampLead = await isCampLeadForCamp(req, campId);
    
    // Check for Camp Admin (camp-lead role in roster) or roster member
    const db = require('../database/databaseAdapter');
    let isCampAdmin = false;
    let isRosterMember = false;
    
    if (!isSystemAdmin && !isCampOwner && !isCampLead) {
      // Check for Camp Admin (camp-lead role) - can be any status, not just active
      const campLead = await db.findMember({
        user: req.user._id,
        camp: campId,
        role: 'camp-lead'
        // No status filter - Camp Admin access doesn't require active status
      });
      isCampAdmin = !!campLead;
      
      // Also check for any roster member (for other users who should have access)
      if (!isCampAdmin) {
        const member = await db.findMember({
          user: req.user._id,
          camp: campId,
          status: 'active'
        });
        isRosterMember = !!member;
      }
    }
    
    const hasAccess = isSystemAdmin || isCampOwner || isCampLead || isCampAdmin || isRosterMember;
    
    if (!hasAccess) {
      console.log(`❌ [Templates] Access denied for user ${req.user._id}, not authorized for camp ${campId}`);
      console.log(`   isSystemAdmin: ${isSystemAdmin}, isCampOwner: ${isCampOwner}, isCampLead: ${isCampLead}, isCampAdmin: ${isCampAdmin}, isRosterMember: ${isRosterMember}`);
      return res.status(403).json({ message: 'Camp owner, Camp Lead, or camp member access required' });
    }
    
    console.log(`✅ [Templates] Access granted for campId: ${campId}, isSystemAdmin: ${isSystemAdmin}, isCampOwner: ${isCampOwner}, isCampLead: ${isCampLead}, isCampAdmin: ${isCampAdmin}, isRosterMember: ${isRosterMember}`);
    
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
      
      // Check if user can access this specific camp as owner/admin-with-campId.
      const isCampOwner = await canAccessCamp(req, campId);
      const isCampLead = await isCampLeadForCamp(req, campId);
      
      // Check if user is system admin
      const Admin = require('../models/Admin');
      const admin = await Admin.findOne({ user: req.user._id, isActive: true });
      const isSystemAdmin = !!admin;
      
      if (!isCampOwner && !isCampLead && !isSystemAdmin) {
        console.log(`❌ [Template Update] Access denied for user ${req.user._id}, accountType: ${req.user.accountType}, requested campId: ${campId}`);
        return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
      }
      
      console.log(`✅ [Template Update] Access granted for campId: ${campId}, accountType: ${req.user.accountType}, isCampOwner: ${isCampOwner}, isCampLead: ${isCampLead}, isSystemAdmin: ${isSystemAdmin}`);
      
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
      
      // Verify user has permission to send invites for this camp.
      // Use shared permission helpers so camp ownership is resolved via campId,
      // not by comparing user._id directly to campId.
      const isCampOwner = await canAccessCamp(req, campId);
      const isAdmin = req.user.accountType === 'admin';
      const isCampLead = await isCampLeadForCamp(req, campId);
      
      // Also check if user is a member or camp lead of this camp (for roster members)
      const campMember = await db.findMember({ 
        user: req.user._id, 
        camp: campId 
      });
      const isCampMember = campMember && ['member', 'camp-lead', 'project-lead'].includes(campMember.role);
      
      if (!isCampOwner && !isAdmin && !isCampLead && !isCampMember) {
        console.log('❌ [SEND INVITES] Access denied:', { 
          userId: req.user._id, 
          campId, 
          isCampOwner, 
          isAdmin, 
          isCampLead,
          isCampMember
        });
        return res.status(403).json({ message: 'Camp owner, Camp Lead, or camp member access required' });
      }
      
      console.log('✅ [SEND INVITES] Access granted:', { isCampOwner, isAdmin, isCampLead, isCampMember });
      
      // Get camp data for template
      const camp = await db.findCamp({ _id: campId });
      if (!camp) {
        return res.status(404).json({ message: 'Camp not found' });
      }

      const activeRoster = await db.findActiveRoster({ camp: campId });
      const rosterMode = resolveRosterMode(activeRoster);
      if (rosterMode === 'shifts_only') {
        return res.status(409).json({
          message: 'Full-membership invites are unavailable while a shifts-only roster is active. Archive the current roster first to return to roster-less mode.'
        });
      }
      
      const invitesSent = [];
      const sendErrors = [];
      const existingInvites = await db.findInvites({ campId });
      const existingRecipients = new Set(
        existingInvites
          .map((invite) => (invite?.recipient || '').toString().trim().toLowerCase())
          .filter(Boolean)
      );
      
      for (const recipient of recipients) {
        try {
          const normalizedRecipient = recipient.trim().toLowerCase();

          if (!normalizedRecipient) {
            sendErrors.push({
              recipient,
              error: 'Recipient cannot be empty'
            });
            continue;
          }

          // Prevent duplicate invites for the same camp/email.
          if (existingRecipients.has(normalizedRecipient)) {
            sendErrors.push({
              recipient: normalizedRecipient,
              error: 'An invite already exists for this recipient'
            });
            continue;
          }

          // Generate secure token
          const token = crypto.randomBytes(32).toString('hex');
          
          // Create invite record
          const inviteData = {
            campId,
            senderId: req.user._id,
            recipient: normalizedRecipient,
            method,
            token,
            status: 'pending'
          };
          
          // For mock database, we'll create a simplified invite record
          const invite = await db.createInvite(inviteData);
          
          // ============================================================================
          // Generate invite link using CLIENT_URL environment variable
          // ============================================================================
          // CRITICAL: This link is sent via email to external recipients.
          // It MUST use the correct environment-based URL, never localhost in production.
          // 
          // The link points to the camp profile page with an invite token parameter.
          // Format: https://www.g8road.com/camps/:campSlug?invite=<token>
          // 
          // Environment-aware URL ensures:
          // - Local development: http://localhost:3000
          // - Production: https://www.g8road.com
          // - Future mobile: Deep link support (g8road://camps/...)
          // ============================================================================
          
          const clientUrl = process.env.CLIENT_URL;
          
          // Enforce CLIENT_URL configuration - fail loudly if missing
          if (!clientUrl) {
            console.error('❌ [CRITICAL] CLIENT_URL environment variable is not set!');
            console.error('❌ Cannot send invitation emails without CLIENT_URL');
            console.error('❌ Set CLIENT_URL in your environment:');
            console.error('   - Development: CLIENT_URL=http://localhost:3000');
            console.error('   - Production: CLIENT_URL=https://www.g8road.com');
            throw new Error('CLIENT_URL environment variable is required for invitation links');
          }
          
          // Warn if localhost is used in production
          if (process.env.NODE_ENV === 'production' && clientUrl.includes('localhost')) {
            console.error('❌ [CRITICAL] CLIENT_URL is set to localhost in production!');
            console.error('❌ Invitation emails will have broken links!');
            console.error('❌ Update CLIENT_URL to your production domain: https://www.g8road.com');
          }
          
          const campSlug = camp.slug || camp.urlSlug || camp.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          const inviteLink = `${clientUrl}/apply?invite_token=${token}`;
          
          // Get template and replace placeholders
          const defaultEmailTemplate = "Hello! You've been personally invited to apply to join our camp, {{campName}}, for Burning Man. Click here to start your application: {{link}}";
          const defaultSMSTemplate = "You're invited to {{campName}}! Apply here: {{link}}";
          
          const template = method === 'email' 
            ? (camp.inviteTemplateEmail || defaultEmailTemplate)
            : (camp.inviteTemplateSMS || defaultSMSTemplate);
            
          const message = template
            .replace(/\{\{campName\}\}/g, camp.name || camp.campName)
            .replace(/\{\{link\}\}/g, inviteLink);
          
          // Send email invitation if method is email
          if (method === 'email') {
            try {
              // Get sender information for email
              const sender = await db.findUser({ _id: req.user._id });
              
              // Send email using the email service
              await sendInviteEmail(
                normalizedRecipient,
                camp,
                sender,
                inviteLink,
                message // Pass the custom message from template (placeholders already replaced)
              );
              
              console.log(`✅ Email invitation sent to ${normalizedRecipient}`);
              console.log(`📧 [INVITE] Created invite with ID: ${invite._id}, campId: ${campId}, recipient: ${normalizedRecipient}`);
              
              // Update invite status to sent
              await db.updateInviteById(invite._id, { status: 'sent' });
              
              // Add to successful invites list
              invitesSent.push({
                recipient: normalizedRecipient,
                token,
                inviteLink,
                status: 'sent'
              });
              existingRecipients.add(normalizedRecipient);
            } catch (emailError) {
              console.error(`❌ Error sending email invitation to ${recipient}:`, emailError);
              // Don't fail the entire request, but mark this invite as failed
              await db.updateInviteById(invite._id, { status: 'pending' });
              throw emailError; // Re-throw to be caught by outer catch block
            }
          } else {
            // SMS method - log for now (SMS integration can be added later)
            console.log(`📱 SMS INVITE (not implemented yet):`);
            console.log(`To: ${recipient}`);
            console.log(`From: ${req.user.firstName} ${req.user.lastName} (${camp.name || camp.campName})`);
            console.log(`Message: ${message}`);
            console.log(`Invite Link: ${inviteLink}`);
            console.log('---');
            
            // Update invite status to sent (even though SMS isn't implemented)
            await db.updateInviteById(invite._id, { status: 'sent' });
            
            // Add to successful invites list (SMS is considered "sent" even though not actually sent)
            invitesSent.push({
              recipient: normalizedRecipient,
              token,
              inviteLink,
              status: 'sent'
            });
            existingRecipients.add(normalizedRecipient);
          }
          
        } catch (error) {
          console.error(`Error sending invite to ${recipient}:`, error);
          sendErrors.push({
            recipient,
            error: error.message
          });
        }
      }
      
      // Log invitation sending for CAMP
      // Create comma-separated list of email addresses
      const emailList = invitesSent.map(inv => inv.recipient).join(', ');
      
      if (invitesSent.length > 0) {
        await db.updateCampById(campId, { invitesSentAt: new Date() });
        await recordActivity('CAMP', campId, req.user._id, 'COMMUNICATION_SENT', {
          field: 'emails',
          emails: emailList,
          method: method,
          count: invitesSent.length,
          campName: camp.name || camp.campName
        });
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
// @access  Private (Camp owners and Camp Leads)
router.get('/camps/:campId/invites', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;
    const { status } = req.query;
    
    // Check if user can access this specific camp as owner/admin-with-campId.
    const isCampOwner = await canAccessCamp(req, campId);
    
    // Check if user is system admin
    const Admin = require('../models/Admin');
    const admin = await Admin.findOne({ user: req.user._id, isActive: true });
    const isSystemAdmin = !!admin;
    
    // Check if user is a Camp Lead for this camp (from roster membership)
    const isCampLead = await isCampLeadForCamp(req, campId);
    
    // Check for Camp Admin (camp-lead role) - can be any status, not just active
    const campLead = await db.findMember({
      user: req.user._id,
      camp: campId,
      role: 'camp-lead'
    });
    const isCampAdmin = !!campLead;
    
    if (!isCampOwner && !isSystemAdmin && !isCampLead && !isCampAdmin) {
      console.log('❌ [GET INVITES] Access denied:', { 
        userId: req.user._id, 
        campId, 
        isCampOwner, 
        isSystemAdmin,
        isCampLead,
        isCampAdmin
      });
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }
    
    console.log('✅ [GET INVITES] Access granted:', { isCampOwner, isSystemAdmin, isCampLead, isCampAdmin });
    
    // Build query
    const query = { campId };
    if (status) {
      query.status = status;
    }
    
    console.log(`🔍 [GET INVITES] Fetching invites for campId: ${campId}, query:`, query);
    
    // Get invites with sender information (already populated and converted to plain objects with .lean())
    const invites = await db.findInvites(query);
    
    console.log(`📊 [GET INVITES] Found ${invites.length} invites for camp ${campId}`);
    if (invites.length > 0) {
      console.log(`📝 [GET INVITES] Sample invite structure:`, JSON.stringify(invites[0], null, 2));
    }
    
    // Map invites to correct format (senderId is already populated)
    const formattedInvites = invites.map(invite => ({
      ...invite,
      sender: invite.senderId // senderId is already populated with user info
    }));
    
    res.json({
      invites: formattedInvites,
      total: formattedInvites.length
    });
    
  } catch (error) {
    console.error('Get invites error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
