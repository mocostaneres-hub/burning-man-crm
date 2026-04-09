const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/databaseAdapter');
const { canManageCamp } = require('../utils/permissionHelpers');

async function ensureCampManagementAccess(req, res, campId) {
  const hasAccess = await canManageCamp(req, campId);
  if (!hasAccess) {
    res.status(403).json({ message: 'Camp admin/lead access required' });
    return false;
  }
  return true;
}

// @route   GET /api/call-slots/available/:campId
// @desc    Get available call slots for a camp (for logged-in applicants)
// @access  Private (Logged-in users only)
router.get('/available/:campId', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;
    
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Only return available call slots for applicants
    const callSlots = await db.findCallSlots({ campId, isAvailable: true });
    res.json(callSlots);
  } catch (error) {
    console.error('Error fetching available call slots:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/call-slots/camp/:campId
// @desc    Get all call slots for a camp
// @access  Private (Camp owners only)
router.get('/camp/:campId', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;

    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    if (!(await ensureCampManagementAccess(req, res, campId))) {
      return;
    }

    const callSlots = await db.findCallSlots({ campId });
    res.json(callSlots);
  } catch (error) {
    console.error('Error fetching call slots:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/call-slots
// @desc    Create a new call slot
// @access  Private (Camp owners only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { campId, startTime, endTime, date, maxParticipants = 1 } = req.body;

    // Validate required fields
    if (!campId || !startTime || !endTime || !date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    if (!(await ensureCampManagementAccess(req, res, campId))) {
      return;
    }

    const callSlotData = {
      campId,
      startTime,
      endTime,
      date: new Date(date),
      maxParticipants,
      currentParticipants: 0,
      isAvailable: true
    };

    const callSlot = await db.createCallSlot(callSlotData);
    res.status(201).json(callSlot);
  } catch (error) {
    console.error('Error creating call slot:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/call-slots/:id
// @desc    Update a call slot
// @access  Private (Camp owners only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const callSlot = await db.findCallSlot({ _id: id });
    if (!callSlot) {
      return res.status(404).json({ message: 'Call slot not found' });
    }

    const camp = await db.findCamp({ _id: callSlot.campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    if (!(await ensureCampManagementAccess(req, res, callSlot.campId))) {
      return;
    }

    const updatedCallSlot = await db.updateCallSlot(id, updates);
    res.json(updatedCallSlot);
  } catch (error) {
    console.error('Error updating call slot:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/call-slots/:id
// @desc    Delete a call slot
// @access  Private (Camp owners only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const callSlot = await db.findCallSlot({ _id: id });
    if (!callSlot) {
      return res.status(404).json({ message: 'Call slot not found' });
    }

    const camp = await db.findCamp({ _id: callSlot.campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    if (!(await ensureCampManagementAccess(req, res, callSlot.campId))) {
      return;
    }

    await db.deleteCallSlot(id);
    res.json({ message: 'Call slot deleted successfully' });
  } catch (error) {
    console.error('Error deleting call slot:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/call-slots/available/:campId
// @desc    Get available call slots for applicants
// @access  Public
router.get('/available/:campId', async (req, res) => {
  try {
    const { campId } = req.params;
    
    const availableSlots = await db.findCallSlots({ 
      campId, 
      isAvailable: true,
      date: { $gte: new Date() } // Only future dates
    });
    
    res.json(availableSlots);
  } catch (error) {
    console.error('Error fetching available call slots:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/call-slots/:id/details
// @desc    Get call slot details with applicants
// @access  Private (Camp owners only)
router.get('/:id/details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const callSlot = await db.findCallSlot({ _id: id });
    if (!callSlot) {
      return res.status(404).json({ message: 'Call slot not found' });
    }

    const camp = await db.findCamp({ _id: callSlot.campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    if (!(await ensureCampManagementAccess(req, res, callSlot.campId))) {
      return;
    }

    // Find all applications that selected this call slot
    const applications = await db.findMemberApplications({ 
      camp: callSlot.campId,
      'applicationData.selectedCallSlotId': id 
    });

    // Get applicant details for each application
    const applicantsWithDetails = await Promise.all(
      applications.map(async (app) => {
        const applicant = await db.findUser({ _id: app.applicant });
        return {
          _id: applicant._id,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
          email: applicant.email,
          applicationId: app._id,
          applicationStatus: app.status,
          appliedAt: app.appliedAt
        };
      })
    );

    res.json({
      callSlot,
      applicants: applicantsWithDetails
    });
  } catch (error) {
    console.error('Error fetching call slot details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
