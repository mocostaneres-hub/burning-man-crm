const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/databaseAdapter');
const { getUserCampId, canAccessCamp } = require('../utils/permissionHelpers');

// Test route to verify this file is being loaded
router.get('/debug-test', (req, res) => {
  res.json({ message: 'Shifts router loaded successfully', timestamp: new Date().toISOString() });
});

// @route   GET /api/shifts/events
// @desc    Get all events for a camp
// @access  Private (Camp admins/leads only)
router.get('/events', authenticateToken, async (req, res) => {
  try {
    // Get camp ID for camp owners
    let campId;
    
    if (req.user.accountType === 'camp' || (req.user.accountType === 'admin' && req.user.campId)) {
      campId = await getUserCampId(req);
      if (!campId) {
        return res.status(404).json({ message: 'Unable to determine camp context. Please ensure you are logged in as a camp admin.' });
      }
    }
    // For Camp Leads: get campId from query parameter
    else if (req.query.campId) {
      const { canManageCamp } = require('../utils/permissionHelpers');
      const hasAccess = await canManageCamp(req, req.query.campId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
      }
      campId = req.query.campId;
    } else {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    // Get events for this camp  
    const events = await db.findEvents({ campId });
    
    res.json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/shifts/test
// @desc    Test endpoint to verify deployment
// @access  Public
router.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
});

// @route   GET /api/shifts/my-events
// @desc    Get all events for camps the user is a member of (for member view)
// @access  Private (Approved camp members)
router.get('/my-events', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 [MY EVENTS] Fetching events for member view');
    console.log('📝 [MY EVENTS] User ID:', req.user._id);

    // Find all camps where the user is an approved member
    const rosters = await db.findRosters({});
    const userCampIds = [];

    for (const roster of rosters) {
      if (!roster.members || !roster.active) continue;

      for (const memberEntry of roster.members) {
        if (memberEntry.status !== 'approved' || !memberEntry.member) continue;

        const member = await db.findMember({ _id: memberEntry.member });
        if (member && member.user && member.status === 'active') {
          const memberId = typeof member.user === 'object' ? member.user._id : member.user;
          if (memberId.toString() === req.user._id.toString()) {
            userCampIds.push(roster.camp);
            break;
          }
        }
      }
    }

    console.log('🏕️ [MY EVENTS] User is member of camps:', userCampIds);

    if (userCampIds.length === 0) {
      return res.json({ events: [] });
    }

    // Get all events for these camps
    const allEvents = [];
    for (const campId of userCampIds) {
      const events = await db.findEvents({ campId });
      allEvents.push(...events);
    }

    console.log('✅ [MY EVENTS] Found events:', allEvents.length);

    res.json({ events: allEvents });
  } catch (error) {
    console.error('❌ [MY EVENTS] Error fetching events:', error);
    res.status(500).json({
      message: 'Server error fetching events',
      error: error.message
    });
  }
});

