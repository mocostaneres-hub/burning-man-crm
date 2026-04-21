const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

/**
 * All event and shift dates/times are stored in UTC, but interpreted as PDT (UTC-7, America/Los_Angeles).
 * Burning Man takes place in late August / early September, which is always PDT.
 * Using the fixed offset -07:00 is correct for this event window.
 */
const PDT_OFFSET = '-07:00';

/**
 * Parses a date string (YYYY-MM-DD) + time string (HH:MM) as PDT and returns a UTC Date.
 * If endTime < startTime (overnight), the end date is bumped forward one day automatically.
 */
const parsePdtDateTime = (dateStr, timeStr, { referenceStartIso = null } = {}) => {
  if (!dateStr || !timeStr) return null;
  const iso = `${dateStr}T${timeStr}:00${PDT_OFFSET}`;
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return null;
  // Auto-advance end-of-day past midnight if end is before or equal to start
  if (referenceStartIso) {
    const startDt = new Date(referenceStartIso);
    if (!isNaN(startDt.getTime()) && dt.getTime() <= startDt.getTime()) {
      return new Date(dt.getTime() + 24 * 60 * 60 * 1000);
    }
  }
  return dt;
};

/**
 * Parses a date-only string (YYYY-MM-DD) as noon PDT to safely represent the calendar day
 * without risk of rolling to the previous day due to timezone conversion.
 */
const parsePdtDate = (dateStr) => {
  if (!dateStr) return null;
  const dt = new Date(`${dateStr}T12:00:00${PDT_OFFSET}`);
  return isNaN(dt.getTime()) ? null : dt;
};
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/databaseAdapter');
const { getUserCampId, canAccessCamp } = require('../utils/permissionHelpers');
const Event = require('../models/Event');
const ShiftAssignment = require('../models/ShiftAssignment');
const ShiftSignup = require('../models/ShiftSignup');
const NotificationModel = require('../models/Notification');
const { buildMyShiftsPayload } = require('../services/shiftService');
const {
  resolveAssignmentCandidates,
  createShiftAssignments,
  getShiftAssignmentState
} = require('../services/shiftService');
const { createBulkNotifications } = require('../services/notificationService');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');
const { sendEmail } = require('../services/emailService');
const { EMAIL_TEMPLATE_KEYS } = require('../constants/emailTemplateKeys');
const { recordActivity } = require('../services/activityLogger');
const {
  getTemplateByKey,
  renderTemplateString
} = require('../services/emailTemplateService');

// Test route to verify this file is being loaded
router.get('/debug-test', (req, res) => {
  res.json({ message: 'Shifts router loaded successfully', timestamp: new Date().toISOString() });
});

const useMongo = !!process.env.MONGODB_URI || !!process.env.MONGO_URI;

const resolveEventAndShift = async (shiftId) => {
  if (useMongo) {
    const event = await Event.findOne({ 'shifts._id': shiftId });
    if (!event) return { event: null, shift: null };
    const shift = event.shifts.id(shiftId) || event.shifts.find(s => s._id.toString() === shiftId.toString());
    return { event, shift };
  }

  const shift = await db.findShift({ _id: shiftId });
  if (!shift) return { event: null, shift: null };
  const event = await db.findEvent({ _id: shift.eventId });
  if (!event) return { event: null, shift: null };
  const eventShift = event.shifts.find(s => s._id.toString() === shiftId.toString()) || shift;
  return { event, shift: eventShift };
};

const getCampManagerRecipientIds = async (campId) => {
  const normalizedCampId = campId?._id ? campId._id : campId;
  const recipientIds = new Set();
  const camp = await db.findCamp({ _id: normalizedCampId });
  if (camp?.owner) {
    recipientIds.add(camp.owner.toString());
  }

  const activeRoster = await db.findActiveRoster({ camp: normalizedCampId });
  for (const memberEntry of activeRoster?.members || []) {
    if (memberEntry?.isCampLead !== true || memberEntry?.status !== 'approved' || !memberEntry?.member?.user) continue;
    recipientIds.add(memberEntry.member.user._id?.toString?.() || memberEntry.member.user.toString());
  }

  return Array.from(recipientIds);
};

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
    const shiftIds = events.flatMap((event) => (event.shifts || []).map((shift) => shift._id));
    const signups = shiftIds.length > 0
      ? await ShiftSignup.find({ shiftId: { $in: shiftIds } }).select('shiftId userId').lean()
      : [];

    const signupMap = new Map();
    for (const signup of signups) {
      const shiftId = signup.shiftId.toString();
      if (!signupMap.has(shiftId)) signupMap.set(shiftId, []);
      signupMap.get(shiftId).push(signup.userId.toString());
    }

    const hydratedEvents = events.map((event) => {
      const plainEvent = typeof event.toObject === 'function' ? event.toObject() : event;
      plainEvent.shifts = (plainEvent.shifts || []).map((shift) => {
        const memberIds = [...new Set([
          ...(shift.memberIds || []).map((id) => id.toString()),
          ...(signupMap.get(shift._id.toString()) || [])
        ])];
        return {
          ...shift,
          memberIds,
          currentSignups: memberIds.length
        };
      });
      return plainEvent;
    });

    res.json({ events: hydratedEvents });
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

    const shiftIds = allEvents.flatMap((event) => (event.shifts || []).map((shift) => shift._id));
    const signups = shiftIds.length > 0
      ? await ShiftSignup.find({ shiftId: { $in: shiftIds } }).select('shiftId userId').lean()
      : [];
    const signupMap = new Map();
    for (const signup of signups) {
      const shiftId = signup.shiftId.toString();
      if (!signupMap.has(shiftId)) signupMap.set(shiftId, []);
      signupMap.get(shiftId).push(signup.userId.toString());
    }

    const hydratedEvents = allEvents.map((event) => {
      const plainEvent = typeof event.toObject === 'function' ? event.toObject() : event;
      plainEvent.shifts = (plainEvent.shifts || []).map((shift) => {
        const memberIds = [...new Set([
          ...(shift.memberIds || []).map((id) => id.toString()),
          ...(signupMap.get(shift._id.toString()) || [])
        ])];
        return {
          ...shift,
          memberIds,
          currentSignups: memberIds.length
        };
      });
      return plainEvent;
    });

    console.log('✅ [MY EVENTS] Found events:', hydratedEvents.length);
    res.json({ events: hydratedEvents });
  } catch (error) {
    console.error('❌ [MY EVENTS] Error fetching events:', error);
    res.status(500).json({
      message: 'Server error fetching events',
      error: error.message
    });
  }
});

