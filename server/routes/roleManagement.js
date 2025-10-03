const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/databaseAdapter');

const router = express.Router();

// Mock database for role management
const mockMembers = new Map();
const mockRoleChangeRequests = new Map();
const mockCamps = new Map();

// Initialize some mock data
const initializeMockData = () => {
  // Mock camp
  mockCamps.set('camp1', {
    id: 'camp1',
    name: 'Desert Dreams Camp',
    campLeadId: 'user1',
    createdAt: new Date(),
  });

  // Mock members
  mockMembers.set('member1', {
    id: 'member1',
    userId: 'user1',
    campId: 'camp1',
    role: 'Camp Lead',
    status: 'active',
    joinedAt: new Date('2024-01-01'),
    user: {
      id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@desertdreams.com',
    },
    contributions: {
      workShifts: 15,
      resources: 8,
      skills: ['Construction', 'Cooking', 'Leadership'],
    },
  });

  mockMembers.set('member2', {
    id: 'member2',
    userId: 'user2',
    campId: 'camp1',
    role: 'Project Lead',
    status: 'active',
    joinedAt: new Date('2024-01-15'),
    user: {
      id: 'user2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@desertdreams.com',
    },
    contributions: {
      workShifts: 12,
      resources: 5,
      skills: ['Art', 'Event Planning'],
    },
  });

  mockMembers.set('member3', {
    id: 'member3',
    userId: 'user3',
    campId: 'camp1',
    role: 'Camp Member',
    status: 'active',
    joinedAt: new Date('2024-02-01'),
    user: {
      id: 'user3',
      firstName: 'Mike',
      lastName: 'Johnson',
      email: 'mike@desertdreams.com',
    },
    contributions: {
      workShifts: 8,
      resources: 3,
      skills: ['Music', 'Photography'],
    },
  });
};

// Initialize mock data
initializeMockData();

// Helper function to check if user is camp lead
const isCampLead = (userId, campId) => {
  const member = Array.from(mockMembers.values()).find(
    m => m.userId === userId && m.campId === campId && m.role === 'Camp Lead'
  );
  return !!member;
};

// Helper function to get camp members
const getCampMembers = (campId) => {
  return Array.from(mockMembers.values()).filter(member => member.campId === campId);
};

