const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');

const router = express.Router();

// Mock database for meetings
const mockMeetings = new Map();
const mockUsers = new Map(); // This would be your actual user database

// Zoom API configuration (you'll need to get these from Zoom Developer Console)
const ZOOM_API_KEY = process.env.ZOOM_API_KEY || 'your_zoom_api_key';
const ZOOM_API_SECRET = process.env.ZOOM_API_SECRET || 'your_zoom_api_secret';
const ZOOM_SDK_KEY = process.env.ZOOM_SDK_KEY || 'your_zoom_sdk_key';
const ZOOM_SDK_SECRET = process.env.ZOOM_SDK_SECRET || 'your_zoom_sdk_secret';

// Generate JWT signature for Zoom SDK
const generateZoomSignature = (meetingNumber, role) => {
  const timestamp = new Date().getTime() - 30000;
  const msg = Buffer.from(ZOOM_SDK_KEY + meetingNumber + timestamp + role).toString('base64');
  const hash = crypto.createHmac('sha256', ZOOM_SDK_SECRET).update(msg).digest('base64');
  const signature = Buffer.from(`${ZOOM_SDK_KEY}.${meetingNumber}.${timestamp}.${role}.${hash}`).toString('base64');
  
  return signature;
};

// @route   POST /api/meetings/create
// @desc    Create a new Zoom meeting (Camp accounts only)
// @access  Private (Camp accounts only)
router.post('/create', [
  body('topic').trim().isLength({ min: 1 }),
  body('type').isInt({ min: 1, max: 3 }),
  body('duration').isInt({ min: 15, max: 480 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user has camp account (in real app, this would check the authenticated user)
    const userAccountType = req.body.userAccountType || req.user?.accountType;
    if (userAccountType !== 'camp') {
      return res.status(403).json({ 
        message: 'Only camp accounts can create meetings. Personal accounts can only join meetings.' 
      });
    }

    const { topic, type, duration, settings } = req.body;

    // In a real implementation, this would call Zoom API
    // For demo purposes, we'll create a mock meeting
    const meetingId = Date.now().toString();
    const meetingNumber = Math.floor(Math.random() * 9000000000) + 1000000000; // 10-digit number
    const password = Math.floor(Math.random() * 9000) + 1000; // 4-digit password

    const meeting = {
      id: meetingId,
      meetingNumber: meetingNumber.toString(),
      password: password.toString(),
      topic,
      type,
      duration,
      settings: settings || {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        mute_upon_entry: false,
        waiting_room: false,
      },
      createdAt: new Date(),
      status: 'scheduled',
      hostId: req.user?.id || 'demo_user',
    };

    // Store meeting in mock database
    mockMeetings.set(meetingId, meeting);

    res.status(201).json({
      message: 'Meeting created successfully',
      meeting: {
        id: meeting.id,
        meetingNumber: meeting.meetingNumber,
        password: meeting.password,
        topic: meeting.topic,
        joinUrl: `https://zoom.us/j/${meeting.meetingNumber}`,
        createdAt: meeting.createdAt,
      },
    });

  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ message: 'Server error during meeting creation' });
  }
});

// @route   POST /api/meetings/signature
// @desc    Generate JWT signature for Zoom SDK
// @access  Private
router.post('/signature', [
  body('meetingNumber').isLength({ min: 1 }),
  body('role').isInt({ min: 0, max: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { meetingNumber, role } = req.body;

    // Generate signature for Zoom SDK
    const signature = generateZoomSignature(meetingNumber, role);

    res.json({
      signature,
      meetingNumber,
      role,
    });

  } catch (error) {
    console.error('Signature generation error:', error);
    res.status(500).json({ message: 'Server error during signature generation' });
  }
});

// @route   GET /api/meetings
// @desc    Get all meetings for a user/camp
// @access  Private
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id || 'demo_user';
    const campId = req.query.campId;

    // Filter meetings by user or camp
    const meetings = Array.from(mockMeetings.values()).filter(meeting => {
      if (campId) {
        return meeting.campId === campId;
      }
      return meeting.hostId === userId;
    });

    res.json({
      meetings: meetings.map(meeting => ({
        id: meeting.id,
        meetingNumber: meeting.meetingNumber,
        topic: meeting.topic,
        status: meeting.status,
        createdAt: meeting.createdAt,
        joinUrl: `https://zoom.us/j/${meeting.meetingNumber}`,
      })),
    });

  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/meetings/:id
// @desc    Get specific meeting details
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const meetingId = req.params.id;
    const meeting = mockMeetings.get(meetingId);

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    res.json({
      meeting: {
        id: meeting.id,
        meetingNumber: meeting.meetingNumber,
        password: meeting.password,
        topic: meeting.topic,
        type: meeting.type,
        duration: meeting.duration,
        settings: meeting.settings,
        status: meeting.status,
        createdAt: meeting.createdAt,
        joinUrl: `https://zoom.us/j/${meeting.meetingNumber}`,
      },
    });

  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/meetings/:id
// @desc    Update meeting details
// @access  Private
router.put('/:id', [
  body('topic').optional().trim().isLength({ min: 1 }),
  body('duration').optional().isInt({ min: 15, max: 480 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const meetingId = req.params.id;
    const meeting = mockMeetings.get(meetingId);

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Check if user is the host
    if (meeting.hostId !== req.user?.id) {
      return res.status(403).json({ message: 'Not authorized to update this meeting' });
    }

    // Update meeting
    const updatedMeeting = {
      ...meeting,
      ...req.body,
      updatedAt: new Date(),
    };

    mockMeetings.set(meetingId, updatedMeeting);

    res.json({
      message: 'Meeting updated successfully',
      meeting: {
        id: updatedMeeting.id,
        meetingNumber: updatedMeeting.meetingNumber,
        topic: updatedMeeting.topic,
        duration: updatedMeeting.duration,
        status: updatedMeeting.status,
        updatedAt: updatedMeeting.updatedAt,
      },
    });

  } catch (error) {
    console.error('Update meeting error:', error);
    res.status(500).json({ message: 'Server error during meeting update' });
  }
});

// @route   DELETE /api/meetings/:id
// @desc    Delete a meeting
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const meetingId = req.params.id;
    const meeting = mockMeetings.get(meetingId);

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Check if user is the host
    if (meeting.hostId !== req.user?.id) {
      return res.status(403).json({ message: 'Not authorized to delete this meeting' });
    }

    mockMeetings.delete(meetingId);

    res.json({ message: 'Meeting deleted successfully' });

  } catch (error) {
    console.error('Delete meeting error:', error);
    res.status(500).json({ message: 'Server error during meeting deletion' });
  }
});

// @route   POST /api/meetings/:id/join
// @desc    Join a meeting (generate signature)
// @access  Private
router.post('/:id/join', async (req, res) => {
  try {
    const meetingId = req.params.id;
    const meeting = mockMeetings.get(meetingId);

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const role = req.body.role || 0; // 0 = attendee, 1 = host
    const signature = generateZoomSignature(meeting.meetingNumber, role);

    res.json({
      meetingNumber: meeting.meetingNumber,
      password: meeting.password,
      signature,
      role,
      joinUrl: `https://zoom.us/j/${meeting.meetingNumber}`,
    });

  } catch (error) {
    console.error('Join meeting error:', error);
    res.status(500).json({ message: 'Server error during meeting join' });
  }
});

module.exports = router;
