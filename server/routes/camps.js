const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireCampLead, optionalAuth } = require('../middleware/auth');
const db = require('../database/databaseAdapter');
const { getUserCampId, canAccessCamp } = require('../utils/permissionHelpers');

// (moved below after router initialization)

// Configure multer for photo uploads (memory storage for mock)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const router = express.Router();

// @route   GET /api/camps
// @desc    Get all public camps (with optional filtering)
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      location,
      theme,
      size,
      recruiting
    } = req.query;

    const query = {
      status: 'active',
      isPublic: true
    };

    // Add search filters
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { theme: { $regex: search, $options: 'i' } }
      ];
    }

    if (location) {
      query['location.city'] = { $regex: location, $options: 'i' };
    }

    if (theme) {
      query.theme = { $regex: theme, $options: 'i' };
    }

    if (size) {
      query.campSize = size;
    }

    if (recruiting === 'true') {
      query.isRecruiting = true;
    }

    console.log('🏕️ [Backend] GET /api/camps - Query:', JSON.stringify(query));
    console.log('🏕️ [Backend] Pagination: page', page, 'limit', limit);
    
    const camps = await db.findAllCamps(query, { 
      sort: { createdAt: -1 }, 
      limit: limit * 1, 
      skip: (page - 1) * limit 
    });

    const total = await db.countCamps(query);
    
    // Format camps data for frontend
    const formattedCamps = camps.map(camp => {
      // Convert Mongoose document to plain object
      const campObj = camp.toObject ? camp.toObject() : camp;
      
      const processedPhotos = campObj.photos && campObj.photos.length > 0 
        ? campObj.photos.map(photo => typeof photo === 'string' ? photo : photo.url).filter(Boolean)
        : (campObj.heroPhoto?.url ? [campObj.heroPhoto.url] : []);
      
      return {
        ...campObj,
        campName: campObj.name, // Frontend expects campName
        photos: processedPhotos,
        primaryPhotoIndex: Math.min(campObj.primaryPhotoIndex || 0, Math.max(0, processedPhotos.length - 1))
      };
    });
    
    console.log('🏕️ [Backend] Found', formattedCamps.length, 'camps out of', total, 'total');
    console.log('🏕️ [Backend] First camp:', formattedCamps[0]?.campName);
    console.log('🏕️ [Backend] First camp photos:', formattedCamps[0]?.photos);
    console.log('🏕️ [Backend] Sending response with', formattedCamps.length, 'camps');

    res.json({
      camps: formattedCamps,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Get camps error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// 360 Contact Aggregation
// @route   GET /api/camps/:campId/contacts/:userId
// @desc    Aggregate a user's profile, roster history, applications, tasks, and volunteer shifts for a camp
// @access  Private (camp_lead only)
router.get('/:campId/contacts/:userId', authenticateToken, requireCampLead, async (req, res) => {
  try {
    const { campId, userId } = req.params;

    const hasAccess = await canAccessCamp(req, campId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await db.findUser({ _id: userId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Resolve the Member document(s) for this user within this camp
    const memberDocs = await db.findMembers({ camp: campId, user: userId });
    const memberIds = (memberDocs || []).map(m => m._id?.toString());

    console.log('🔍 [360 Contact] User ID:', userId);
    console.log('🔍 [360 Contact] Camp ID:', campId);
    console.log('🔍 [360 Contact] Member docs found:', memberDocs?.length || 0);
    console.log('🔍 [360 Contact] Member IDs:', memberIds);

    let rosterEntries = [];
    if (memberIds.length > 0) {
      // Find rosters that contain these member IDs
      const rosters = await db.findRosters({ camp: campId, 'members.member': { $in: memberIds } });
      console.log('🔍 [360 Contact] Rosters found:', rosters?.length || 0);
      
      for (const roster of rosters || []) {
        const entry = (roster.members || []).find(m => memberIds.includes(m?.member?.toString?.()));
        if (entry) {
          // Check if there's a related application
          const relatedApp = await db.findMemberApplication({ applicant: userId, camp: campId, status: 'approved' });
          
          rosterEntries.push({
            rosterId: roster._id,
            name: roster.name,
            joinedAt: entry.joinedAt || entry.addedAt || roster.createdAt,
            addedAt: entry.addedAt,
            duesStatus: entry.duesStatus || 'Unpaid',
            overrides: entry.overrides || null,
            addedVia: relatedApp ? 'application' : 'manual',
            addedBy: entry.addedBy
          });
        }
      }
    }

    // Get all applications with populated action history
    const applications = await db.findMemberApplications({ applicant: userId, camp: campId });
    console.log('🔍 [360 Contact] Applications found:', applications?.length || 0);
    if (applications && applications.length > 0) {
      console.log('🔍 [360 Contact] First application structure:', {
        hasDoc: !!applications[0]._doc,
        hasActionHistory: !!applications[0].actionHistory,
        actionHistoryLength: applications[0].actionHistory?.length || 0,
        status: applications[0].status || applications[0]._doc?.status
      });
    }
    
    // Convert Mongoose documents to plain objects and populate action history with user details
    const applicationsWithHistory = await Promise.all((applications || []).map(async (app) => {
      // Convert Mongoose document to plain object
      const plainApp = app._doc ? {
        ...app._doc,
        applicant: app.applicant,
        applicationData: app.applicationData
      } : app;
      
      const populatedHistory = await Promise.all((plainApp.actionHistory || []).map(async (action) => {
        const performer = await db.findUser({ _id: action.performedBy });
        return {
          ...action,
          performedBy: {
            _id: action.performedBy,
            firstName: performer?.firstName,
            lastName: performer?.lastName,
            email: performer?.email
          }
        };
      }));
      
      return {
        ...plainApp,
        actionHistory: populatedHistory.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      };
    }));
    const tasks = await db.findTasks({ campId: campId, assignedTo: { $in: [userId] } });

    const events = await db.findEvents({ camp: campId });
    const volunteerShifts = [];
    for (const ev of events || []) {
      for (const shift of ev.shifts || []) {
        const memberIds = shift.memberIds || [];
        if (memberIds.map(id => id.toString()).includes(userId.toString())) {
          volunteerShifts.push({
            eventId: ev._id,
            eventName: ev.name,
            shiftId: shift._id,
            title: shift.title,
            date: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime
          });
        }
      }
    }

    res.json({
      user,
      rosterHistory: rosterEntries
        .sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt))
        .map(e => ({ ...e, year: e.joinedAt ? new Date(e.joinedAt).getFullYear() : null })),
      applications: applicationsWithHistory || [],
      tasks: tasks || [],
      volunteerShifts
    });
  } catch (error) {
    console.error('Contact aggregation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/camps/public/:slug
// @desc    Get public camp profile by slug
// @access  Public
router.get('/public/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Find camp by slug or ID (fallback)
    let camp = await db.findCamp({ slug });
    if (!camp) {
      // If not found by slug, try by ID (fallback for null slugs)
      camp = await db.findCamp({ _id: slug });
    }
    
    console.log('🔍 [GET /api/camps/public/:slug] Raw camp from DB:', JSON.stringify(camp, null, 2));
    console.log('🔍 [GET /api/camps/public/:slug] Camp name field:', camp?.name);
    console.log('🔍 [GET /api/camps/public/:slug] Camp photos field:', camp?.photos);
    console.log('🔍 [GET /api/camps/public/:slug] Camp heroPhoto field:', camp?.heroPhoto);
    console.log('🔍 [GET /api/camps/public/:slug] Camp isPublic field:', camp?.isPublic);
    console.log('🔍 [GET /api/camps/public/:slug] Camp slug:', camp?.slug);
    
    if (!camp) {
      console.log('❌ [GET /api/camps/public/:slug] Camp not found for slug:', slug);
      return res.status(404).json({ message: 'Camp not found or not public' });
    }
    
    // Check if camp is public (or make it public if it's the owner's camp)
    if (!camp.isPublic) {
      console.log('❌ [GET /api/camps/public/:slug] Camp is not public:', camp.name, 'isPublic:', camp.isPublic);
      return res.status(404).json({ message: 'Camp not found or not public' });
    }

    // Get camp members (only basic info for public view)
    const members = await db.findManyMembers({ camp: camp._id, status: 'active' });
    
    // Process photos array
    const processedPhotos = camp.photos && camp.photos.length > 0 
      ? camp.photos.map(photo => typeof photo === 'string' ? photo : photo.url).filter(Boolean)
      : (camp.heroPhoto?.url ? [camp.heroPhoto.url] : []);
    
    // Populate selectedPerks with offering data
    const populatedPerks = camp.selectedPerks && camp.selectedPerks.length > 0 ?
      await Promise.all(camp.selectedPerks.map(async (perk) => {
        const offering = await db.findGlobalPerk({ _id: perk.perkId });
        return {
          ...perk,
          offering: offering || null
        };
      })) : [];
    
    // Return public camp data with members
    const publicCamp = {
      ...camp,
      campName: camp.name, // Frontend expects campName
      photos: processedPhotos,
      primaryPhotoIndex: Math.min(camp.primaryPhotoIndex || 0, Math.max(0, processedPhotos.length - 1)),
      selectedPerks: populatedPerks,
      members: members.map(member => ({
        _id: member._id,
        firstName: member.firstName,
        lastName: member.lastName,
        profilePhoto: member.profilePhoto,
        bio: member.bio,
        skills: member.skills
      }))
    };

    console.log('🔍 [GET /api/camps/public/:slug] Camp name:', publicCamp.campName);
    console.log('🔍 [GET /api/camps/public/:slug] Camp photos:', publicCamp.photos);
    console.log('🔍 [GET /api/camps/public/:slug] Primary photo index:', publicCamp.primaryPhotoIndex);

    res.json(publicCamp);
  } catch (error) {
    console.error('Get public camp profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/camps/my-camp
// @desc    Get current user's camp profile
// @access  Private (Camp owners only)
router.get('/my-camp', authenticateToken, async (req, res) => {
  try {
    // Use campId if available, otherwise fall back to contactEmail
    let camp;
    if (req.user.campId) {
      camp = await db.findCamp({ _id: req.user.campId });
    } else {
      camp = await db.findCamp({ contactEmail: req.user.email });
    }
    
    if (!camp) {
      return res.status(404).json({ message: 'Camp profile not found' });
    }
    
    // Convert Mongoose document to plain object if needed
    const campResponse = camp.toObject ? camp.toObject() : camp;
    res.json(campResponse);
  } catch (error) {
    console.error('Get my camp error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/camps/:id
// @desc    Get single camp by ID or slug
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to find by ID first, then by slug
    let camp = await db.findCamp({ _id: id });
    if (!camp) {
      camp = await db.findCamp({ slug: id });
    }

    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Check if camp is public or user has access
    if (!camp.isPublic && (!req.user || camp.contactEmail !== req.user.email)) {
      return res.status(403).json({ message: 'Camp not accessible' });
    }

    // Process photos array
    const processedPhotos = camp.photos && camp.photos.length > 0 
      ? camp.photos.map(photo => typeof photo === 'string' ? photo : photo.url).filter(Boolean)
      : (camp.heroPhoto?.url ? [camp.heroPhoto.url] : []);
    
    // Populate categories
    const populatedCategories = camp.categories ? 
      await Promise.all(camp.categories.map(async (categoryId) => {
        return await db.findCampCategory({ _id: categoryId });
      })) : [];
    
    // Format camp data for frontend
    const formattedCamp = {
      ...camp,
      campName: camp.name, // Frontend expects campName
      photos: processedPhotos,
      primaryPhotoIndex: Math.min(camp.primaryPhotoIndex || 0, Math.max(0, processedPhotos.length - 1)),
      categories: populatedCategories
    };

    console.log('🔍 [GET /api/camps/:id] Camp photos:', formattedCamp.photos);
    console.log('🔍 [GET /api/camps/:id] Primary photo index:', formattedCamp.primaryPhotoIndex);

    res.json({ camp: formattedCamp });
  } catch (error) {
    console.error('Get camp error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/camps
// @desc    Create a new camp
// @access  Private (Camp account required)
router.post('/', authenticateToken, [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('description').optional().trim().isLength({ min: 10, max: 2000 }),
  body('theme').optional().trim(),
  body('location.city').optional().trim(),
  body('location.state').optional().trim(),
  body('contactEmail').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user has camp account
    if (req.user.accountType !== 'camp') {
      return res.status(403).json({ message: 'Only camp accounts can create camps' });
    }

    // Check if user already has a camp
    const existingCamp = await db.findCamp({ contactEmail: req.user.email });
    if (existingCamp) {
      return res.status(400).json({ message: 'User already has a camp' });
    }

    const campData = {
      ...req.body,
      contactEmail: req.user.email,
      description: req.body.description || `Welcome to ${req.body.name}! We're excited to share our camp experience with you.` // Provide default description if none given
    };

    const camp = await db.createCamp(campData);

    // Create camp lead membership
    const memberData = {
      camp: camp._id,
      user: req.user._id,
      role: 'camp-lead',
      status: 'active',
      appliedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: req.user._id
    };
    await db.createMember(memberData);

    // Get owner data
    const owner = await db.findUser({ _id: camp.owner });

    res.status(201).json({
      message: 'Camp created successfully',
      camp: {
        ...camp,
        owner: owner ? {
          _id: owner._id,
          campName: owner.campName,
          email: owner.email
        } : null
      }
    });

  } catch (error) {
    console.error('Create camp error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Camp name already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/camps/my-camp/public
// @desc    Toggle public status of current user's camp
// @access  Private (Camp owners only)
router.put('/my-camp/public', authenticateToken, async (req, res) => {
  try {
    // Get camp ID using immutable identifier
    const campId = await getUserCampId(req);
    if (!campId) {
      return res.status(404).json({ message: 'Camp profile not found' });
    }

    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp profile not found' });
    }
    
    // Toggle public status using campId
    const updatedCamp = await db.updateCamp(
      { _id: campId }, 
      { isPublic: !camp.isPublic }
    );
    
    res.json(updatedCamp);
  } catch (error) {
    console.error('Toggle camp public status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/camps/make-all-public
// @desc    Make all existing camps public (admin utility)
// @access  Private
router.post('/make-all-public', authenticateToken, async (req, res) => {
  try {
    const allCamps = await db.findCamps({});
    let updatedCount = 0;
    
    for (const camp of allCamps) {
      if (!camp.isPublic) {
        await db.updateCamp({ _id: camp._id }, { isPublic: true });
        updatedCount++;
      }
    }
    
    res.json({ 
      message: `Made ${updatedCount} camps public`,
      totalCamps: allCamps.length,
      updatedCount 
    });
  } catch (error) {
    console.error('Make all camps public error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/camps/my-camp
// @desc    Update current user's camp profile
// @access  Private (Camp owners only)
router.put('/my-camp', authenticateToken, [
  body('campName').optional().notEmpty().withMessage('Camp name cannot be empty'),
  body('contactEmail').optional().isEmail().withMessage('Valid contact email is required'),
  body('contactPhone').optional().trim().isMobilePhone().withMessage('Valid phone number is required'),
  body('burningSince').optional().isInt({ min: 1985, max: new Date().getFullYear() }).withMessage('Invalid burning since year'),
  body('approximateSize').optional().isInt({ min: 1, max: 1000 }).withMessage('Approximate size must be between 1 and 1000'),
  body('hometown').optional().trim(),
  body('website').optional().isURL().withMessage('Invalid website URL'),
  body('theme').optional().trim().isLength({ max: 100 }).withMessage('Theme must be less than 100 characters'),
  body('socialMedia.facebook').optional().isURL(),
  body('socialMedia.instagram').optional().isURL()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };

    // Try to find existing camp first
    let camp = await db.findCamp({ owner: req.user._id });
    
    if (!camp) {
      // Create new camp profile if it doesn't exist
      const newCampData = {
        ...updateData,
        contactEmail: req.user.email,
        slug: req.body.campName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        status: 'active',
        isPublic: true // Default to public so profiles are viewable
      };
      
      camp = await db.createCamp(newCampData);
      return res.json(camp);
    } else {
      // Update existing camp using campId
      const campId = await getUserCampId(req);
      if (!campId) {
        return res.status(404).json({ message: 'Camp not found' });
      }
      camp = await db.updateCamp({ _id: campId }, updateData);
      return res.json(camp);
    }
  } catch (error) {
    console.error('Update camp profile error:', error);
    res.status(500).json({ message: 'Server error updating camp profile', error: error.message });
  }
});

// @route   PUT /api/camps/:id
// @desc    Update camp
// @access  Private (Camp lead or admin)
router.put('/:id', authenticateToken, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('description').optional().trim().isLength({ min: 10, max: 2000 }),
  body('contactEmail').optional().isEmail().normalizeEmail()
], async (req, res) => {
  try {
    console.log('🔍 [PUT /api/camps/:id] Update camp request');
    console.log('🔍 [PUT /api/camps/:id] Camp ID:', req.params.id);
    console.log('🔍 [PUT /api/camps/:id] User:', { _id: req.user._id, accountType: req.user.accountType, campId: req.user.campId });
    console.log('🔍 [PUT /api/camps/:id] Update data keys:', Object.keys(req.body));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ [PUT /api/camps/:id] Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const camp = await db.findCamp({ _id: req.params.id });
    if (!camp) {
      console.log('❌ [PUT /api/camps/:id] Camp not found');
      return res.status(404).json({ message: 'Camp not found' });
    }
    
    console.log('🔍 [PUT /api/camps/:id] Camp found:', { _id: camp._id, name: camp.name, owner: camp.owner });

    // Check permissions
    // Check camp ownership using helper
    const isOwner = await canAccessCamp(req, camp._id);
    console.log('🔍 [PUT /api/camps/:id] Is owner?', isOwner);
    
    const isAdmin = await db.findMember({ 
      user: req.user._id, 
      camp: camp._id, 
      role: 'camp-lead',
      status: 'active'
    });
    console.log('🔍 [PUT /api/camps/:id] Is camp-lead?', !!isAdmin);

    if (!isOwner && !isAdmin) {
      console.log('❌ [PUT /api/camps/:id] Not authorized');
      return res.status(403).json({ message: 'Not authorized to update this camp' });
    }

    // Update camp (allow selectedPerks passthrough)
    const updatedCamp = await db.updateCamp({ _id: camp._id }, req.body);
    console.log('✅ [PUT /api/camps/:id] Camp updated successfully');

    // Get owner info
    const owner = await db.findUser({ _id: camp.owner });

    res.json({
      message: 'Camp updated successfully',
      camp: {
        ...updatedCamp,
        owner: owner ? {
          _id: owner._id,
          campName: owner.campName,
          email: owner.email
        } : null
      }
    });

  } catch (error) {
    console.error('❌ [PUT /api/camps/:id] Update camp error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/camps/:id
// @desc    Delete camp
// @access  Private (Camp owner only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const camp = await db.findCamp({ _id: req.params.id });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Check if user is camp owner
    // Check camp ownership using helper
    const hasAccess = await canAccessCamp(req, camp._id);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Not authorized to delete this camp' });
    }

    // Delete related members
    await db.deleteManyMembers({ camp: camp._id });

    // Delete camp
    await db.deleteCamp(req.params.id);

    res.json({ message: 'Camp deleted successfully' });

  } catch (error) {
    console.error('Delete camp error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/camps/:id/members
// @desc    Get camp members
// @access  Private (Camp members only)
router.get('/:id/members', authenticateToken, async (req, res) => {
  try {
    const camp = await db.findCamp({ _id: req.params.id });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Check if user is member of this camp
    const userMember = await db.findMember({ 
      user: req.user._id, 
      camp: camp._id
    });

    if (!userMember) {
      return res.status(403).json({ message: 'Not a member of this camp' });
    }

    const members = await db.findMembers({ 
      camp: camp._id
    });

    // Populate user data for each member
    const populatedMembers = await Promise.all(members.map(async (member) => {
      const userData = await db.findUser({ _id: member.user });
      return {
        ...member,
        user: userData ? {
          _id: userData._id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          profilePhoto: userData.profilePhoto,
          accountType: userData.accountType,
          playaName: userData.playaName,
          city: userData.city,
          location: userData.location,
          hasTicket: userData.hasTicket,
          hasVehiclePass: userData.hasVehiclePass,
          interestedInEAP: userData.interestedInEAP,
          interestedInStrike: userData.interestedInStrike
        } : null
      };
    }));

    // Sort by role and creation date
    populatedMembers.sort((a, b) => {
      const roleOrder = { 'camp-lead': 0, 'project-lead': 1, 'member': 2 };
      const roleComparison = (roleOrder[a.role] || 3) - (roleOrder[b.role] || 3);
      if (roleComparison !== 0) return roleComparison;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    // Debug: Log the members data before sending
    console.log('🔍 [GET /api/camps/:id/members] Members count:', populatedMembers.length);
    if (populatedMembers.length > 0) {
      console.log('🔍 [GET /api/camps/:id/members] First member data:', JSON.stringify(populatedMembers[0], null, 2));
      if (populatedMembers[0].user) {
        console.log('🔍 [GET /api/camps/:id/members] First member user data:', JSON.stringify(populatedMembers[0].user, null, 2));
        console.log('🔍 [GET /api/camps/:id/members] First member playaName:', populatedMembers[0].user.playaName);
      }
    }
    
    res.json({ members: populatedMembers });

  } catch (error) {
    console.error('Get camp members error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// @route   PUT /api/camps/test
// @desc    Test route
// @access  Private
router.put('/test', authenticateToken, async (req, res) => {
  res.json({ message: 'Test route working', user: req.user.id });
});

// @route   POST /api/camps/upload-photo
// @desc    Upload photo for camp profile
// @access  Private (Camp owners only)
router.post('/upload-photo', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    // Check if user has camp account
    if (req.user.accountType !== 'camp') {
      return res.status(403).json({ message: 'Only camp accounts can upload photos' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No photo file uploaded' });
    }

    // For now, we'll simulate photo upload - in production, use cloud storage
    // In a real app, you'd use multer middleware and upload to AWS S3, Cloudinary, etc.
    // Create a simple base64 encoded image that will always work
    const simpleSvg = `<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="300" fill="#FF6B35"/><text x="200" y="150" text-anchor="middle" fill="white" font-family="Arial" font-size="20">Camp Photo</text></svg>`;
    const mockPhotoUrl = `data:image/svg+xml;base64,${Buffer.from(simpleSvg).toString('base64')}`;
    
    console.log('Photo uploaded:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      mockUrl: mockPhotoUrl
    });
    
    res.json({ 
      url: mockPhotoUrl,
      message: 'Photo uploaded successfully'
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ message: 'Error uploading photo' });
  }
});

// @route   POST /api/camps/:campId/roster/archive
// @desc    Archive the active roster for a specific camp
// @access  Private (Camp admins/leads only)
router.post('/:campId/roster/archive', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;
    const numericCampId = parseInt(campId);
    
    // Check if user is camp owner/admin
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      return res.status(403).json({ message: 'Camp admin/lead access required' });
    }

    const camp = await db.findCamp({ _id: numericCampId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Verify user has access to this camp
    // Check camp ownership using helper
    const isCampOwner = await canAccessCamp(req, camp._id);
    const isAdmin = req.user.accountType === 'admin' && req.user.campId === camp._id.toString();
    
    if (!isCampOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied - camp admin/lead required' });
    }

    // Find the active roster
    const activeRoster = await db.findActiveRoster({ camp: numericCampId });
    if (!activeRoster) {
      return res.status(404).json({ message: 'No active roster found' });
    }

    if (activeRoster.isArchived) {
      return res.status(400).json({ message: 'Roster is already archived' });
    }

    // Archive the roster
    const archivedRoster = await db.archiveRoster(activeRoster._id, req.user._id);
    res.json({ message: 'Roster archived successfully', roster: archivedRoster });
  } catch (error) {
    console.error('Archive roster error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/camps/:campId/roster/create
// @desc    Create a new roster for a specific camp
// @access  Private (Camp admins/leads only)
router.post('/:campId/roster/create', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;
    const numericCampId = parseInt(campId);
    const { name = `${new Date().getFullYear()} Roster`, description = 'Active camp roster' } = req.body;
    
    // Check if user is camp owner/admin
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      return res.status(403).json({ message: 'Camp admin/lead access required' });
    }

    const camp = await db.findCamp({ _id: numericCampId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Verify user has access to this camp
    // Check camp ownership using helper
    const isCampOwner = await canAccessCamp(req, camp._id);
    const isAdmin = req.user.accountType === 'admin' && req.user.campId === camp._id.toString();
    
    if (!isCampOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied - camp admin/lead required' });
    }

    // Check if there's already an active roster
    const existingActiveRoster = await db.findActiveRoster({ camp: numericCampId });
    
    // Create the roster
    const roster = await db.createRoster({
      camp: numericCampId,
      name,
      description,
      isActive: true,
      createdBy: req.user._id
    });

    // If there was an existing active roster, archive it
    if (existingActiveRoster) {
      await db.archiveRoster(existingActiveRoster._id, req.user._id);
    }

    // Add all approved members to the new roster
    const approvedMembers = await db.findManyMembers({ 
      camp: numericCampId, 
      status: 'active' 
    });

    for (const member of approvedMembers) {
      await db.addMemberToRoster(roster._id, member._id, req.user._id);
    }

    res.status(201).json({ message: 'Roster created successfully', roster });
  } catch (error) {
    console.error('Create roster error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Only one active roster is allowed per camp' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/camps/:campId/roster/member/:memberId
// @desc    Remove member from roster and reset their application for re-application
// @access  Private (Camp admins/leads only)
router.delete('/:campId/roster/member/:memberId', authenticateToken, async (req, res) => {
  try {
    const { campId, memberId } = req.params;
    const numericCampId = parseInt(campId);
    
    // Check if user is camp owner/admin
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      return res.status(403).json({ message: 'Camp admin/lead access required' });
    }

    const camp = await db.findCamp({ _id: numericCampId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Verify user has access to this camp
    // Check camp ownership using helper
    const isCampOwner = await canAccessCamp(req, camp._id);
    const isAdmin = req.user.accountType === 'admin' && req.user.campId === camp._id.toString();
    
    if (!isCampOwner && !isAdmin) {
      return res.status(403).json({ message: 'Access denied - camp admin/lead required' });
    }

    // Find the member record
    const member = await db.findMember({ _id: memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Find the active roster for this camp
    const activeRoster = await db.findActiveRoster({ camp: numericCampId });
    if (!activeRoster) {
      return res.status(404).json({ message: 'No active roster found' });
    }

    // Remove member from roster
    await db.removeMemberFromRoster(activeRoster._id, memberId);

    // CRITICAL: Clear camp affiliation from user profile
    // Step 1: Find and update the user's profile to remove camp affiliation
    const userProfile = await db.findUser({ _id: member.user });
    if (userProfile) {
      await db.updateUser(member.user, {
        campName: null, // Clear camp name from user profile
        updatedAt: new Date()
      });
    }

    // Step 2: Update the member record to 'deleted' status
    await db.updateMember(memberId, { 
      status: 'deleted',
      reviewedAt: new Date(),
      reviewedBy: req.user._id,
      reviewNotes: 'Removed from roster - application reset for re-application'
    });

    // Step 3: Find and reset the corresponding application record
    const application = await db.findMemberApplication({ 
      applicant: member.user, 
      camp: numericCampId,
      // Get the current year's application
      createdAt: {
        $gte: new Date(new Date().getFullYear(), 0, 1), // Start of current year
        $lt: new Date(new Date().getFullYear() + 1, 0, 1) // Start of next year
      }
    });

    if (application) {
      // Reset application to allow re-application within the same calendar year
      await db.updateMemberApplication(application._id, {
        status: 'deleted',
        reviewedAt: new Date(),
        reviewedBy: req.user._id,
        reviewNotes: 'Application reset - member removed from roster, can re-apply',
        // Remove the member linkage to allow fresh application
        memberId: null
      });
    }

    res.json({ 
      message: 'Member removed from roster and application reset successfully',
      canReapply: true,
      resetYear: new Date().getFullYear()
    });
  } catch (error) {
    console.error('Delete member from roster error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
