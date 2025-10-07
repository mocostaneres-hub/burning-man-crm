const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/databaseAdapter');
const { sendApplicationNotification } = require('../services/notifications');
const { getUserCampId, canAccessCamp } = require('../utils/permissionHelpers');

// Helper function to validate if personal profile is complete
const isPersonalProfileComplete = (user) => {
  if (user.accountType !== 'personal') {
    return true; // Not a personal account, no validation needed
  }

  const requiredFields = [
    'firstName',
    'lastName', 
    'phoneNumber',
    'city',
    'yearsBurned',
    'bio',
    'interestedInEAP',
    'interestedInStrike'
  ];

  // Check required fields
  for (const field of requiredFields) {
    if (typeof user[field] === 'boolean') {
      // Boolean fields are always valid (true or false)
      continue;
    } else if (field === 'yearsBurned') {
      // yearsBurned is valid if it's 0 (first burn) or any positive number
      if (typeof user[field] !== 'number' || user[field] < 0) {
        return false;
      }
    } else if (!user[field] || (typeof user[field] === 'string' && user[field].trim() === '')) {
      return false;
    }
  }

  // hasTicket and hasVehiclePass are optional (can be true, false, or null for "Not informed")
  // They don't need to be validated as required fields

  return true;
};

// @route   POST /api/applications/apply
// @desc    Apply to join a camp
// @access  Private (Personal accounts only)
router.post('/apply', authenticateToken, [
  body('campId').notEmpty().withMessage('Camp ID is required'),
  body('applicationData.motivation').notEmpty().isLength({ min: 10, max: 1000 }).withMessage('Motivation is required (10-1000 characters)'),
  body('applicationData.experience').optional().isLength({ max: 1000 }),
  body('applicationData.skills').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('❌ [Applications] Validation errors:', errors.array());
      return res.status(400).json({ message: errors.array()[0].msg, errors: errors.array() });
    }

    // Check if user has personal account
    if (req.user.accountType !== 'personal') {
      console.error('❌ [Applications] Wrong account type:', req.user.accountType);
      return res.status(403).json({ message: 'Only personal accounts can apply to camps' });
    }

    // Check if personal profile is complete
    if (!isPersonalProfileComplete(req.user)) {
      console.error('❌ [Applications] Incomplete profile for user:', req.user.email);
      console.error('User data:', JSON.stringify(req.user, null, 2));
      return res.status(400).json({ 
        message: 'Please complete your profile before applying to camps. Required fields: First Name, Last Name, Phone Number, City, Years Burned, Bio, and Burning Man Plans (Interested in Early Arrival/Strike Team).',
        incompleteProfile: true,
        redirectTo: '/user/profile'
      });
    }

    const { campId, applicationData } = req.body;

    // Check if camp exists and is accepting applications
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    if (!camp.acceptingNewMembers) {
      return res.status(400).json({ message: 'This camp is not currently accepting new members' });
    }

    // Check if user already applied to this camp (comprehensive check)
    // Allow re-application if previous application was deleted (roster removal reset)
    const existingApplication = await db.findMemberApplication({ 
      applicant: req.user._id, 
      camp: campId 
    });
    
    if (existingApplication && existingApplication.status !== 'deleted') {
      return res.status(400).json({ 
        message: 'You have already applied to this camp',
        applicationId: existingApplication._id,
        status: existingApplication.status,
        appliedAt: existingApplication.appliedAt,
        isDuplicate: true
      });
    }

    // Additional validation: Check if campId is valid and numeric
    if (!campId || isNaN(parseInt(campId))) {
      return res.status(400).json({ message: 'Invalid camp ID provided' });
    }

    // Determine initial status based on call slot selection
    let initialStatus = 'pending-orientation'; // Default when no call slot available
    if (applicationData.selectedCallSlotId) {
      initialStatus = 'call-scheduled'; // When call time is selected
    }

    // Create new application (with additional race condition protection)
    let application;
    try {
      application = await db.createMemberApplication({
        applicant: req.user._id,
        camp: campId,
        applicationData: {
          ...applicationData,
          skills: applicationData.skills || []
        },
        status: initialStatus
      });
    } catch (dbError) {
      // Handle race condition where duplicate was created between checks
      if (dbError.message === 'Application already exists for this user and camp') {
        const existingApplication = await db.findMemberApplication({ 
          applicant: req.user._id, 
          camp: campId 
        });
        return res.status(400).json({ 
          message: 'You have already applied to this camp',
          applicationId: existingApplication._id,
          status: existingApplication.status,
          appliedAt: existingApplication.appliedAt,
          isDuplicate: true
        });
      }
      throw dbError;
    }

    // Handle call slot booking if a slot was selected
    if (applicationData.selectedCallSlotId) {
      try {
        const callSlot = await db.findCallSlot({ _id: applicationData.selectedCallSlotId });
        if (callSlot) {
          // Increment currentParticipants and add to participants array
          const updatedParticipants = callSlot.currentParticipants + 1;
          const updatedIsAvailable = updatedParticipants < callSlot.maxParticipants;
          
          await db.updateCallSlot(applicationData.selectedCallSlotId, {
            currentParticipants: updatedParticipants,
            isAvailable: updatedIsAvailable,
            participants: [...(callSlot.participants || []), req.user._id]
          });
        }
      } catch (callSlotError) {
        console.error('Error updating call slot:', callSlotError);
        // Don't fail the application if call slot update fails
      }
    }

    // Update camp stats
    if (camp.stats) {
      camp.stats.totalApplications += 1;
    } else {
      camp.stats = { totalApplications: 1 };
    }
    await db.updateCamp(camp._id, { stats: camp.stats });

    // Send notification to camp
    await sendApplicationNotification(camp, req.user, application);

    res.status(201).json({
      message: 'Application submitted successfully',
      application: {
        _id: application._id,
        status: application.status,
        appliedAt: application.appliedAt
      }
    });

  } catch (error) {
    console.error('Apply to camp error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/applications/check/:campId
// @desc    Check if user has already applied to a specific camp
// @access  Private
router.get('/check/:campId', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;

    // Check if user already applied to this camp
    const existingApplication = await db.findMemberApplication({ 
      applicant: req.user._id, 
      camp: campId 
    });
    
    if (existingApplication) {
      return res.json({
        hasApplied: true,
        applicationId: existingApplication._id,
        status: existingApplication.status,
        appliedAt: existingApplication.appliedAt
      });
    }

    res.json({ hasApplied: false });

  } catch (error) {
    console.error('Check application status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/applications/my-applications
// @desc    Get current user's applications
// @access  Private
router.get('/my-applications', authenticateToken, async (req, res) => {
  try {
    const applications = await db.findMemberApplications({ applicant: req.user._id });
    
    // Populate camp details and flatten application data structure
    const applicationsWithCamps = await Promise.all(applications.map(async (app) => {
      const camp = await db.findCamp({ _id: app.camp });
      
      // Flatten the application data structure to match frontend expectations
      const flattenedAppData = {
        ...app.applicationData,
        arriveDate: app.applicationData.availability?.arriveDate || app.applicationData.arriveDate,
        departDate: app.applicationData.availability?.departDate || app.applicationData.departDate
      };
      
      return {
        ...app,
        applicationData: flattenedAppData,
        camp: camp ? {
          _id: camp._id,
          campName: camp.campName,
          theme: camp.theme,
          hometown: camp.hometown,
          photos: camp.photos,
          primaryPhotoIndex: camp.primaryPhotoIndex
        } : null
      };
    }));

    res.json({ applications: applicationsWithCamps });
  } catch (error) {
    console.error('Get my applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/applications/camp/:campId
// @desc    Get applications for a camp (camp admins only)
// @access  Private (Camp owners only)
router.get('/camp/:campId', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;
    
    // Check if camp exists and user is owner (Mongo ObjectId string)
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Check camp ownership using helper (immutable campId)
    const hasAccess = await canAccessCamp(req, campId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const applications = await db.findMemberApplications({ camp: campId });
    
    // Populate applicant details with comprehensive member information
    const applicationsWithApplicants = await Promise.all(applications.map(async (app) => {
      const applicant = await db.findUser({ _id: app.applicant });
      
      // Populate call slot details if selected
      let callSlotDetails = null;
      if (app.applicationData?.selectedCallSlotId) {
        const callSlot = await db.findCallSlot({ _id: app.applicationData.selectedCallSlotId });
        if (callSlot) {
          callSlotDetails = {
            date: callSlot.date,
            startTime: callSlot.startTime,
            endTime: callSlot.endTime
          };
        }
      }
      
      return {
        ...app,
        applicant: applicant ? {
          _id: applicant._id,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          email: applicant.email,
          profilePhoto: applicant.profilePhoto,
          bio: applicant.bio,
          playaName: applicant.playaName,
          // Additional member information
          city: applicant.city,
          yearsBurned: applicant.yearsBurned,
          previousCamps: applicant.previousCamps,
          socialMedia: applicant.socialMedia,
          hasTicket: applicant.hasTicket,
          hasVehiclePass: applicant.hasVehiclePass,
          arrivalDate: applicant.arrivalDate,
          departureDate: applicant.departureDate,
          interestedInEAP: applicant.interestedInEAP,
          interestedInStrike: applicant.interestedInStrike,
          skills: applicant.skills
        } : null,
        applicationData: {
          ...app.applicationData,
          callSlot: callSlotDetails
        }
      };
    }));

    // Debug: Log the applications data before sending
    console.log('🔍 [GET /api/applications/camp/:campId] Applications count:', applicationsWithApplicants.length);
    if (applicationsWithApplicants.length > 0) {
      console.log('🔍 [GET /api/applications/camp/:campId] First application:', JSON.stringify(applicationsWithApplicants[0], null, 2));
      if (applicationsWithApplicants[0].applicant) {
        console.log('🔍 [GET /api/applications/camp/:campId] First applicant data:', JSON.stringify(applicationsWithApplicants[0].applicant, null, 2));
        console.log('🔍 [GET /api/applications/camp/:campId] First applicant playaName:', applicationsWithApplicants[0].applicant.playaName);
      }
    }
    
    res.json({ applications: applicationsWithApplicants });
  } catch (error) {
    console.error('Get camp applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/applications/:applicationId/status
// @desc    Update application status (camp admins only)
// @access  Private (Camp owners only)
router.put('/:applicationId/status', authenticateToken, [
  body('status').isIn(['pending', 'call-scheduled', 'pending-orientation', 'under-review', 'approved', 'rejected', 'unresponsive']).withMessage('Invalid status'),
  body('reviewNotes').optional().trim().isLength({ max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { applicationId } = req.params;
    const { status, reviewNotes } = req.body;

    // Get application
    const application = await db.findMemberApplication({ _id: applicationId });
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if user is camp owner
    const camp = await db.findCamp({ _id: application.camp });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }
    
    const isCampOwner = camp.contactEmail === req.user.email || 
                        (req.user.campId && camp._id.toString() === req.user.campId.toString());
    const isAdminWithAccess = req.user.accountType === 'admin' && (
      (req.user.campId && camp._id.toString() === req.user.campId.toString()) ||
      (req.user.campId && camp._id.toString() === req.user.campId)
    );
    
    if (!isCampOwner && !isAdminWithAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update application
    const updateData = {
      status,
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || ''
    };

    const updatedApplication = await db.updateMemberApplication(applicationId, updateData);

    // If rejected, release the call slot
    if (status === 'rejected' && application.applicationData?.selectedCallSlotId) {
      try {
        const callSlot = await db.findCallSlot({ _id: application.applicationData.selectedCallSlotId });
        if (callSlot && callSlot.currentParticipants > 0) {
          // Decrement currentParticipants and remove from participants array
          const updatedParticipants = callSlot.currentParticipants - 1;
          const filteredParticipants = (callSlot.participants || []).filter(
            p => p.toString() !== application.applicant.toString()
          );
          
          await db.updateCallSlot(application.applicationData.selectedCallSlotId, {
            currentParticipants: updatedParticipants,
            isAvailable: true, // Always make available when releasing a slot
            participants: filteredParticipants
          });
        }
      } catch (callSlotError) {
        console.error('Error releasing call slot:', callSlotError);
        // Don't fail the status update if call slot release fails
      }
    }

    // If approved, create member record
    if (status === 'approved') {
      const memberData = {
        camp: application.camp,
        user: application.applicant,
        role: 'member',
        status: 'active',
        appliedAt: application.appliedAt,
        reviewedAt: new Date(),
        reviewedBy: req.user._id
      };
      
      const newMember = await db.createMember(memberData);
      
      // Add member to active roster if one exists
      const activeRoster = await db.findActiveRoster({ camp: camp._id });
      if (activeRoster) {
        await db.addMemberToRoster(activeRoster._id, newMember._id, req.user._id);
      }
      
      // Update camp member count
      if (camp.stats) {
        camp.stats.totalMembers += 1;
      } else {
        camp.stats = { totalMembers: 1 };
      }
      await db.updateCamp(camp._id, { stats: camp.stats });
    }

    res.json({
      message: 'Application status updated successfully',
      application: updatedApplication
    });

  } catch (error) {
    console.error('Update application status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/applications/:applicationId/message
// @desc    Send message in application thread
// @access  Private
router.post('/:applicationId/message', authenticateToken, [
  body('message').notEmpty().isLength({ min: 1, max: 2000 }).withMessage('Message is required (1-2000 characters)')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { applicationId } = req.params;
    const { message } = req.body;

    // Get application
    const application = await db.findMemberApplication({ _id: applicationId });
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check access
    const camp = await db.findCamp({ _id: application.camp });
    const isApplicant = application.applicant.toString() === req.user._id.toString();
    // Check camp ownership using helper
    const isCampOwner = camp && await canAccessCamp(req, camp._id);

    if (!isApplicant && !isCampOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Add message
    const newMessage = {
      from: isApplicant ? 'applicant' : 'camp',
      message,
      timestamp: new Date(),
      readBy: []
    };

    const updatedApplication = await db.updateMemberApplication(applicationId, {
      $push: { messages: newMessage }
    });

    res.json({
      message: 'Message sent successfully',
      application: updatedApplication
    });

  } catch (error) {
    console.error('Send application message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