// @route   GET /api/role-management/camp/:campId/members
// @desc    Get all members of a camp
// @access  Private (authenticated users)
router.get('/camp/:campId/members', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;

    // Get camp to verify it exists
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Check if user is member of this camp OR is an admin
    const userMember = await db.findMember({ 
      user: req.user._id, 
      camp: camp._id
    });

    // Check if user is admin with access to this camp
    const isAdmin = req.user.accountType === 'admin';
    
    // Allow access if user is a member OR if user is admin and the camp matches their campName
    const hasAccess = userMember || (isAdmin && req.user.campName === camp.campName);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Not authorized to view this camp roster' });
    }

    // Get only ACTIVE/APPROVED members of the camp (exclude rejected applications)
    const members = await db.findMembers({ 
      camp: camp._id,
      status: 'active'  // Only include approved members - excludes pending, rejected, suspended, inactive
    });

    // Remove duplicates based on member ID and user ID (keep latest by reviewedAt date)
    const uniqueMembers = members.filter((member, index, self) => {
      // First remove duplicates by member ID
      const isFirstOccurrenceById = index === self.findIndex(m => m._id === member._id);
      if (!isFirstOccurrenceById) return false;
      
      // Then remove duplicates by user ID (keep the most recently reviewed one)
      const duplicatesByUser = self.filter(m => m.user === member.user);
      if (duplicatesByUser.length === 1) return true;
      
      // Sort by reviewedAt date and keep only the most recent
      const mostRecent = duplicatesByUser.sort((a, b) => 
        new Date(b.reviewedAt || b.createdAt || 0) - new Date(a.reviewedAt || a.createdAt || 0)
      )[0];
      
      return member._id === mostRecent._id;
    });

    // Populate user data for each member
    const populatedMembers = await Promise.all(uniqueMembers.map(async (member) => {
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
          city: userData.city,
          location: userData.location,
          yearsBurned: userData.yearsBurned,
          hasTicket: userData.hasTicket,
          hasVehiclePass: userData.hasVehiclePass,
          interestedInEAP: userData.interestedInEAP,
          interestedInStrike: userData.interestedInStrike,
          arrivalDate: userData.arrivalDate,
          departureDate: userData.departureDate,
          skills: userData.skills
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

    res.json({ members: populatedMembers });

  } catch (error) {
    console.error('Get camp members error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/role-management/members/:memberId/role
// @desc    Update member role
// @access  Private (Camp Lead only)
router.put('/members/:memberId/role', [
  body('newRole').isIn(['Camp Lead', 'Project Lead', 'Camp Member']),
  body('reason').optional().trim(),
  body('campId').isLength({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { memberId } = req.params;
    const { newRole, reason, campId } = req.body;
    const userId = req.user?.id || 'user1'; // Mock user ID

    // Check if user is camp lead
    if (!isCampLead(userId, campId)) {
      return res.status(403).json({ 
        message: 'Only Camp Leads can change member roles' 
      });
    }

    // Get the member
    const member = mockMembers.get(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Check if member belongs to the camp
    if (member.campId !== campId) {
      return res.status(403).json({ 
        message: 'Member does not belong to this camp' 
      });
    }

    const oldRole = member.role;

    // Special validation for Camp Lead role
    if (newRole === 'Camp Lead') {
      // Check if there's already a Camp Lead
      const existingCampLead = getCampMembers(campId).find(m => m.role === 'Camp Lead' && m.id !== memberId);
      if (existingCampLead) {
        return res.status(400).json({ 
          message: 'There can only be one Camp Lead per camp. Please demote the current Camp Lead first.' 
        });
      }
    }

    // Update member role
    member.role = newRole;
    member.updatedAt = new Date();
    mockMembers.set(memberId, member);

    // Create role change request for audit trail
    const requestId = Date.now().toString();
    const roleChangeRequest = {
      id: requestId,
      memberId,
      oldRole,
      newRole,
      reason: reason || 'No reason provided',
      requestedBy: userId,
      requestedAt: new Date(),
      status: 'approved',
      campId,
    };
    mockRoleChangeRequests.set(requestId, roleChangeRequest);

    res.json({
      success: true,
      message: `Member role updated from ${oldRole} to ${newRole}`,
      member: {
        id: member.id,
        role: member.role,
        updatedAt: member.updatedAt,
      }
    });

  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ message: 'Server error during role update' });
  }
});

// @route   GET /api/role-management/camp/:campId/role-requests
// @desc    Get role change requests for a camp
// @access  Private (Camp Lead only)
router.get('/camp/:campId/role-requests', async (req, res) => {
  try {
    const { campId } = req.params;
    const userId = req.user?.id || 'user1'; // Mock user ID

    // Check if user is camp lead
    if (!isCampLead(userId, campId)) {
      return res.status(403).json({ 
        message: 'Only Camp Leads can view role change requests' 
      });
    }

    const requests = Array.from(mockRoleChangeRequests.values())
      .filter(request => request.campId === campId)
      .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    res.json({
      success: true,
      requests: requests.map(request => ({
        ...request,
        member: mockMembers.get(request.memberId)?.user
      }))
    });

  } catch (error) {
    console.error('Get role requests error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/role-management/members/:memberId/request-role-change
// @desc    Request a role change (for members to request promotion)
// @access  Private
router.post('/members/:memberId/request-role-change', [
  body('requestedRole').isIn(['Camp Lead', 'Project Lead', 'Camp Member']),
  body('reason').trim().isLength({ min: 10 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { memberId } = req.params;
    const { requestedRole, reason } = req.body;
    const userId = req.user?.id || 'user2'; // Mock user ID

    // Get the member
    const member = mockMembers.get(memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Check if user is the member or camp lead
    if (member.userId !== userId && !isCampLead(userId, member.campId)) {
      return res.status(403).json({ 
        message: 'You can only request role changes for yourself' 
      });
    }

    // Check if there's already a pending request
    const existingRequest = Array.from(mockRoleChangeRequests.values())
      .find(request => 
        request.memberId === memberId && 
        request.status === 'pending' &&
        request.requestedRole === requestedRole
      );

    if (existingRequest) {
      return res.status(400).json({ 
        message: 'You already have a pending request for this role' 
      });
    }

    // Create role change request
    const requestId = Date.now().toString();
    const roleChangeRequest = {
      id: requestId,
      memberId,
      oldRole: member.role,
      requestedRole,
      reason,
      requestedBy: userId,
      requestedAt: new Date(),
      status: 'pending',
      campId: member.campId,
    };
    mockRoleChangeRequests.set(requestId, roleChangeRequest);

    res.json({
      success: true,
      message: 'Role change request submitted successfully',
      request: roleChangeRequest
    });

  } catch (error) {
    console.error('Request role change error:', error);
    res.status(500).json({ message: 'Server error during role change request' });
  }
});

// @route   PUT /api/role-management/requests/:requestId/approve
// @desc    Approve a role change request
// @access  Private (Camp Lead only)
router.put('/requests/:requestId/approve', async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user?.id || 'user1'; // Mock user ID

    const request = mockRoleChangeRequests.get(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if user is camp lead
    if (!isCampLead(userId, request.campId)) {
      return res.status(403).json({ 
        message: 'Only Camp Leads can approve role change requests' 
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Request has already been processed' 
      });
    }

    // Get the member
    const member = mockMembers.get(request.memberId);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    // Special validation for Camp Lead role
    if (request.requestedRole === 'Camp Lead') {
      const existingCampLead = getCampMembers(request.campId)
        .find(m => m.role === 'Camp Lead' && m.id !== request.memberId);
      if (existingCampLead) {
        return res.status(400).json({ 
          message: 'There can only be one Camp Lead per camp' 
        });
      }
    }

    // Update member role
    member.role = request.requestedRole;
    member.updatedAt = new Date();
    mockMembers.set(request.memberId, member);

    // Update request status
    request.status = 'approved';
    request.approvedBy = userId;
    request.approvedAt = new Date();
    mockRoleChangeRequests.set(requestId, request);

    res.json({
      success: true,
      message: `Role change request approved. Member role updated to ${request.requestedRole}`,
      member: {
        id: member.id,
        role: member.role,
        updatedAt: member.updatedAt,
      }
    });

  } catch (error) {
    console.error('Approve role request error:', error);
    res.status(500).json({ message: 'Server error during request approval' });
  }
});

// @route   PUT /api/role-management/requests/:requestId/reject
// @desc    Reject a role change request
// @access  Private (Camp Lead only)
router.put('/requests/:requestId/reject', [
  body('rejectionReason').optional().trim(),
], async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejectionReason } = req.body;
    const userId = req.user?.id || 'user1'; // Mock user ID

    const request = mockRoleChangeRequests.get(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Check if user is camp lead
    if (!isCampLead(userId, request.campId)) {
      return res.status(403).json({ 
        message: 'Only Camp Leads can reject role change requests' 
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ 
        message: 'Request has already been processed' 
      });
    }

    // Update request status
    request.status = 'rejected';
    request.rejectedBy = userId;
    request.rejectedAt = new Date();
    request.rejectionReason = rejectionReason || 'No reason provided';
    mockRoleChangeRequests.set(requestId, request);

    res.json({
      success: true,
      message: 'Role change request rejected',
      request: {
        id: request.id,
        status: request.status,
        rejectionReason: request.rejectionReason,
      }
    });

  } catch (error) {
    console.error('Reject role request error:', error);
    res.status(500).json({ message: 'Server error during request rejection' });
  }
});

// @route   GET /api/role-management/roles/hierarchy
// @desc    Get role hierarchy and permissions
// @access  Public
router.get('/roles/hierarchy', (req, res) => {
  const roleHierarchy = {
    'Camp Lead': {
      level: 3,
      permissions: [
        'Manage camp settings',
        'Assign member roles',
        'Remove members',
        'Manage camp finances',
        'View all member information',
        'Create and manage projects',
        'Approve role change requests',
      ],
      description: 'Full administrative access to camp management',
    },
    'Project Lead': {
      level: 2,
      permissions: [
        'Manage assigned projects',
        'Assign tasks to camp members',
        'View member information',
        'Request role changes',
        'Manage project resources',
      ],
      description: 'Can manage specific projects and team members',
    },
    'Camp Member': {
      level: 1,
      permissions: [
        'View camp information',
        'Participate in camp activities',
        'Update own profile',
        'Request role changes',
        'View assigned tasks',
      ],
      description: 'Basic camp member with limited management access',
    },
  };

  res.json({
    success: true,
    hierarchy: roleHierarchy,
  });
});

module.exports = router;