// @route   POST /api/shifts/events
// @desc    Create a new event with shifts
// @access  Private (Camp admins/leads only)
router.post('/events', authenticateToken, async (req, res) => {
  try {
    // Check if user is camp admin/lead
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      return res.status(403).json({ message: 'Camp admin/lead access required' });
    }

    const { eventName, description, shifts } = req.body;

    // Validation
    if (!eventName || !shifts || !Array.isArray(shifts) || shifts.length === 0) {
      return res.status(400).json({ message: 'Event name and at least one shift are required' });
    }

    // Get camp ID using helper (immutable campId, fallback to email)
    const campId = await getUserCampId(req);
    if (!campId) {
      return res.status(404).json({ message: 'Unable to determine camp context. Please ensure you are logged in as a camp admin.' });
    }

    // Validate shifts
    for (const shift of shifts) {
      if (!shift.title || !shift.date || !shift.startTime || !shift.endTime || !shift.maxSignUps) {
        return res.status(400).json({ message: 'All shift fields are required' });
      }
    }

    // Create event
    const event = await db.createEvent({
      eventName,
      description,
      campId,
      createdBy: req.user._id,
      shifts: shifts.map(shift => ({
        title: shift.title,
        description: shift.description || '',
        date: new Date(shift.date),
        startTime: new Date(`${shift.date}T${shift.startTime}`),
        endTime: new Date(`${shift.date}T${shift.endTime}`),
        maxSignUps: parseInt(shift.maxSignUps),
        memberIds: [],
        createdBy: req.user._id
      }))
    });

    res.status(201).json({ event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// REMOVED - Duplicate endpoint, see line 1082 for the correct member sign-up endpoint
// @route   GET /api/shifts/events/:eventId
// @desc    Get a specific event with its shifts
// @access  Private (Camp admins/leads only)
/*
router.get('/events/:eventId', authenticateToken, async (req, res) => {
  try {
    // Check if user is camp admin/lead
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      return res.status(403).json({ message: 'Camp admin/lead access required' });
    }

    const { eventId } = req.params;
    const event = await db.findEvent({ _id: eventId });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Get camp ID using helper (immutable campId)
    const campId = await getUserCampId(req);

    if (event.campId !== campId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ event });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
*/

// @route   POST /api/shifts/events/:eventId/send-task
// @desc    Send event/shifts as tasks to members
// @access  Private (Camp admins/leads only)
router.post('/events/:eventId/send-task', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 [TASK ASSIGNMENT] Starting task assignment process');
    console.log('📝 [TASK ASSIGNMENT] Request params:', { eventId: req.params.eventId });
    console.log('📝 [TASK ASSIGNMENT] Request body:', req.body);
    
    // Check if user is camp admin/lead
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      console.log('❌ [TASK ASSIGNMENT] Permission denied - user not camp admin/lead');
      return res.status(403).json({ message: 'Camp admin/lead access required' });
    }

    const { eventId } = req.params;
    const { memberIds, sendToAllMembers } = req.body;

    // Find the event
    console.log('🔍 [TASK ASSIGNMENT] Looking for event:', eventId);
    const event = await db.findEvent({ _id: eventId });
    if (!event) {
      console.log('❌ [TASK ASSIGNMENT] Event not found:', eventId);
      return res.status(404).json({ message: 'Event not found' });
    }
    console.log('✅ [TASK ASSIGNMENT] Event found:', { id: event._id, name: event.eventName, shiftsCount: event.shifts?.length });

    // Get camp ID and verify access
    // Get camp ID using helper (immutable campId)
    const campId = await getUserCampId(req);

    console.log('🏕️ [TASK ASSIGNMENT] Camp ID resolved:', campId);
    const eventCampIdStr = (event.campId && event.campId._id ? event.campId._id : event.campId).toString();
    console.log('🔒 [TASK ASSIGNMENT] Event camp ID:', eventCampIdStr);

    const isCampAccount = req.user.accountType === 'camp';
    if (!isCampAccount && eventCampIdStr !== campId.toString()) {
      console.log('❌ [TASK ASSIGNMENT] Access denied - camp ID mismatch');
      return res.status(403).json({ message: 'Access denied. Event belongs to different camp.' });
    }

    let targetMembers = [];
    
    if (sendToAllMembers) {
      console.log('👥 [TASK ASSIGNMENT] Getting all approved members from roster');
      
      // Get approved members from the active roster (same logic as before but fixed)
      try {
        const activeRoster = await db.findActiveRoster({ camp: campId });
        console.log('📊 [TASK ASSIGNMENT] Active roster found:', !!activeRoster);
        
        if (activeRoster && activeRoster.members) {
          console.log('📊 [TASK ASSIGNMENT] Raw roster members:', activeRoster.members.length);
          
          const approvedMembers = [];
          for (const memberEntry of activeRoster.members) {
            // Check if member exists first
            if (memberEntry.member) {
              const member = await db.findMember({ _id: memberEntry.member });
              
              // Accept members with 'active' or 'approved' status (check nested member.status, not entry status)
              const memberStatus = member?.status || memberEntry.status;
              const isApproved = memberStatus === 'approved' || memberStatus === 'active';
              
              console.log('🔍 [TASK ASSIGNMENT] Processing member entry:', { 
                entryId: memberEntry._id,
                memberId: memberEntry.member,
                entryStatus: memberEntry.status,
                memberStatus: member?.status,
                isApproved
              });
              
              if (member && member.user && isApproved) {
                // Ensure user ID is in the correct format (number or string)
                const userId = typeof member.user === 'object' ? member.user._id : member.user;
                console.log('🆔 [TASK ASSIGNMENT] Found member with user:', { 
                  memberId: member._id, 
                  userId: userId,
                  userType: typeof userId
                });
                if (userId) {
                  approvedMembers.push(userId);
                }
              } else {
                console.log('⚠️ [TASK ASSIGNMENT] Member not found or no user:', { memberId: memberEntry.member });
              }
            } else {
              console.log('🔍 [TASK ASSIGNMENT] Skipping member entry:', { 
                entryId: memberEntry._id,
                status: memberEntry.status,
                hasMember: !!memberEntry.member 
              });
            }
          }
          
          targetMembers = approvedMembers;
          console.log('✅ [TASK ASSIGNMENT] Final approved members found:', targetMembers.length);
        } else {
          console.log('⚠️ [TASK ASSIGNMENT] No active roster or members found');
        }
      } catch (memberError) {
        console.error('❌ [TASK ASSIGNMENT] Error getting roster members:', memberError);
        return res.status(500).json({ message: 'Failed to retrieve roster members' });
      }
    } else if (memberIds && Array.isArray(memberIds)) {
      console.log('👤 [TASK ASSIGNMENT] Validating specific member IDs:', memberIds.length);
      
      // Validate that all provided member IDs are actually approved members of the camp
      try {
        const activeRoster = await db.findActiveRoster({ camp: campId });
        if (!activeRoster || !activeRoster.members) {
          console.log('❌ [TASK ASSIGNMENT] No active roster found for validation');
          return res.status(400).json({ message: 'No active roster found for this camp' });
        }

        const approvedMemberIds = [];
        for (const memberEntry of activeRoster.members) {
          if (memberEntry.member && (memberEntry.status === 'approved' || memberEntry.status === 'active')) {
            const member = await db.findMember({ _id: memberEntry.member });
            if (member && member.user && (member.status === 'approved' || member.status === 'active')) {
              const userId = typeof member.user === 'object' ? member.user._id : member.user;
              if (userId) {
                approvedMemberIds.push(userId.toString());
              }
            }
          }
        }

        console.log('✅ [TASK ASSIGNMENT] Approved member IDs:', approvedMemberIds);

        // Filter the requested member IDs to only include approved ones
        const validMemberIds = memberIds.filter(memberId => 
          approvedMemberIds.includes(memberId.toString())
        );

        if (validMemberIds.length !== memberIds.length) {
          const invalidIds = memberIds.filter(memberId => 
            !approvedMemberIds.includes(memberId.toString())
          );
          console.log('⚠️ [TASK ASSIGNMENT] Some member IDs are not approved:', invalidIds);
          return res.status(400).json({ 
            message: 'Some provided member IDs are not approved camp members',
            invalidMemberIds: invalidIds,
            validMemberIds: validMemberIds
          });
        }

        targetMembers = validMemberIds;
        console.log('👤 [TASK ASSIGNMENT] Using validated member IDs:', targetMembers.length);
      } catch (validationError) {
        console.error('❌ [TASK ASSIGNMENT] Error validating member IDs:', validationError);
        return res.status(500).json({ message: 'Failed to validate member IDs' });
      }
    } else {
      console.log('❌ [TASK ASSIGNMENT] Invalid request - no assignment type specified');
      return res.status(400).json({ message: 'Either memberIds or sendToAllMembers is required' });
    }

    console.log('🎯 [TASK ASSIGNMENT] Final target members:', { count: targetMembers.length, members: targetMembers });

    if (targetMembers.length === 0) {
      console.log('⚠️ [TASK ASSIGNMENT] No target members found - no tasks will be created');
      return res.json({ 
        message: 'No approved members found to assign tasks to',
        tasksCreated: 0,
        targetMembers: 0
      });
    }

    // Create tasks for each target member
    console.log('📝 [TASK ASSIGNMENT] Creating tasks for members and shifts');
    const tasks = [];
    const failedTasks = [];
    
    for (const memberId of targetMembers) {
      for (const shift of event.shifts) {
        try {
          console.log(`📝 [TASK ASSIGNMENT] Creating task for member ${memberId}, shift ${shift._id}`);
          
          // Validate task data before creation
          if (!memberId) {
            throw new Error('Invalid member ID');
          }
          if (!shift._id || !shift.title) {
            throw new Error('Invalid shift data');
          }
          
          const taskData = {
            title: `Volunteer Shift: ${shift.title}`,
            description: `Event: ${event.eventName}\nShift: ${shift.title}\nDate: ${shift.date.toDateString()}\nTime: ${shift.startTime.toTimeString()} - ${shift.endTime.toTimeString()}\nDescription: ${shift.description}`,
            assignedTo: [memberId], // FIX: assignedTo should be an array
            createdBy: req.user._id,
            assignedBy: req.user._id,
            dueDate: shift.date,
            priority: 'medium',
            status: 'open',
            type: 'volunteer_shift',
            campId: event.campId, // FIX: Add campId for proper task filtering
            metadata: {
              eventId: event._id,
              shiftId: shift._id,
              eventName: event.eventName,
              shiftTitle: shift.title
            }
          };
          
          console.log(`📊 [TASK ASSIGNMENT] Task data prepared:`, { 
            assignedTo: taskData.assignedTo,
            campId: taskData.campId,
            type: taskData.type
          });
          
          const task = await db.createTask(taskData);
          tasks.push(task);
          console.log(`✅ [TASK ASSIGNMENT] Task created successfully: ${task._id} for user ${memberId}`);
        } catch (taskError) {
          console.error(`❌ [TASK ASSIGNMENT] Failed to create task for member ${memberId}, shift ${shift._id}:`, taskError);
          failedTasks.push({ memberId, shiftId: shift._id, error: taskError.message });
        }
      }
    }

    console.log('🎉 [TASK ASSIGNMENT] Task creation complete:', { 
      successful: tasks.length, 
      failed: failedTasks.length,
      targetMembers: targetMembers.length 
    });

    const response = { 
      message: `Tasks sent to ${targetMembers.length} member(s)`,
      tasksCreated: tasks.length,
      targetMembers: targetMembers.length
    };

    if (failedTasks.length > 0) {
      response.warnings = `${failedTasks.length} tasks failed to create`;
      response.failedTasks = failedTasks;
    }

    res.json(response);
  } catch (error) {
    console.error('❌ [TASK ASSIGNMENT] Critical error in send-task:', error);
    res.status(500).json({ 
      message: 'Server error during task assignment',
      error: error.message
    });
  }
});

// REMOVED - Duplicate endpoint, see line 928 for the correct implementation
// @route   POST /api/shifts/shifts/:shiftId/signup
// @desc    Sign up a member for a shift
// @access  Private (Approved camp members only)
/*
router.post('/shifts/:shiftId/signup', authenticateToken, async (req, res) => {
  try {
    const { shiftId } = req.params;
    const memberId = req.user._id;

    // Find the shift
    const shift = await db.findShift({ _id: shiftId });
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    // Check if shift is full
    if (shift.memberIds.length >= shift.maxSignUps) {
      return res.status(400).json({ message: 'Shift is full' });
    }

    // Check if member is already signed up
    if (shift.memberIds.includes(memberId)) {
      return res.status(400).json({ message: 'Already signed up for this shift' });
    }

    // Verify member is approved in the camp
    const event = await db.findEvent({ _id: shift.eventId });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const activeRoster = await db.findActiveRoster({ camp: event.campId });
    if (!activeRoster) {
      return res.status(404).json({ message: 'No active roster found' });
    }

    // Check if the user is an approved member in the roster
    const memberEntry = activeRoster.members.find(entry => 
      entry.status === 'approved' && entry.member
    );
    if (!memberEntry) {
      return res.status(403).json({ message: 'Only approved camp members can sign up for shifts' });
    }
    
    const member = await db.findMember({ _id: memberEntry.member });
    if (!member || member.user !== memberId) {
      return res.status(403).json({ message: 'Only approved camp members can sign up for shifts' });
    }

    // Add member to shift
    await db.updateShift(shiftId, {
      memberIds: [...shift.memberIds, memberId]
    });

    res.json({ 
      message: 'Successfully signed up for shift',
      shiftId,
      memberId
    });
  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
*/

// @route   DELETE /api/shifts/shifts/:shiftId/signup
// @desc    Cancel signup for a shift
// @access  Private (Member who signed up)
router.delete('/shifts/:shiftId/signup', authenticateToken, async (req, res) => {
  try {
    const { shiftId } = req.params;
    const memberId = req.user._id;

    // Find the shift
    const shift = await db.findShift({ _id: shiftId });
    if (!shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    // Check if member is signed up
    if (!shift.memberIds.includes(memberId)) {
      return res.status(400).json({ message: 'Not signed up for this shift' });
    }

    // Remove member from shift
    await db.updateShift(shiftId, {
      memberIds: shift.memberIds.filter(id => id !== memberId)
    });

    res.json({ 
      message: 'Successfully cancelled shift signup',
      shiftId,
      memberId
    });
  } catch (error) {
    console.error('Cancel signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/shifts/reports/per-person
// @desc    Get per-person shift report
// @access  Private (Camp admins/leads only)
router.get('/reports/per-person', authenticateToken, async (req, res) => {
  try {
    // Get camp ID for camp owners
    let campId;
    
    if (req.user.accountType === 'camp' || (req.user.accountType === 'admin' && req.user.campId)) {
      campId = await getUserCampId(req);
      if (!campId) {
        return res.status(404).json({ message: 'Camp not found' });
      }
    }
    // For Camp Leads: get campId from query parameter
    else if (req.query.campId) {
      const { canManageCamp } = require('../utils/permissionHelpers');
      const hasAccess = await canManageCamp(req, req.query.campId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
      }
      campId = req.query.campId;
    } else {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    // Get all events for this camp
    const events = await db.findEvents({ campId });
    
    // Build per-person report
    const report = [];
    for (const event of events) {
      for (const shift of event.shifts) {
        for (const memberId of shift.memberIds) {
          const user = await db.findUser({ _id: memberId });
          if (user) {
            report.push({
              personName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
              date: shift.date,
              eventName: event.eventName,
              shiftTime: `${shift.startTime.toTimeString().slice(0, 5)} – ${shift.endTime.toTimeString().slice(0, 5)}`,
              description: shift.description
            });
          }
        }
      }
    }

    res.json({ report });
  } catch (error) {
    console.error('Per-person report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/shifts/reports/per-day
// @desc    Get per-day shift report
// @access  Private (Camp admins/leads only)
router.get('/reports/per-day', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required' });
    }

    // Get camp ID for camp owners
    let campId;
    
    if (req.user.accountType === 'camp' || (req.user.accountType === 'admin' && req.user.campId)) {
      campId = await getUserCampId(req);
      if (!campId) {
        return res.status(404).json({ message: 'Camp not found' });
      }
    }
    // For Camp Leads: get campId from query parameter
    else if (req.query.campId) {
      const { canManageCamp } = require('../utils/permissionHelpers');
      const hasAccess = await canManageCamp(req, req.query.campId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
      }
      campId = req.query.campId;
    } else {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    // Get all events for this camp
    const events = await db.findEvents({ campId });
    
    // Build per-day report for the specified date
    const report = [];
    const targetDate = new Date(date);
    
    for (const event of events) {
      for (const shift of event.shifts) {
        const shiftDate = new Date(shift.date);
        if (shiftDate.toDateString() === targetDate.toDateString()) {
          for (const memberId of shift.memberIds) {
            const user = await db.findUser({ _id: memberId });
            if (user) {
              report.push({
                personName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                date: shift.date,
                eventName: event.eventName,
                shiftTime: `${shift.startTime.toTimeString().slice(0, 5)} – ${shift.endTime.toTimeString().slice(0, 5)}`,
                description: shift.description
              });
            }
          }
        }
      }
    }

    res.json({ report, date: targetDate.toISOString().split('T')[0] });
  } catch (error) {
    console.error('Per-day report error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/shifts/events/:eventId
// @desc    Update an existing event with shifts
// @access  Private (Camp admins/leads only)
router.put('/events/:eventId', authenticateToken, async (req, res) => {
  try {
    // Check if user is camp admin/lead
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      return res.status(403).json({ message: 'Camp admin/lead access required' });
    }

    const { eventId } = req.params;
    const { eventName, description, shifts } = req.body;

    // Validation
    if (!eventName || !shifts || !Array.isArray(shifts) || shifts.length === 0) {
      return res.status(400).json({ message: 'Event name and at least one shift are required' });
    }

    // Check if event exists
    const existingEvent = await db.findEvent({ _id: eventId });
    if (!existingEvent) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Get camp ID from user context and verify access
    // Get camp ID using helper (immutable campId)
    const campId = await getUserCampId(req);

    const eventCampIdStr = (existingEvent.campId && existingEvent.campId._id ? existingEvent.campId._id : existingEvent.campId).toString();
    const isCampAccount = req.user.accountType === 'camp';
    if (!isCampAccount && (!campId || eventCampIdStr !== campId.toString())) {
      return res.status(403).json({ message: 'Access denied. Event belongs to different camp.' });
    }

    // Validate shifts
    for (const shift of shifts) {
      if (!shift.title || !shift.date || !shift.startTime || !shift.endTime || !shift.maxSignUps) {
        return res.status(400).json({ message: 'All shift fields are required' });
      }
      if (typeof shift.maxSignUps !== 'number' || shift.maxSignUps < 1) {
        return res.status(400).json({ message: 'maxSignUps must be a positive number' });
      }
    }

    // Update event
    const updatedEvent = await db.updateEvent(eventId, {
      eventName,
      description,
      shifts: shifts.map((shift, index) => {
        // Preserve existing shift IDs if they exist, otherwise generate new ones
        const existingShift = existingEvent.shifts[index];
        const shiftId = existingShift ? existingShift._id : (Date.now() + Math.random()).toString();
        
        return {
          _id: shiftId,
          eventId: eventId,
          title: shift.title,
          description: shift.description || '',
          date: new Date(shift.date),
          startTime: new Date(`${shift.date}T${shift.startTime}`),
          endTime: new Date(`${shift.date}T${shift.endTime}`),
          maxSignUps: parseInt(shift.maxSignUps),
          memberIds: existingShift ? existingShift.memberIds : [], // Preserve existing sign-ups
          createdBy: existingShift ? existingShift.createdBy : req.user._id,
          createdAt: existingShift ? existingShift.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      })
    });

    res.json({ event: updatedEvent });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/shifts/events/:eventId
// @desc    Delete an event and all its related data (shifts, tasks)
// @access  Private (Camp admins/leads only)
router.delete('/events/:eventId', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 [EVENT DELETION] Starting complete event deletion');
    console.log('📝 [EVENT DELETION] Event ID:', req.params.eventId);
    console.log('📝 [EVENT DELETION] User:', { accountType: req.user.accountType, email: req.user.email, campId: req.user.campId });

    const { eventId } = req.params;

    // Check if event exists first
    console.log('🔍 [EVENT DELETION] Looking for event:', eventId);
    const event = await db.findEvent({ _id: eventId });
    if (!event) {
      console.log('❌ [EVENT DELETION] Event not found:', eventId);
      return res.status(404).json({ message: 'Event not found' });
    }
    console.log('✅ [EVENT DELETION] Event found:', { id: event._id, name: event.eventName, campId: event.campId });

    // PERMISSION CHECK: Allow camp accounts, admins with campId, or users who created the event
    const isCampAccount = req.user.accountType === 'camp';
    const isAdminWithCamp = req.user.accountType === 'admin' && req.user.campId;
    
    // Check if user created the event (handle both populated and non-populated createdBy)
    let createdById = null;
    if (event.createdBy) {
      if (event.createdBy._id) {
        // Populated object
        createdById = event.createdBy._id.toString();
      } else if (typeof event.createdBy === 'object' && event.createdBy.toString) {
        // Mongoose ObjectId
        createdById = event.createdBy.toString();
      } else if (typeof event.createdBy === 'string') {
        // String ID
        createdById = event.createdBy;
      }
    }
    const userId = req.user._id ? req.user._id.toString() : req.user.toString();
    const isEventCreator = createdById && createdById === userId;
    
    if (!isCampAccount && !isAdminWithCamp && !isEventCreator) {
      console.log('❌ [EVENT DELETION] Permission denied');
      console.log('📝 [EVENT DELETION] User accountType:', req.user.accountType);
      console.log('📝 [EVENT DELETION] User campId:', req.user.campId);
      console.log('📝 [EVENT DELETION] Event creator:', event.createdBy);
      return res.status(403).json({ message: 'Camp account required to delete events' });
    }

    console.log('✅ [EVENT DELETION] Permission check passed');
    
    // Get camp ID using helper (immutable campId)
    const campId = await getUserCampId(req);
    
    console.log('🏕️ [EVENT DELETION] User camp ID:', campId);
    console.log('🔒 [EVENT DELETION] Event camp ID:', event.campId);

    // Verify event belongs to this camp (unless user created it)
    if (!isEventCreator) {
      if (!campId) {
        console.log('❌ [EVENT DELETION] Could not determine camp ID for user');
        return res.status(403).json({ message: 'Camp association not found' });
      }

      const eventCampId = event.campId._id ? event.campId._id.toString() : event.campId.toString();
      if (eventCampId !== campId) {
        console.log('❌ [EVENT DELETION] Access denied - event belongs to different camp');
        console.log('📝 [EVENT DELETION] User camp:', campId);
        console.log('📝 [EVENT DELETION] Event camp:', eventCampId);
        return res.status(403).json({ message: 'You can only delete events from your own camp' });
      }
    } else {
      console.log('✅ [EVENT DELETION] User created this event - deletion allowed');
    }

    console.log('✅ [EVENT DELETION] Permission granted');

    // Step 1: Delete all tasks related to this event
    console.log('🔍 [EVENT DELETION] Searching for tasks to delete');
    const tasks = await db.findTasks({ 
      'metadata.eventId': eventId,
      type: 'volunteer_shift'
    });

    console.log(`📊 [EVENT DELETION] Found ${tasks.length} tasks to delete`);

    let deletedTasksCount = 0;
    const failedTaskDeletions = [];
    
    for (const task of tasks) {
      try {
        console.log(`🗑️ [EVENT DELETION] Deleting task: ${task._id} (assigned to: ${task.assignedTo})`);
        await db.deleteTask(task._id);
        deletedTasksCount++;
        console.log(`✅ [EVENT DELETION] Task deleted successfully: ${task._id}`);
      } catch (deleteError) {
        console.error(`❌ [EVENT DELETION] Failed to delete task ${task._id}:`, deleteError);
        failedTaskDeletions.push({ taskId: task._id, error: deleteError.message });
      }
    }

    // Step 2: Shifts will be deleted automatically when the event is deleted
    // (shifts are embedded subdocuments in the event)
    const shiftsCount = event.shifts?.length || 0;
    console.log(`📊 [EVENT DELETION] Event contains ${shiftsCount} shifts (will be deleted with event)`);

    // Step 3: Delete the event itself
    console.log('🗑️ [EVENT DELETION] Deleting event:', eventId);
    try {
      await db.deleteEvent(eventId);
      console.log('✅ [EVENT DELETION] Event deleted successfully:', eventId);
    } catch (deleteError) {
      console.error('❌ [EVENT DELETION] Failed to delete event:', deleteError);
      return res.status(500).json({ 
        message: 'Failed to delete event',
        error: deleteError.message
      });
    }

    console.log('🎉 [EVENT DELETION] Complete deletion summary:', { 
      eventDeleted: true,
      tasksDeleted: deletedTasksCount,
      shiftsDeleted: shiftsCount,
      failedTasks: failedTaskDeletions.length
    });

    const response = { 
      message: 'Event and all related data deleted successfully',
      eventId: eventId,
      eventName: event.eventName,
      tasksDeleted: deletedTasksCount,
      shiftsDeleted: shiftsCount,
      totalTasksFound: tasks.length
    };

    if (failedTaskDeletions.length > 0) {
      response.warnings = 'Some related tasks failed to delete';
      response.failedTaskDeletions = failedTaskDeletions;
    }

    res.json(response);
  } catch (error) {
    console.error('❌ [EVENT DELETION] Critical error in event deletion:', error);
    res.status(500).json({ 
      message: 'Server error during event deletion',
      error: error.message
    });
  }
});

// @route   DELETE /api/shifts/events/:eventId/tasks
// @desc    Remove all tasks associated with an event
// @access  Private (Camp admins/leads only)
router.delete('/events/:eventId/tasks', authenticateToken, async (req, res) => {
  try {
    console.log('🗑️ [TASK DELETION] Starting task deletion process');
    console.log('📝 [TASK DELETION] Event ID:', req.params.eventId);
    
    // Check if user is camp admin/lead
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      console.log('❌ [TASK DELETION] Permission denied - user not camp admin/lead');
      return res.status(403).json({ message: 'Camp admin/lead access required' });
    }

    const { eventId } = req.params;

    // Check if event exists and user has access
    console.log('🔍 [TASK DELETION] Looking for event:', eventId);
    const event = await db.findEvent({ _id: eventId });
    if (!event) {
      console.log('❌ [TASK DELETION] Event not found:', eventId);
      return res.status(404).json({ message: 'Event not found' });
    }
    console.log('✅ [TASK DELETION] Event found:', { id: event._id, name: event.eventName });

    // Get camp ID and verify access
    let campId;
    if (req.user.accountType === 'camp') {
      const camp = await db.findCamp({ contactEmail: req.user.email });
      campId = camp ? camp._id : null;
    } else if (req.user.accountType === 'admin' && req.user.campId) {
      const camp = await db.findCamp({ contactEmail: req.user.email });
      campId = camp ? camp._id : null;
    }

    console.log('🏕️ [TASK DELETION] Camp ID resolved:', campId);
    console.log('🔒 [TASK DELETION] Event camp ID:', event.campId);

    if (!campId || event.campId.toString() !== campId.toString()) {
      console.log('❌ [TASK DELETION] Access denied - camp ID mismatch');
      return res.status(403).json({ message: 'Access denied. Event belongs to different camp.' });
    }

    // Find and delete all tasks related to this event
    console.log('🔍 [TASK DELETION] Searching for tasks to delete');
    const tasks = await db.findTasks({ 
      'metadata.eventId': eventId,
      type: 'volunteer_shift'
    });

    console.log(`📊 [TASK DELETION] Found ${tasks.length} tasks to delete`);

    let deletedCount = 0;
    const failedDeletions = [];
    
    for (const task of tasks) {
      try {
        console.log(`🗑️ [TASK DELETION] Deleting task: ${task._id} (assigned to: ${task.assignedTo})`);
        await db.deleteTask(task._id);
        deletedCount++;
        console.log(`✅ [TASK DELETION] Task deleted successfully: ${task._id}`);
      } catch (deleteError) {
        console.error(`❌ [TASK DELETION] Failed to delete task ${task._id}:`, deleteError);
        failedDeletions.push({ taskId: task._id, error: deleteError.message });
      }
    }

    console.log('🎉 [TASK DELETION] Task deletion complete:', { 
      deleted: deletedCount, 
      failed: failedDeletions.length,
      totalFound: tasks.length 
    });

    const response = { 
      message: `Removed ${deletedCount} task(s) for event`,
      deletedCount,
      totalFound: tasks.length
    };

    if (failedDeletions.length > 0) {
      response.warnings = `${failedDeletions.length} tasks failed to delete`;
      response.failedDeletions = failedDeletions;
    }

    res.json(response);
  } catch (error) {
    console.error('❌ [TASK DELETION] Critical error in task deletion:', error);
    res.status(500).json({ 
      message: 'Server error during task deletion',
      error: error.message
    });
  }
});

// @route   PUT /api/shifts/events/:eventId/task-assignments
// @desc    Update task assignments for an event with targeted management
// @access  Private (Camp admins/leads only)
router.put('/events/:eventId/task-assignments', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 [TASK SYNC] Starting targeted task assignment update');
    console.log('📝 [TASK SYNC] Request params:', { eventId: req.params.eventId });
    console.log('📝 [TASK SYNC] Request body:', req.body);
    
    // Check if user is camp admin/lead
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      console.log('❌ [TASK SYNC] Permission denied - user not camp admin/lead');
      return res.status(403).json({ message: 'Camp admin/lead access required' });
    }

    const { eventId } = req.params;
    const { assignmentType, memberIds, sendToAllMembers } = req.body;

    // Find the event
    console.log('🔍 [TASK SYNC] Looking for event:', eventId);
    const event = await db.findEvent({ _id: eventId });
    if (!event) {
      console.log('❌ [TASK SYNC] Event not found:', eventId);
      return res.status(404).json({ message: 'Event not found' });
    }
    console.log('✅ [TASK SYNC] Event found:', { id: event._id, name: event.eventName });

    // Get camp ID and verify access
    // Get camp ID using helper (immutable campId)
    const campId = await getUserCampId(req);

    console.log('🏕️ [TASK SYNC] Camp ID resolved:', campId);
    const eventCampIdStr = (event.campId && event.campId._id ? event.campId._id : event.campId).toString();
    const isCampAccount = req.user.accountType === 'camp';
    if (!isCampAccount && eventCampIdStr !== campId.toString()) {
      console.log('❌ [TASK SYNC] Access denied - camp ID mismatch');
      return res.status(403).json({ message: 'Access denied. Event belongs to different camp.' });
    }

    // Get current tasks for this event
    console.log('🔍 [TASK SYNC] Finding existing tasks for event');
    const existingTasks = await db.findTasks({ 
      'metadata.eventId': eventId,
      type: 'volunteer_shift'
    });
    console.log(`📊 [TASK SYNC] Found ${existingTasks.length} existing tasks`);

    // Determine target members based on assignment type
    let newTargetMembers = [];
    
    if (assignmentType === 'none') {
      // Remove all tasks for this event
      newTargetMembers = [];
    } else if (sendToAllMembers) {
      // Get all approved members from the active roster
      const activeRoster = await db.findActiveRoster({ camp: campId });
      if (activeRoster && activeRoster.members) {
        const approvedMembers = [];
        for (const memberEntry of activeRoster.members) {
          if (memberEntry.status === 'approved' && memberEntry.member) {
            const member = await db.findMember({ _id: memberEntry.member });
            if (member && member.user) {
              const userId = typeof member.user === 'object' ? member.user._id : member.user;
              if (userId) {
                approvedMembers.push(userId);
              }
            }
          }
        }
        newTargetMembers = approvedMembers;
      }
    } else if (memberIds && Array.isArray(memberIds)) {
      console.log('👤 [TASK SYNC] Validating specific member IDs:', memberIds.length);
      
      // Validate that all provided member IDs are actually approved members of the camp
      try {
        const activeRoster = await db.findActiveRoster({ camp: campId });
        if (!activeRoster || !activeRoster.members) {
          console.log('❌ [TASK SYNC] No active roster found for validation');
          return res.status(400).json({ message: 'No active roster found for this camp' });
        }

        const approvedMemberIds = [];
        for (const memberEntry of activeRoster.members) {
          if (memberEntry.member && (memberEntry.status === 'approved' || memberEntry.status === 'active')) {
            const member = await db.findMember({ _id: memberEntry.member });
            if (member && member.user && (member.status === 'approved' || member.status === 'active')) {
              const userId = typeof member.user === 'object' ? member.user._id : member.user;
              if (userId) {
                approvedMemberIds.push(userId.toString());
              }
            }
          }
        }

        console.log('✅ [TASK SYNC] Approved member IDs:', approvedMemberIds);

        // Filter the requested member IDs to only include approved ones
        const validMemberIds = memberIds.filter(memberId => 
          approvedMemberIds.includes(memberId.toString())
        );

        if (validMemberIds.length !== memberIds.length) {
          const invalidIds = memberIds.filter(memberId => 
            !approvedMemberIds.includes(memberId.toString())
          );
          console.log('⚠️ [TASK SYNC] Some member IDs are not approved:', invalidIds);
          return res.status(400).json({ 
            message: 'Some provided member IDs are not approved camp members',
            invalidMemberIds: invalidIds,
            validMemberIds: validMemberIds
          });
        }

        newTargetMembers = validMemberIds;
        console.log('👤 [TASK SYNC] Using validated member IDs:', newTargetMembers.length);
      } catch (validationError) {
        console.error('❌ [TASK SYNC] Error validating member IDs:', validationError);
        return res.status(500).json({ message: 'Failed to validate member IDs' });
      }
    }

    console.log('🎯 [TASK SYNC] New target members:', { count: newTargetMembers.length, members: newTargetMembers });

    // Extract current members who have tasks for this event
    const currentMembers = [...new Set(existingTasks.flatMap(task => task.assignedTo))];
    console.log('👥 [TASK SYNC] Current members with tasks:', { count: currentMembers.length, members: currentMembers });

    // Calculate members to add and remove
    const membersToAdd = newTargetMembers.filter(id => !currentMembers.includes(id));
    const membersToRemove = currentMembers.filter(id => !newTargetMembers.includes(id));
    
    console.log('📊 [TASK SYNC] Task changes needed:', {
      toAdd: membersToAdd.length,
      toRemove: membersToRemove.length,
      addList: membersToAdd,
      removeList: membersToRemove
    });

    // Check if no changes are needed
    if (membersToAdd.length === 0 && membersToRemove.length === 0) {
      console.log('✅ [TASK SYNC] No changes needed - task assignments already match target');
      return res.json({
        message: 'Task assignments already up to date - no changes needed',
        deletedCount: 0,
        createdCount: 0,
        finalMemberCount: newTargetMembers.length,
        membersAdded: 0,
        membersRemoved: 0,
        noChangesNeeded: true
      });
    }

    let deletedCount = 0;
    let createdCount = 0;
    const failedOperations = [];

    // Remove tasks for members who are no longer assigned
    for (const memberId of membersToRemove) {
      const tasksToDelete = existingTasks.filter(task => task.assignedTo.includes(memberId));
      for (const task of tasksToDelete) {
        try {
          console.log(`🗑️ [TASK SYNC] Removing task ${task._id} from member ${memberId}`);
          await db.deleteTask(task._id);
          deletedCount++;
        } catch (error) {
          console.error(`❌ [TASK SYNC] Failed to delete task ${task._id}:`, error);
          failedOperations.push({ action: 'delete', taskId: task._id, memberId, error: error.message });
        }
      }
    }

    // Create tasks for new members
    for (const memberId of membersToAdd) {
      for (const shift of event.shifts) {
        try {
          console.log(`📝 [TASK SYNC] Creating task for new member ${memberId}, shift ${shift._id}`);
          
          const taskData = {
            title: `Volunteer Shift: ${shift.title}`,
            description: `Event: ${event.eventName}\nShift: ${shift.title}\nDate: ${shift.date.toDateString()}\nTime: ${shift.startTime.toTimeString()} - ${shift.endTime.toTimeString()}\nDescription: ${shift.description}`,
            assignedTo: [memberId],
            createdBy: req.user._id,
            assignedBy: req.user._id,
            dueDate: shift.date,
            priority: 'medium',
            status: 'open',
            type: 'volunteer_shift',
            campId: event.campId,
            metadata: {
              eventId: event._id,
              shiftId: shift._id,
              eventName: event.eventName,
              shiftTitle: shift.title
            }
          };
          
          const task = await db.createTask(taskData);
          createdCount++;
          console.log(`✅ [TASK SYNC] Task created successfully: ${task._id} for user ${memberId}`);
        } catch (error) {
          console.error(`❌ [TASK SYNC] Failed to create task for member ${memberId}, shift ${shift._id}:`, error);
          failedOperations.push({ action: 'create', memberId, shiftId: shift._id, error: error.message });
        }
      }
    }

    console.log('🎉 [TASK SYNC] Task synchronization complete:', { 
      deleted: deletedCount, 
      created: createdCount,
      failed: failedOperations.length,
      finalMemberCount: newTargetMembers.length
    });

    const response = { 
      message: `Task assignment updated: removed ${deletedCount} tasks, created ${createdCount} tasks`,
      deletedCount,
      createdCount,
      finalMemberCount: newTargetMembers.length,
      membersAdded: membersToAdd.length,
      membersRemoved: membersToRemove.length
    };

    if (failedOperations.length > 0) {
      response.warnings = `${failedOperations.length} operations failed`;
      response.failedOperations = failedOperations;
    }

    res.json(response);
  } catch (error) {
    console.error('❌ [TASK SYNC] Critical error in task synchronization:', error);
    res.status(500).json({ 
      message: 'Server error during task synchronization',
      error: error.message
    });
  }
});

// @route   POST /api/shifts/shifts/:shiftId/signup
// @desc    Sign up for a specific shift
// @access  Private (Approved camp members only)
router.post('/shifts/:shiftId/signup', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 [SHIFT SIGNUP] Starting shift sign-up process');
    console.log('📝 [SHIFT SIGNUP] Request params:', { shiftId: req.params.shiftId, userId: req.user._id });
    
    const { shiftId } = req.params;
    const userId = req.user._id;

    // Find the shift and event
    console.log('🔍 [SHIFT SIGNUP] Looking for shift:', shiftId);
    const events = await db.findEvents({});
    let targetEvent = null;
    let targetShift = null;

    for (const event of events) {
      const shift = event.shifts.find(s => s._id.toString() === shiftId);
      if (shift) {
        targetEvent = event;
        targetShift = shift;
        break;
      }
    }

    if (!targetEvent || !targetShift) {
      console.log('❌ [SHIFT SIGNUP] Shift not found:', shiftId);
      return res.status(404).json({ message: 'Shift not found' });
    }

    console.log('✅ [SHIFT SIGNUP] Shift found:', {
      eventId: targetEvent._id,
      eventName: targetEvent.eventName,
      shiftTitle: targetShift.title,
      currentSignUps: targetShift.memberIds?.length || 0,
      maxSignUps: targetShift.maxSignUps
    });

    // Check if user is an approved member of this camp
    console.log('🏕️ [SHIFT SIGNUP] Checking camp membership for user:', userId);
    const activeRoster = await db.findActiveRoster({ camp: targetEvent.campId });
    
    if (!activeRoster || !activeRoster.members) {
      console.log('❌ [SHIFT SIGNUP] No active roster found for camp:', targetEvent.campId);
      return res.status(403).json({ message: 'No active roster found for this camp' });
    }

    // Check if user is an approved member
    let userMember = null;
    for (const memberEntry of activeRoster.members) {
      if (memberEntry.member) {
        const member = await db.findMember({ _id: memberEntry.member });
        if (member && member.user && member.status === 'active') {
          const memberId = typeof member.user === 'object' ? member.user._id : member.user;
          if (memberId.toString() === userId.toString()) {
            userMember = member;
            break;
          }
        }
      }
    }

    if (!userMember) {
      console.log('❌ [SHIFT SIGNUP] User is not an approved member of this camp');
      return res.status(403).json({ message: 'Only approved camp members can sign up for shifts' });
    }

    console.log('✅ [SHIFT SIGNUP] User is approved member:', {
      memberId: userMember._id,
      userId: userId
    });

    // Check if user is already signed up
    if (targetShift.memberIds && targetShift.memberIds.includes(userId)) {
      console.log('⚠️ [SHIFT SIGNUP] User already signed up for this shift');
      return res.status(400).json({ message: 'You are already signed up for this shift' });
    }

    // Check capacity limits (transactional check)
    const currentSignUps = targetShift.memberIds ? targetShift.memberIds.length : 0;
    console.log('📊 [SHIFT SIGNUP] Capacity check:', {
      currentSignUps,
      maxSignUps: targetShift.maxSignUps,
      available: targetShift.maxSignUps - currentSignUps
    });

    if (currentSignUps >= targetShift.maxSignUps) {
      console.log('❌ [SHIFT SIGNUP] Shift is at capacity');
      return res.status(409).json({ 
        message: 'This shift is now full. Please try a different shift.',
        currentSignUps,
        maxSignUps: targetShift.maxSignUps
      });
    }

    // Add user to shift memberIds
    console.log('📝 [SHIFT SIGNUP] Adding user to shift memberIds');
    if (!targetShift.memberIds) {
      targetShift.memberIds = [];
    }
    targetShift.memberIds.push(userId);

    // Update the event with the modified shift
    console.log('💾 [SHIFT SIGNUP] Updating event with new shift data');
    await db.updateEvent(targetEvent._id, targetEvent);

    // Mark the user's volunteer shift task as completed (first sign-up only)
    console.log('🎯 [SHIFT SIGNUP] Looking for user\'s volunteer shift task');
    const userTasks = await db.findTasks({
      assignedTo: userId,
      'metadata.eventId': targetEvent._id,
      type: 'volunteer_shift',
      status: 'open'
    });

    console.log(`📊 [SHIFT SIGNUP] Found ${userTasks.length} pending volunteer shift tasks for this event`);

    if (userTasks.length > 0) {
      // Update the first matching task to completed
      const taskToComplete = userTasks[0];
      console.log('✅ [SHIFT SIGNUP] Marking task as completed:', taskToComplete._id);
      
      const updatedTaskData = {
        ...taskToComplete,
        status: 'closed',
        completedAt: new Date().toISOString(),
        completedBy: userId
      };
      
      await db.updateTask(taskToComplete._id, updatedTaskData);
      console.log('✅ [SHIFT SIGNUP] Task marked as completed');
    } else {
      console.log('⚠️ [SHIFT SIGNUP] No pending volunteer shift task found for this user/event');
    }

    console.log('🎉 [SHIFT SIGNUP] Sign-up process completed successfully');

    res.json({
      message: 'Successfully signed up for shift',
      shiftId: targetShift._id,
      eventId: targetEvent._id,
      currentSignUps: targetShift.memberIds.length,
      maxSignUps: targetShift.maxSignUps
    });
  } catch (error) {
    console.error('❌ [SHIFT SIGNUP] Critical error during sign-up:', error);
    res.status(500).json({ 
      message: 'Server error during shift sign-up',
      error: error.message
    });
  }
});

// @route   GET /api/shifts/events/:eventId
// @desc    Get a specific event with shifts (for member sign-up view)
// @access  Private (Approved camp members only)
router.get('/events/:eventId', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 [EVENT DETAIL] Fetching event for sign-up view');
    console.log('📝 [EVENT DETAIL] Request params:', { eventId: req.params.eventId, userId: req.user._id });
    
    const { eventId } = req.params;
    
    // Find the event
    const event = await db.findEvent({ _id: eventId });
    if (!event) {
      console.log('❌ [EVENT DETAIL] Event not found:', eventId);
      return res.status(404).json({ message: 'Event not found' });
    }

    console.log('✅ [EVENT DETAIL] Event found:', {
      id: event._id,
      name: event.eventName,
      shiftsCount: event.shifts?.length || 0
    });

    // Check if user is an approved member of this camp (authorization check)
    const activeRoster = await db.findActiveRoster({ camp: event.campId });
    
    if (!activeRoster || !activeRoster.members) {
      console.log('❌ [EVENT DETAIL] No active roster found for camp:', event.campId);
      return res.status(403).json({ message: 'Access denied - no active roster' });
    }

    // Verify user is approved member
    let isApprovedMember = false;
    for (const memberEntry of activeRoster.members) {
      if (memberEntry.member) {
        const member = await db.findMember({ _id: memberEntry.member });
        if (member && member.user && member.status === 'active') {
          const memberId = typeof member.user === 'object' ? member.user._id : member.user;
          if (memberId.toString() === req.user._id.toString()) {
            isApprovedMember = true;
            console.log('✅ [EVENT DETAIL] User verified as approved member:', { memberId: member._id, userId: req.user._id });
            break;
          }
        }
      }
    }

    if (!isApprovedMember) {
      console.log('❌ [EVENT DETAIL] User is not an approved member of this camp');
      return res.status(403).json({ message: 'Access denied - not an approved camp member' });
    }

    console.log('✅ [EVENT DETAIL] User is approved member, returning event data');

    res.json(event);
  } catch (error) {
    console.error('❌ [EVENT DETAIL] Error fetching event:', error);
    res.status(500).json({ 
      message: 'Server error fetching event',
      error: error.message
    });
  }
});

module.exports = router;