// @route   GET /api/shifts/my-shifts
// @desc    Get shift-centric payload for personal members
// @access  Private (Personal accounts)
router.get('/my-shifts', authenticateToken, async (req, res) => {
  try {
    if (req.user.accountType !== 'personal') {
      return res.status(403).json({ message: 'Personal account required' });
    }

    const payload = await buildMyShiftsPayload(req.user._id);
    return res.json(payload);
  } catch (error) {
    console.error('Get my shifts error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/shifts/events
// @desc    Create a new event with shifts
// @access  Private (Camp admins/leads only)
router.post('/events', authenticateToken, async (req, res) => {
  try {
    const {
      eventName,
      description,
      eventDate,
      startTime,
      endTime,
      shifts
    } = req.body;

    // Validation
    if (!eventName || !eventDate || !startTime || !endTime || !shifts || !Array.isArray(shifts) || shifts.length === 0) {
      return res.status(400).json({ message: 'Event name, event date/time, and at least one shift are required' });
    }

    // Get camp ID for camp owners
    let campId;
    
    if (req.user.accountType === 'camp' || (req.user.accountType === 'admin' && req.user.campId)) {
      campId = await getUserCampId(req);
      if (!campId) {
        return res.status(404).json({ message: 'Unable to determine camp context' });
      }
    }
    // For Camp Leads: get campId from body or query parameter
    else if (req.body.campId || req.query.campId) {
      const targetCampId = req.body.campId || req.query.campId;
      const { canManageCamp } = require('../utils/permissionHelpers');
      const hasAccess = await canManageCamp(req, targetCampId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
      }
      campId = targetCampId;
    } else {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    // Validate shifts
    for (const shift of shifts) {
      if (!shift.title || !shift.date || !shift.startTime || !shift.endTime || !shift.maxSignUps) {
        return res.status(400).json({ message: 'All shift fields are required' });
      }
    }

    // Parse event-level times as PDT
    const eventStartIso = parsePdtDateTime(eventDate, startTime);
    const eventEndIso = parsePdtDateTime(eventDate, endTime, { referenceStartIso: eventStartIso });

    // Create event
    const event = await db.createEvent({
      eventName,
      description,
      eventDate: parsePdtDate(eventDate),
      startTime: eventStartIso,
      endTime: eventEndIso,
      campId,
      createdBy: req.user._id,
      shifts: shifts.map(shift => {
        const shiftStart = parsePdtDateTime(shift.date, shift.startTime);
        const shiftEnd = parsePdtDateTime(shift.date, shift.endTime, { referenceStartIso: shiftStart });
        return {
          title: shift.title,
          description: shift.description || '',
          date: parsePdtDate(shift.date),
          startTime: shiftStart,
          endTime: shiftEnd,
          maxSignUps: parseInt(shift.maxSignUps),
          requiredSkills: Array.isArray(shift.requiredSkills)
            ? shift.requiredSkills.map((skill) => String(skill || '').trim()).filter(Boolean)
            : [],
          memberIds: [], // legacy compatibility field (source of truth is ShiftSignup collection)
          currentSignups: 0,
          createdBy: req.user._id
        };
      })
    });

    // Create shift assignments.
    for (let index = 0; index < (event.shifts || []).length; index += 1) {
      const createdShift = event.shifts[index];
      const inputShift = shifts[index] || {};
      const shiftAssignmentMode = inputShift.assignmentMode || 'ALL_ROSTER';
      const assignmentCandidates = await resolveAssignmentCandidates({
        campId,
        mode: shiftAssignmentMode,
        selectedUserIds: inputShift.selectedUserIds || [],
        manualAddIds: inputShift.manualAddIds || [],
        manualRemoveIds: inputShift.manualRemoveIds || []
      });
      await createShiftAssignments({
        shiftId: createdShift._id,
        eventId: event._id,
        campId,
        assignedBy: req.user._id,
        mode: shiftAssignmentMode,
        candidates: assignmentCandidates,
        source: 'CREATE_MODE'
      });
    }

    try {
      const activeMembers = await db.findMembers({ camp: campId, status: 'active' });
      const recipientIds = [...new Set(activeMembers.map((member) => member.user?.toString()).filter(Boolean))];
      await createBulkNotifications(recipientIds, {
        actor: req.user._id,
        campId,
        type: NOTIFICATION_TYPES.SHIFT_CREATED,
        title: `New volunteer event: ${event.eventName}`,
        message: `${event.shifts?.length || 0} shift(s) are now available to sign up.`,
        link: '/my-shifts',
        metadata: { eventId: event._id }
      });
    } catch (notificationError) {
      console.error('Create event notification error:', notificationError);
    }

    res.status(201).json({ event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/shifts/events/invite-entire-roster
// @desc    Invite entire roster to all available shifts (one generic invite per member)
// @access  Private (Camp admins/leads only)
router.post('/events/invite-entire-roster', authenticateToken, async (req, res) => {
  try {
    const previewOnly = req.body?.previewOnly === true;
    const skipRecentDays = Math.max(parseInt(req.body?.skipRecentDays, 10) || 0, 0);
    const scheduleAtRaw = req.body?.scheduleAt;
    const scheduleAt = scheduleAtRaw ? new Date(scheduleAtRaw) : null;
    // Resolve camp context (camp accounts/admins vs Camp Leads)
    let campId;
    if (req.user.accountType === 'camp' || (req.user.accountType === 'admin' && req.user.campId)) {
      campId = await getUserCampId(req);
      if (!campId) {
        return res.status(404).json({ message: 'Unable to determine camp context' });
      }
    } else if (req.body.campId || req.query.campId) {
      const targetCampId = req.body.campId || req.query.campId;
      const { canManageCamp } = require('../utils/permissionHelpers');
      const hasAccess = await canManageCamp(req, targetCampId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
      }
      campId = targetCampId;
    } else {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    // Ensure roster exists
    const activeRoster = await db.findActiveRoster({ camp: campId });
    if (!activeRoster || !Array.isArray(activeRoster.members) || activeRoster.members.length === 0) {
      return res.status(400).json({ message: 'No active roster found for this camp' });
    }

    // Find all events and shifts for this camp
    const events = await db.findEvents({ campId });
    const availableShifts = [];
    for (const event of events || []) {
      for (const shift of event.shifts || []) {
        const max = shift.maxSignUps || 0;
        if (max <= 0) continue;
        const current = Math.max(
          shift.currentSignups || 0,
          (shift.memberIds || []).length
        );
        if (current < max) {
          availableShifts.push({ eventId: event._id, shiftId: shift._id });
        }
      }
    }

    if (availableShifts.length === 0) {
      return res.status(400).json({ message: 'No available shifts to invite roster to' });
    }

    // Idempotency safeguard: avoid spamming if a bulk invite was recently sent
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentBulk = await NotificationModel.exists({
      campId,
      type: NOTIFICATION_TYPES.SHIFT_BULK_INVITE_ALL,
      'metadata.scope': 'all_shifts',
      createdAt: { $gte: tenMinutesAgo }
    });
    if (recentBulk) {
      return res.status(200).json({
        message: 'A bulk invite was already sent recently. Skipping duplicate sends.',
        invitedCount: 0,
        availableShiftCount: availableShifts.length
      });
    }

    // Collect recipients from active roster (supports shifts-only members without accounts).
    const rosterUserIds = new Set();
    const rosterOnlyRecipients = [];
    for (const memberEntry of activeRoster.members) {
      if (!memberEntry.member) continue;
      const memberRef = memberEntry.member;
      const member = (typeof memberRef === 'object' && memberRef._id)
        ? memberRef
        : await db.findMember({ _id: memberEntry.member });
      if (!member) continue;

      const memberStatus = (member.status || memberEntry.status || '').toLowerCase();
      if (!['approved', 'active', 'roster_only', 'invited'].includes(memberStatus)) continue;

      const userId = typeof member.user === 'object' ? member.user?._id : member.user;
      if (userId) {
        rosterUserIds.add(userId.toString());
      } else if (member.email) {
        rosterOnlyRecipients.push({
          memberId: member._id?.toString(),
          email: String(member.email).trim().toLowerCase(),
          name: member.name || ''
        });
      }
    }

    if (rosterUserIds.size === 0 && rosterOnlyRecipients.length === 0) {
      return res.status(400).json({ message: 'No eligible roster members found to invite' });
    }

    const userIds = Array.from(rosterUserIds);
    const users = await db.findUsers({ _id: { $in: userIds } }) || [];
    const userEmailMap = new Map(
      users
        .filter((u) => u.email && u.email.trim() !== '')
        .map((u) => [u._id.toString(), u.email])
    );

    const clientUrl = process.env.CLIENT_URL || 'https://g8road.com';
    const camp = await db.findCamp({ _id: campId });
    const campName = (camp && (camp.name || camp.campName)) || 'your camp';
    const shiftsUrl = `${clientUrl}/my-shifts`;

    if (skipRecentDays > 0) {
      const windowStart = new Date(Date.now() - skipRecentDays * 24 * 60 * 60 * 1000);
      const recentUserNotifications = await NotificationModel.find({
        recipient: { $in: userIds },
        campId,
        type: NOTIFICATION_TYPES.SHIFT_BULK_INVITE_ALL,
        createdAt: { $gte: windowStart }
      }).select('recipient').lean();
      const recentlyInvitedUserIds = new Set(
        recentUserNotifications.map((item) => (item.recipient ? item.recipient.toString() : null)).filter(Boolean)
      );
      for (const recentId of recentlyInvitedUserIds) {
        rosterUserIds.delete(recentId);
      }

      const filteredRosterOnly = rosterOnlyRecipients.filter((recipient) => {
        const member = activeRoster.members.find((entry) => {
          const memberId = entry?.member?._id ? entry.member._id.toString() : entry?.member?.toString();
          return memberId && recipient.memberId && memberId === recipient.memberId;
        })?.member;
        const invitedAt = member?.invitedAt ? new Date(member.invitedAt) : null;
        return !invitedAt || invitedAt < windowStart;
      });
      rosterOnlyRecipients.length = 0;
      rosterOnlyRecipients.push(...filteredRosterOnly);
    }

    if (previewOnly) {
      return res.json({
        message: 'Invite preview generated.',
        invitedCount: 0,
        availableShiftCount: availableShifts.length,
        recipientPreview: {
          existingUsers: rosterUserIds.size,
          rosterOnly: rosterOnlyRecipients.length,
          total: rosterUserIds.size + rosterOnlyRecipients.length
        }
      });
    }

    const template = await getTemplateByKey(EMAIL_TEMPLATE_KEYS.SHIFT_BULK_INVITE_ALL);
    const templateData = {
      camp_name: campName,
      invite_link: shiftsUrl,
      user_name: ''
    };

    const subject = renderTemplateString(template?.subject, templateData);
    const htmlBody = renderTemplateString(template?.htmlContent, templateData);
    const textBody =
      renderTemplateString(template?.textContent, templateData) ||
      `${campName} has open volunteer shifts available.\n\nVisit your shifts page to view and sign up: ${shiftsUrl}`;

    const executeBulkInvite = async () => {
      const userIdsToSend = Array.from(rosterUserIds);
      // Send one email per existing user account
      for (const userId of userIdsToSend) {
        const email = userEmailMap.get(userId);
        if (!email) continue;
        try {
          await sendEmail({
            to: email,
            subject,
            html: htmlBody,
            text: textBody
          });
        } catch (emailError) {
          console.error('Bulk shift invite email error for user', userId, emailError);
        }
      }

      // Send one email per roster-only member (no user account yet) with invite token.
      for (const recipient of rosterOnlyRecipients) {
        try {
          const crypto = require('crypto');
          const token = crypto.randomBytes(24).toString('hex');
          const signupUrl = `${clientUrl}/apply?invite_token=${token}`;
          await db.createInvite({
            campId,
            senderId: req.user._id,
            recipient: recipient.email,
            method: 'email',
            token,
            status: 'sent',
            inviteType: 'shifts_only',
            signupSource: 'shifts_only_invite',
            memberId: recipient.memberId
          });

          await db.updateMember(recipient.memberId, {
            status: 'invited',
            invitedAt: new Date(),
            inviteToken: token,
            isShiftsOnly: true,
            signupSource: 'shifts_only_invite'
          });

          const inviteSubject = `${campName} invited you to sign up for available shifts`;
          const inviteTextBody = `${campName} has volunteer shifts available that could use your help.\n\nCreate your account and browse shifts: ${signupUrl}`;
          const inviteHtmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>${campName} invited you to sign up for available shifts</h2>
              <p>${campName} has volunteer shifts available that could use your help.</p>
              <p><a href="${signupUrl}" style="background-color: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Create Account and View Shifts</a></p>
            </div>
          `;
          await sendEmail({
            to: recipient.email,
            subject: inviteSubject,
            html: inviteHtmlBody,
            text: inviteTextBody
          });
        } catch (emailError) {
          console.error('Bulk shifts-only invite email error for member', recipient.memberId, emailError);
        }
      }

      // Create one in-app notification per user
      await createBulkNotifications(userIdsToSend, {
        actor: req.user._id,
        campId,
        type: NOTIFICATION_TYPES.SHIFT_BULK_INVITE_ALL,
        title: 'Camp invited you to sign up for shifts',
        message: 'Your camp has volunteer shifts available. Visit My Shifts to browse and sign up.',
        link: '/my-shifts',
        metadata: {
          scope: 'all_shifts',
          campId,
          availableShiftCount: availableShifts.length
        }
      });
    };

    if (scheduleAt && !Number.isNaN(scheduleAt.getTime()) && scheduleAt.getTime() > Date.now()) {
      const delayMs = scheduleAt.getTime() - Date.now();
      setTimeout(() => {
        executeBulkInvite().catch((error) => {
          console.error('Scheduled bulk invite failed:', error);
        });
      }, delayMs);
      return res.json({
        message: `Bulk invite scheduled for ${scheduleAt.toISOString()}.`,
        invitedCount: rosterUserIds.size + rosterOnlyRecipients.length,
        availableShiftCount: availableShifts.length
      });
    }

    await executeBulkInvite();

    return res.json({
      message: 'Bulk invite sent to roster members.',
      invitedCount: rosterUserIds.size + rosterOnlyRecipients.length,
      availableShiftCount: availableShifts.length
    });
  } catch (error) {
    console.error('Bulk roster invite error:', error);
    return res.status(500).json({ message: 'Server error while sending roster invites' });
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
    return res.status(410).json({
      message: 'Shift-as-task assignment has been deprecated. Use the My Shifts experience instead.'
    });

    console.log('🔄 [TASK ASSIGNMENT] Starting task assignment process');
    console.log('📝 [TASK ASSIGNMENT] Request params:', { eventId: req.params.eventId });
    console.log('📝 [TASK ASSIGNMENT] Request body:', req.body);
    
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

    // Verify access for camp admins/leads
    const eventCampId = event.campId?._id ? event.campId._id.toString() : event.campId.toString();
    const { canManageCamp } = require('../utils/permissionHelpers');
    const hasAccess = await canManageCamp(req, eventCampId);
    if (!hasAccess) {
      console.log('❌ [TASK ASSIGNMENT] Permission denied - not camp owner or Camp Lead');
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    const campId = eventCampId;
    console.log('🏕️ [TASK ASSIGNMENT] Camp ID resolved:', campId);
    console.log('🔒 [TASK ASSIGNMENT] Event camp ID:', eventCampId);

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
    const memberId = req.user._id.toString();

    const { event, shift } = await resolveEventAndShift(shiftId);
    if (!event || !shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    const existingSignup = await ShiftSignup.findOne({ shiftId: shift._id, userId: req.user._id }).lean();
    const legacySigned = (shift.memberIds || []).some((id) => id.toString() === memberId);
    if (!existingSignup && !legacySigned) {
      return res.status(400).json({ message: 'Not signed up for this shift' });
    }

    const previousCount = Math.max(
      await ShiftSignup.countDocuments({ shiftId: shift._id }),
      (shift.memberIds || []).length,
      shift.currentSignups || 0
    );
    if (existingSignup) {
      await ShiftSignup.deleteOne({ _id: existingSignup._id });
    }
    await Event.updateOne(
      { _id: event._id, 'shifts._id': shift._id, 'shifts.currentSignups': { $gt: 0 } },
      { $inc: { 'shifts.$.currentSignups': -1 } }
    );
    await Event.updateOne(
      { _id: event._id, 'shifts._id': shift._id },
      { $pull: { 'shifts.$.memberIds': req.user._id } }
    );

    try {
      const managerRecipients = await getCampManagerRecipientIds(event.campId);
      await createBulkNotifications(managerRecipients, {
        actor: req.user._id,
        campId: event.campId,
        type: NOTIFICATION_TYPES.SHIFT_UNSIGNUP,
        title: `Shift signup cancelled: ${shift.title}`,
        message: `${req.user.firstName || 'A member'} ${req.user.lastName || ''}`.trim() + ' cancelled a shift signup.',
        link: `/camp/${event.campId}/events`,
        metadata: {
          eventId: event._id,
          shiftId: shift._id,
          memberId: req.user._id
        }
      });
    } catch (notificationError) {
      console.error('Shift unsignup notification error:', notificationError);
    }

    if (previousCount >= (shift.maxSignUps || 0)) {
      try {
        const assignedUsers = await ShiftAssignment.find({ shiftId: shift._id }).select('userId').lean();
        const recipients = [...new Set(assignedUsers.map((item) => item.userId.toString()).filter((id) => id !== memberId))];
        await createBulkNotifications(recipients, {
          actor: req.user._id,
          campId: event.campId,
          type: NOTIFICATION_TYPES.SHIFT_SPOT_OPENED,
          title: `Spot opened: ${shift.title}`,
          message: 'A spot just opened up on a shift you are assigned to.',
          link: '/my-shifts',
          metadata: { eventId: event._id, shiftId: shift._id }
        });
      } catch (notificationError) {
        console.error('Shift spot-opened notification error:', notificationError);
      }
    }

    // Audit trail: record cancellation against both the User and the Member.
    try {
      const activityDetails = {
        field: 'shift',
        campId: event.campId?._id || event.campId,
        eventId: event._id,
        eventName: event.eventName || event.name,
        shiftId: shift._id,
        shiftTitle: shift.title,
        shiftDate: shift.date,
        note: 'Member cancelled their shift signup'
      };
      await recordActivity('MEMBER', req.user._id, req.user._id, 'SHIFT_UNSIGNUP', activityDetails);
      // Best-effort: look up the Member document in this camp for this user.
      const campScopedMember = await db.findMember({
        camp: event.campId?._id || event.campId,
        user: req.user._id
      });
      if (campScopedMember?._id) {
        await recordActivity('MEMBER', campScopedMember._id, req.user._id, 'SHIFT_UNSIGNUP', activityDetails);
      }
    } catch (auditErr) {
      console.error('⚠️ [SHIFT UNSIGNUP] Activity log failed (non-fatal):', auditErr?.message);
    }

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
    const shiftIds = events.flatMap((event) => (event.shifts || []).map((shift) => shift._id));
    const signups = shiftIds.length > 0
      ? await ShiftSignup.find({ shiftId: { $in: shiftIds } }).select('shiftId userId').lean()
      : [];

    // Build per-person report (bulk user lookup to avoid N+1)
    const report = [];
    const memberIds = new Set(signups.map((signup) => signup.userId.toString()));
    const signupMap = new Map();
    for (const signup of signups) {
      const sid = signup.shiftId.toString();
      if (!signupMap.has(sid)) signupMap.set(sid, []);
      signupMap.get(sid).push(signup.userId.toString());
    }
    for (const event of events) {
      for (const shift of event.shifts || []) {
        const sid = shift._id.toString();
        if (!signupMap.has(sid)) signupMap.set(sid, []);
        for (const memberId of shift.memberIds || []) {
          const value = memberId.toString();
          if (!signupMap.get(sid).includes(value)) signupMap.get(sid).push(value);
        }
      }
    }

    const users = memberIds.size > 0
      ? await db.findUsers({ _id: { $in: Array.from(memberIds) } })
      : [];
    const userMap = new Map((users || []).map(user => [user._id.toString(), user]));

    for (const event of events) {
      for (const shift of event.shifts) {
        for (const memberId of signupMap.get(shift._id.toString()) || []) {
          const user = userMap.get(memberId.toString());
          if (user) {
            report.push({
              personName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
              email: user.email,
              date: shift.date,
              eventName: event.eventName,
              shiftTime: `${new Date(shift.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Los_Angeles' })} – ${new Date(shift.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Los_Angeles' })}`,
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
    const shiftIds = events.flatMap((event) => (event.shifts || []).map((shift) => shift._id));
    const signups = shiftIds.length > 0
      ? await ShiftSignup.find({ shiftId: { $in: shiftIds } }).select('shiftId userId').lean()
      : [];
    const signupMap = new Map();
    for (const signup of signups) {
      const sid = signup.shiftId.toString();
      if (!signupMap.has(sid)) signupMap.set(sid, []);
      signupMap.get(sid).push(signup.userId.toString());
    }
    for (const event of events) {
      for (const shift of event.shifts || []) {
        const sid = shift._id.toString();
        if (!signupMap.has(sid)) signupMap.set(sid, []);
        for (const memberId of shift.memberIds || []) {
          const value = memberId.toString();
          if (!signupMap.get(sid).includes(value)) signupMap.get(sid).push(value);
        }
      }
    }
    
    // Build per-day report for the specified date (bulk user lookup)
    const report = [];
    const targetDate = new Date(date);

    const shiftsForDay = [];
    for (const event of events) {
      for (const shift of event.shifts) {
        const shiftDate = new Date(shift.date);
        if (shiftDate.toDateString() === targetDate.toDateString()) {
          shiftsForDay.push({ event, shift });
        }
      }
    }

    const memberIds = new Set();
    shiftsForDay.forEach(({ shift }) => {
      (signupMap.get(shift._id.toString()) || []).forEach(memberId => memberIds.add(memberId.toString()));
    });

    const users = memberIds.size > 0
      ? await db.findUsers({ _id: { $in: Array.from(memberIds) } })
      : [];
    const userMap = new Map((users || []).map(user => [user._id.toString(), user]));

    for (const { event, shift } of shiftsForDay) {
      for (const memberId of signupMap.get(shift._id.toString()) || []) {
        const user = userMap.get(memberId.toString());
        if (user) {
          report.push({
            personName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            email: user.email,
            date: shift.date,
            eventName: event.eventName,
            shiftTime: `${new Date(shift.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Los_Angeles' })} – ${new Date(shift.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Los_Angeles' })}`,
            description: shift.description
          });
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
    const { eventId } = req.params;
    const {
      eventName,
      description,
      eventDate,
      startTime,
      endTime,
      shifts
    } = req.body;

    // Validation
    if (!eventName || !eventDate || !startTime || !endTime || !shifts || !Array.isArray(shifts) || shifts.length === 0) {
      return res.status(400).json({ message: 'Event name, event date/time, and at least one shift are required' });
    }

    // Check if event exists
    const existingEvent = await db.findEvent({ _id: eventId });
    if (!existingEvent) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Verify user has access to this camp (includes Camp Leads)
    const eventCampId = (existingEvent.campId && existingEvent.campId._id ? existingEvent.campId._id : existingEvent.campId).toString();
    const { canManageCamp } = require('../utils/permissionHelpers');
    const hasAccess = await canManageCamp(req, eventCampId);
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied - must be camp owner or Camp Lead' });
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

    const existingShiftIds = new Set((existingEvent.shifts || []).map((shift) => shift._id.toString()));
    const incomingShiftIds = new Set(
      shifts
        .map((shift) => (shift._id ? shift._id.toString() : null))
        .filter(Boolean)
    );
    const removedShiftIds = [...existingShiftIds].filter((id) => !incomingShiftIds.has(id));

    // Parse event-level times as PDT
    const updEventStart = parsePdtDateTime(eventDate, startTime);
    const updEventEnd = parsePdtDateTime(eventDate, endTime, { referenceStartIso: updEventStart });

    // Update event
    const updatedEvent = await db.updateEvent(eventId, {
      eventName,
      description,
      eventDate: parsePdtDate(eventDate),
      startTime: updEventStart,
      endTime: updEventEnd,
      shifts: shifts.map((shift) => {
        const existingShift = shift._id
          ? existingEvent.shifts.find((item) => item._id.toString() === shift._id.toString())
          : null;
        const shiftId = existingShift ? existingShift._id : new mongoose.Types.ObjectId();
        const shiftStart = parsePdtDateTime(shift.date, shift.startTime);
        const shiftEnd = parsePdtDateTime(shift.date, shift.endTime, { referenceStartIso: shiftStart });

        return {
          _id: shiftId,
          eventId: eventId,
          title: shift.title,
          description: shift.description || '',
          date: parsePdtDate(shift.date),
          startTime: shiftStart,
          endTime: shiftEnd,
          maxSignUps: parseInt(shift.maxSignUps),
          requiredSkills: Array.isArray(shift.requiredSkills)
            ? shift.requiredSkills.map((skill) => String(skill || '').trim()).filter(Boolean)
            : [],
          memberIds: existingShift ? existingShift.memberIds : [],
          currentSignups: existingShift ? (existingShift.currentSignups || 0) : 0,
          createdBy: existingShift ? existingShift.createdBy : req.user._id,
          createdAt: existingShift ? existingShift.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      })
    });

    if (removedShiftIds.length > 0) {
      await ShiftAssignment.deleteMany({ shiftId: { $in: removedShiftIds } });
      await ShiftSignup.deleteMany({ shiftId: { $in: removedShiftIds } });
    }

    const setsAreEqual = (left, right) => {
      if (left.size !== right.size) return false;
      for (const value of left) {
        if (!right.has(value)) return false;
      }
      return true;
    };

    // Per-shift assignment update during edit mode.
    // Safeguard: skip rewrites when desired assignees already match existing assignment rows
    // (e.g., event name/description-only edits).
    for (const currentShift of updatedEvent.shifts || []) {
      // If members have already signed up for this specific shift, do not rewrite assignments
      // during event edit. This prevents reassignment churn for in-progress staffed shifts.
      const signedUpRows = await ShiftSignup.find({ shiftId: currentShift._id })
        .select('userId')
        .lean();
      const hasSignedUpMembers = signedUpRows.length > 0
        || ((currentShift.memberIds || []).length > 0);
      if (hasSignedUpMembers) {
        continue;
      }

      const sourceShift = shifts.find((shift) =>
        shift._id && shift._id.toString() === currentShift._id.toString()
      );
      const shiftAssignmentMode = sourceShift?.assignmentMode || 'ALL_ROSTER';
      const assignmentCandidates = await resolveAssignmentCandidates({
        campId: eventCampId,
        mode: shiftAssignmentMode,
        selectedUserIds: sourceShift?.selectedUserIds || [],
        manualAddIds: sourceShift?.manualAddIds || [],
        manualRemoveIds: sourceShift?.manualRemoveIds || []
      });

      const existingRows = await ShiftAssignment.find({ shiftId: currentShift._id })
        .select('userId')
        .lean();
      const existingAssigneeIds = new Set(existingRows.map((row) => row.userId.toString()));
      const desiredAssigneeIds = new Set((assignmentCandidates || []).map((id) => id.toString()));
      if (setsAreEqual(existingAssigneeIds, desiredAssigneeIds)) {
        continue;
      }

      await ShiftAssignment.deleteMany({ shiftId: currentShift._id });
      await createShiftAssignments({
        shiftId: currentShift._id,
        eventId: updatedEvent._id,
        campId: eventCampId,
        assignedBy: req.user._id,
        mode: shiftAssignmentMode,
        candidates: assignmentCandidates,
        source: 'EDIT_MODE'
      });
    }

    try {
      const activeMembers = await db.findMembers({ camp: eventCampId, status: 'active' });
      const recipientIds = [...new Set(activeMembers.map((member) => member.user?.toString()).filter(Boolean))];
      await createBulkNotifications(recipientIds, {
        actor: req.user._id,
        campId: eventCampId,
        type: NOTIFICATION_TYPES.SHIFT_UPDATED,
        title: `Volunteer event updated: ${eventName}`,
        message: 'Shift details were updated. Please review your upcoming shifts.',
        link: '/my-shifts',
        metadata: { eventId: eventId }
      });
    } catch (notificationError) {
      console.error('Update event notification error:', notificationError);
    }

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

    // PERMISSION CHECK: Use canManageCamp helper (includes Camp Leads)
    const eventCampId = event.campId?.toString() || event.campId;
    const { canManageCamp } = require('../utils/permissionHelpers');
    const hasAccess = await canManageCamp(req, eventCampId);
    
    if (!hasAccess) {
      console.log('❌ [EVENT DELETION] Permission denied');
      console.log('📝 [EVENT DELETION] User accountType:', req.user.accountType);
      console.log('📝 [EVENT DELETION] User campId:', req.user.campId);
      console.log('📝 [EVENT DELETION] User isCampLead:', req.user.isCampLead);
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required to delete events' });
    }

    console.log('✅ [EVENT DELETION] Permission check passed');
    
    console.log('✅ [EVENT DELETION] Camp scope confirmed');

    // Shift-as-task is deprecated; deleting event no longer mutates Task records.
    // Clean up assignment/signup records tied to this event.
    let deletedTasksCount = 0;
    const failedTaskDeletions = [];
    const tasks = [];
    await ShiftAssignment.deleteMany({ eventId: eventId });
    await ShiftSignup.deleteMany({ eventId: eventId });

    // Step 1: Shifts will be deleted automatically when the event is deleted
    // (shifts are embedded subdocuments in the event)
    const shiftsCount = event.shifts?.length || 0;
    console.log(`📊 [EVENT DELETION] Event contains ${shiftsCount} shifts (will be deleted with event)`);

    // Step 2: Delete the event itself
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

    try {
      const activeMembers = await db.findMembers({ camp: eventCampId, status: 'active' });
      const recipientIds = [...new Set(activeMembers.map((member) => member.user?.toString()).filter(Boolean))];
      await createBulkNotifications(recipientIds, {
        actor: req.user._id,
        campId: eventCampId,
        type: NOTIFICATION_TYPES.SHIFT_DELETED,
        title: `Volunteer event removed: ${event.eventName}`,
        message: 'A volunteer event was deleted by camp leadership.',
        link: '/my-shifts',
        metadata: { eventId }
      });
    } catch (notificationError) {
      console.error('Delete event notification error:', notificationError);
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
    return res.status(410).json({
      message: 'Shift-as-task assignment has been deprecated. Event tasks are no longer managed.'
    });

    console.log('🗑️ [TASK DELETION] Starting task deletion process');
    console.log('📝 [TASK DELETION] Event ID:', req.params.eventId);
    
    const { eventId } = req.params;

    // Check if event exists and user has access
    console.log('🔍 [TASK DELETION] Looking for event:', eventId);
    const event = await db.findEvent({ _id: eventId });
    if (!event) {
      console.log('❌ [TASK DELETION] Event not found:', eventId);
      return res.status(404).json({ message: 'Event not found' });
    }
    console.log('✅ [TASK DELETION] Event found:', { id: event._id, name: event.eventName });

    // Verify access for camp admins/leads
    const eventCampId = event.campId?._id ? event.campId._id.toString() : event.campId.toString();
    const { canManageCamp } = require('../utils/permissionHelpers');
    const hasAccess = await canManageCamp(req, eventCampId);
    if (!hasAccess) {
      console.log('❌ [TASK DELETION] Access denied - not camp owner or Camp Lead');
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    const campId = eventCampId;
    console.log('🏕️ [TASK DELETION] Camp ID resolved:', campId);

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
    return res.status(410).json({
      message: 'Shift-as-task assignment has been deprecated. Use the My Shifts experience instead.'
    });

    console.log('🔄 [TASK SYNC] Starting targeted task assignment update');
    console.log('📝 [TASK SYNC] Request params:', { eventId: req.params.eventId });
    console.log('📝 [TASK SYNC] Request body:', req.body);
    
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

    // Verify access for camp admins/leads
    const eventCampIdStr = (event.campId && event.campId._id ? event.campId._id : event.campId).toString();
    const { canManageCamp } = require('../utils/permissionHelpers');
    const hasAccess = await canManageCamp(req, eventCampIdStr);
    if (!hasAccess) {
      console.log('❌ [TASK SYNC] Access denied - not camp owner or Camp Lead');
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    const campId = eventCampIdStr;
    console.log('🏕️ [TASK SYNC] Camp ID resolved:', campId);

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

// @route   GET /api/shifts/shifts/:shiftId/assignees
// @desc    Get current assignees and non-assigned roster users for a shift
// @access  Private (Camp admins/leads only)
router.get('/shifts/:shiftId/assignees', authenticateToken, async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { event, shift } = await resolveEventAndShift(shiftId);
    if (!event || !shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    const eventCampId = event.campId?._id ? event.campId._id.toString() : event.campId.toString();
    const { canManageCamp } = require('../utils/permissionHelpers');
    const hasAccess = await canManageCamp(req, eventCampId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    const assignmentState = await getShiftAssignmentState({ shiftId: shift._id, campId: eventCampId });
    const userIds = [
      ...assignmentState.assignedUsers.map((user) => user.userId),
      ...assignmentState.unassignedUsers.map((user) => user.userId)
    ];
    const users = userIds.length > 0 ? await db.findUsers({ _id: { $in: userIds } }) : [];
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));

    const mapUser = (entry) => {
      const user = userMap.get(entry.userId);
      return {
        userId: entry.userId,
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        playaName: user?.playaName || '',
        isLead: entry.isLead
      };
    };

    return res.json({
      shiftId,
      assignedUsers: assignmentState.assignedUsers.map(mapUser),
      unassignedUsers: assignmentState.unassignedUsers.map(mapUser)
    });
  } catch (error) {
    console.error('Get shift assignees error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/shifts/shifts/:shiftId/assignees/add
// @desc    Incrementally add assignees to existing shift
// @access  Private (Camp admins/leads only)
router.post('/shifts/:shiftId/assignees/add', authenticateToken, async (req, res) => {
  try {
    const { shiftId } = req.params;
    const { userIds = [] } = req.body || {};
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'userIds array is required' });
    }

    const { event, shift } = await resolveEventAndShift(shiftId);
    if (!event || !shift) {
      return res.status(404).json({ message: 'Shift not found' });
    }

    const eventCampId = event.campId?._id ? event.campId._id.toString() : event.campId.toString();
    const { canManageCamp } = require('../utils/permissionHelpers');
    const hasAccess = await canManageCamp(req, eventCampId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    const assignmentState = await getShiftAssignmentState({ shiftId: shift._id, campId: eventCampId });
    const alreadyAssigned = new Set(assignmentState.assignedUsers.map((user) => user.userId));
    const allowedUsers = new Set(assignmentState.unassignedUsers.map((user) => user.userId));
    const toAdd = userIds
      .map((id) => id?.toString())
      .filter(Boolean)
      .filter((userId) => !alreadyAssigned.has(userId) && allowedUsers.has(userId));

    const result = await createShiftAssignments({
      shiftId: shift._id,
      eventId: event._id,
      campId: eventCampId,
      assignedBy: req.user._id,
      mode: 'SELECTED_USERS',
      candidates: toAdd,
      source: 'EDIT_ADD'
    });

    return res.json({
      message: 'Assignments updated',
      addedCount: result.insertedCount,
      addedUserIds: result.insertedUserIds
    });
  } catch (error) {
    console.error('Add shift assignees error:', error);
    return res.status(500).json({ message: 'Server error' });
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
    const { event: targetEvent, shift: targetShift } = await resolveEventAndShift(shiftId);

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

    // Must be assigned to sign up.
    const assignment = await ShiftAssignment.findOne({ shiftId: targetShift._id, userId }).lean();
    if (!assignment) {
      return res.status(403).json({ message: 'You are not assigned to this shift' });
    }

    // Check if user is already signed up.
    const existingSignup = await ShiftSignup.findOne({ shiftId: targetShift._id, userId }).lean();
    if (existingSignup) {
      console.log('⚠️ [SHIFT SIGNUP] User already signed up for this shift');
      return res.status(400).json({ message: 'You are already signed up for this shift' });
    }
    if ((targetShift.memberIds || []).some((id) => id.toString() === userId.toString())) {
      return res.status(400).json({ message: 'You are already signed up for this shift' });
    }

    // Capacity check.
    let currentSignUps = Math.max(
      await ShiftSignup.countDocuments({ shiftId: targetShift._id }),
      (targetShift.memberIds || []).length,
      targetShift.currentSignups || 0
    );
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

    // Atomic capacity reservation at shift level, then insert signup row.
    const updateResult = await Event.updateOne(
      {
        _id: targetEvent._id,
        'shifts._id': targetShift._id,
        'shifts.currentSignups': { $lt: targetShift.maxSignUps }
      },
      { $inc: { 'shifts.$.currentSignups': 1 } }
    );

    if (!updateResult?.modifiedCount) {
      return res.status(409).json({
        message: 'This shift is now full. Please try a different shift.'
      });
    }

    try {
      await ShiftSignup.create({
        shiftId: targetShift._id,
        eventId: targetEvent._id,
        campId: targetEvent.campId?._id || targetEvent.campId,
        userId,
        createdAt: new Date()
      });
    } catch (signupError) {
      // Roll back reservation on duplicate/insert failure.
      await Event.updateOne(
        { _id: targetEvent._id, 'shifts._id': targetShift._id, 'shifts.currentSignups': { $gt: 0 } },
        { $inc: { 'shifts.$.currentSignups': -1 } }
      );

      if (signupError?.code === 11000) {
        return res.status(400).json({ message: 'You are already signed up for this shift' });
      }
      throw signupError;
    }

    // Keep legacy embedded memberIds in sync for older views.
    await Event.updateOne(
      { _id: targetEvent._id, 'shifts._id': targetShift._id },
      { $addToSet: { 'shifts.$.memberIds': userId } }
    );

    currentSignUps = await ShiftSignup.countDocuments({ shiftId: targetShift._id });

    try {
      const managerRecipients = await getCampManagerRecipientIds(targetEvent.campId);
      await createBulkNotifications(managerRecipients, {
        actor: req.user._id,
        campId: targetEvent.campId,
        type: NOTIFICATION_TYPES.SHIFT_SIGNUP,
        title: `New shift signup: ${targetShift.title}`,
        message: `${req.user.firstName || 'A member'} ${req.user.lastName || ''}`.trim() + ' signed up for a shift.',
        link: `/camp/${targetEvent.campId}/events`,
        metadata: {
          eventId: targetEvent._id,
          shiftId: targetShift._id,
          memberId: req.user._id
        }
      });
    } catch (notificationError) {
      console.error('Shift signup notification error:', notificationError);
    }

    // Audit trail: record signup against BOTH the User and the Member so the
    // camp's 360 view surfaces it whether rendered via user-id (FMR) or
    // member-id (SOR pre-signup history) lookups. Failures are non-fatal.
    try {
      const activityDetails = {
        field: 'shift',
        campId: targetEvent.campId?._id || targetEvent.campId,
        eventId: targetEvent._id,
        eventName: targetEvent.eventName || targetEvent.name,
        shiftId: targetShift._id,
        shiftTitle: targetShift.title,
        shiftDate: targetShift.date,
        shiftStartTime: targetShift.startTime,
        shiftEndTime: targetShift.endTime,
        note: 'Member signed up for a shift'
      };
      await recordActivity('MEMBER', userId, userId, 'SHIFT_SIGNUP', activityDetails);
      if (userMember?._id) {
        await recordActivity('MEMBER', userMember._id, userId, 'SHIFT_SIGNUP', activityDetails);
      }
    } catch (auditErr) {
      console.error('⚠️ [SHIFT SIGNUP] Activity log failed (non-fatal):', auditErr?.message);
    }

    console.log('🎉 [SHIFT SIGNUP] Sign-up process completed successfully');

    res.json({
      message: 'Successfully signed up for shift',
      shiftId: targetShift._id,
      eventId: targetEvent._id,
      currentSignUps,
      maxSignUps: targetShift.maxSignUps,
      remainingSpots: Math.max(targetShift.maxSignUps - currentSignUps, 0)
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

    const shiftIds = (event.shifts || []).map((shift) => shift._id);
    const signups = shiftIds.length > 0
      ? await ShiftSignup.find({ shiftId: { $in: shiftIds } }).select('shiftId userId').lean()
      : [];
    const signupMap = new Map();
    for (const signup of signups) {
      const sid = signup.shiftId.toString();
      if (!signupMap.has(sid)) signupMap.set(sid, []);
      signupMap.get(sid).push(signup.userId.toString());
    }

    const assignedRows = await ShiftAssignment.find({ shiftId: { $in: shiftIds }, userId: req.user._id })
      .select('shiftId')
      .lean();
    const assignedShiftSet = new Set(assignedRows.map((row) => row.shiftId.toString()));

    const payload = typeof event.toObject === 'function' ? event.toObject() : event;
    payload.shifts = (payload.shifts || []).map((shift) => {
      const memberIds = [...new Set([
        ...(shift.memberIds || []).map((id) => id.toString()),
        ...(signupMap.get(shift._id.toString()) || [])
      ])];
      return {
        ...shift,
        memberIds,
        currentSignups: memberIds.length,
        isAssigned: assignedShiftSet.has(shift._id.toString())
      };
    });

    console.log('✅ [EVENT DETAIL] User is approved member, returning event data');
    res.json(payload);
  } catch (error) {
    console.error('❌ [EVENT DETAIL] Error fetching event:', error);
    res.status(500).json({ 
      message: 'Server error fetching event',
      error: error.message
    });
  }
});

module.exports = router;
