const express = require('express');
const { body, validationResult } = require('express-validator');
const Member = require('../models/Member');
const Camp = require('../models/Camp');
const { authenticateToken, requireCampMember, requireProjectLead } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/members/apply
// @desc    Apply to join a camp
// @access  Private (Personal accounts only)
router.post('/apply', authenticateToken, [
  body('campId').isMongoId(),
  body('applicationData').isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user has personal account
    if (req.user.accountType !== 'personal') {
      return res.status(403).json({ message: 'Only personal accounts can apply to camps' });
    }

    const { campId, applicationData } = req.body;
    const db = require('../database/databaseAdapter');

    // Check if camp exists and is recruiting
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    if (!camp.isRecruiting) {
      return res.status(400).json({ message: 'Camp is not currently recruiting' });
    }

    // Check if user already applied
    const existingApplication = await db.findMember({ 
      user: req.user._id, 
      camp: campId 
    });

    if (existingApplication) {
      return res.status(400).json({ message: 'Already applied to this camp' });
    }

    // Create application
    const memberData = {
      camp: campId,
      user: req.user._id,
      applicationData,
      status: camp.settings?.autoApprove ? 'active' : 'pending'
    };

    const member = await db.createMember(memberData);

    // Update camp stats
    if (camp.stats) {
      camp.stats.totalApplications += 1;
    } else {
      camp.stats = { totalApplications: 1 };
    }
    await db.updateCamp(camp._id, { stats: camp.stats });

    res.status(201).json({
      message: 'Application submitted successfully',
      member
    });

  } catch (error) {
    console.error('Apply to camp error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/members/my-applications
// @desc    Get user's applications
// @access  Private
router.get('/my-applications', authenticateToken, async (req, res) => {
  try {
    const db = require('../database/databaseAdapter');
    const members = await db.findManyMembers({ user: req.user._id });
    
    // Populate camp data for each member
    const applications = await Promise.all(members.map(async (member) => {
      const camp = await db.findCamp({ _id: member.camp });
      return {
        ...member,
        camp: camp ? {
          _id: camp._id,
          name: camp.name,
          description: camp.description,
          theme: camp.theme,
          photos: camp.photos
        } : null
      };
    }));

    res.json({ applications });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/members/:id/approve
// @desc    Approve or reject member application
// @access  Private (Camp lead or project lead)
router.put('/:id/approve', authenticateToken, [
  body('status').isIn(['active', 'rejected']),
  body('reviewNotes').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, reviewNotes } = req.body;

    const member = await Member.findById(req.params.id).populate('camp');
    if (!member) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check permissions
    const isCampLead = member.camp.contactEmail === req.user.email;
    const userMember = await Member.findOne({ 
      user: req.user._id, 
      camp: member.camp._id,
      role: { $in: ['camp-lead', 'project-lead'] },
      status: 'active'
    });

    if (!isCampLead && !userMember) {
      return res.status(403).json({ message: 'Not authorized to approve applications' });
    }

    // Update member status
    member.status = status;
    member.reviewedAt = new Date();
    member.reviewedBy = req.user._id;
    member.reviewNotes = reviewNotes;

    await member.save();

    // Update camp stats
    if (status === 'active') {
      member.camp.stats.totalMembers += 1;
      member.camp.stats.acceptanceRate = 
        (member.camp.stats.totalMembers / member.camp.stats.totalApplications) * 100;
    }
    await member.camp.save();

    res.json({
      message: `Application ${status} successfully`,
      member
    });

  } catch (error) {
    console.error('Approve application error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/members/:id/role
// @desc    Change member role
// @access  Private (Camp lead only)
router.put('/:id/role', authenticateToken, [
  body('newRole').isIn(['member', 'project-lead', 'camp-lead']),
  body('reason').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { newRole, reason } = req.body;

    const member = await Member.findById(req.params.id).populate('camp');
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Check if user is camp lead
    if (member.camp.contactEmail !== req.user.email) {
      return res.status(403).json({ message: 'Only camp leads can change roles' });
    }

    const oldRole = member.role;

    // Add to role history
    member.roleHistory.push({
      fromRole: oldRole,
      toRole: newRole,
      changedBy: req.user._id,
      reason,
      status: 'approved'
    });

    // Update role
    member.role = newRole;
    await member.save();

    res.json({
      message: 'Role updated successfully',
      member
    });

  } catch (error) {
    console.error('Change role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/members/:id/status
// @desc    Update member status (activate, deactivate, suspend)
// @access  Private (Camp lead or project lead)
router.put('/:id/status', authenticateToken, [
  body('status').isIn(['active', 'inactive', 'suspended']),
  body('reason').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, reason } = req.body;

    const member = await Member.findById(req.params.id).populate('camp');
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Check permissions
    const isCampLead = member.camp.contactEmail === req.user.email;
    const userMember = await Member.findOne({ 
      user: req.user._id, 
      camp: member.camp._id,
      role: { $in: ['camp-lead', 'project-lead'] },
      status: 'active'
    });

    if (!isCampLead && !userMember) {
      return res.status(403).json({ message: 'Not authorized to change member status' });
    }

    // Add note if reason provided
    if (reason) {
      member.notes.push({
        content: `Status changed to ${status}: ${reason}`,
        addedBy: req.user._id,
        isPrivate: true
      });
    }

    member.status = status;
    await member.save();

    res.json({
      message: 'Member status updated successfully',
      member
    });

  } catch (error) {
    console.error('Update member status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/members/:id/contributions
// @desc    Add contribution for member
// @access  Private (Camp lead or project lead)
router.post('/:id/contributions', authenticateToken, [
  body('type').isIn(['work-shift', 'resource', 'skill', 'financial', 'other']),
  body('title').trim().isLength({ min: 1 }),
  body('date').isISO8601(),
  body('hours').optional().isNumeric(),
  body('value').optional().isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const member = await Member.findById(req.params.id).populate('camp');
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Check permissions
    const isCampLead = member.camp.contactEmail === req.user.email;
    const userMember = await Member.findOne({ 
      user: req.user._id, 
      camp: member.camp._id,
      role: { $in: ['camp-lead', 'project-lead'] },
      status: 'active'
    });

    if (!isCampLead && !userMember) {
      return res.status(403).json({ message: 'Not authorized to add contributions' });
    }

    const contribution = {
      ...req.body,
      date: new Date(req.body.date),
      status: 'completed'
    };

    member.contributions.push(contribution);
    await member.save();

    res.status(201).json({
      message: 'Contribution added successfully',
      contribution: member.contributions[member.contributions.length - 1]
    });

  } catch (error) {
    console.error('Add contribution error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/members/:id
// @desc    Get member details
// @access  Private (Camp members only)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id)
      .populate('user', 'firstName lastName email profilePhoto accountType playaName')
      .populate('camp', 'name');

    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Check if user has access to this member
    const userMember = await Member.findOne({ 
      user: req.user._id, 
      camp: member.camp._id,
      status: 'active'
    });

    if (!userMember) {
      return res.status(403).json({ message: 'Not authorized to view this member' });
    }

    res.json({ member });
  } catch (error) {
    console.error('Get member error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
