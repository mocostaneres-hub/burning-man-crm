const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/databaseAdapter');

const router = express.Router();

// @route   POST /api/rosters/reload-data
// @desc    Force reload mock database data (development only)
// @access  Private (Camp owners only)
router.post('/reload-data', authenticateToken, async (req, res) => {
  try {
    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campName)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    // Force reload the mock database data
    console.log('🔄 Attempting to reload mock database...');
    console.log('db.mockDB exists:', !!db.mockDB);
    console.log('db.mockDB.reloadData exists:', !!(db.mockDB && db.mockDB.reloadData));
    
    if (db.mockDB && db.mockDB.reloadData) {
      await db.mockDB.reloadData();
      res.json({ message: 'Mock database data reloaded successfully' });
    } else {
      res.status(400).json({ message: 'Mock database reload not available' });
    }
  } catch (error) {
    console.error('Reload data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/rosters/fix-duplicates
// @desc    Emergency fix for duplicate roster members (development only)
// @access  Private (Camp owners only)
router.post('/fix-duplicates', authenticateToken, async (req, res) => {
  try {
    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campName)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    console.log('🚨 EMERGENCY FIX: Correcting roster member IDs...');
    
    if (db.mockDB) {
      // Get the roster
      const rosters = await db.findAllRosters({ camp: 2000022 });
      if (rosters.length > 0) {
        const roster = rosters[0];
        
        // Fix the roster members with correct IDs
        const correctMembers = [
          { "member": 68, "addedAt": "2025-09-23T00:51:01.989Z", "addedBy": 1000005 },
          { "member": "68d08cdefea5a5dc098bd057", "addedAt": "2025-09-23T00:51:01.001Z", "addedBy": 1000005 },
          { "member": "68d08ce5fea5a5dc098bd058", "addedAt": "2025-09-23T00:51:00.001Z", "addedBy": 1000005 },
          { "member": "68d090df9656afa7651bbed7", "addedAt": "2025-09-23T00:50:59.001Z", "addedBy": 1000005 },
          { "member": "68d1e3233c2974835a70afd0", "addedAt": "2025-09-23T00:50:58.001Z", "addedBy": 1000005 },
          { "member": "68d1e32a3c2974835a70afd1", "addedAt": "2025-09-23T00:50:57.001Z", "addedBy": 1000005 },
          { "member": "68d1e79b09e48192914b467b", "addedAt": "2025-09-23T00:50:56.001Z", "addedBy": 1000005 },
          { "member": "68d1ebfdcfea78ca2a278dd3", "addedAt": "2025-09-23T00:50:55.001Z", "addedBy": 1000005 },
          { "member": "68d1ec046b28b9ab5a0828c7", "addedAt": "2025-09-23T00:50:54.001Z", "addedBy": 1000005 }
        ];
        
        // Update the roster in memory
        roster.members = correctMembers;
        roster.updatedAt = new Date().toISOString();
        
        // Save to file
        await db.mockDB.saveData();
        
        console.log('✅ Roster members fixed in memory and saved to file');
        res.json({ 
          message: 'Roster duplicates fixed successfully',
          memberCount: correctMembers.length,
          memberIds: correctMembers.map(m => m.member)
        });
      } else {
        res.status(404).json({ message: 'No roster found' });
      }
    } else {
      res.status(400).json({ message: 'Mock database not available' });
    }
  } catch (error) {
    console.error('Fix duplicates error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/rosters
// @desc    Get all rosters for the current camp
// @access  Private (Camp owners and members)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let camp;
    
    // Check if user is camp owner
    if (req.user.accountType === 'camp' || (req.user.accountType === 'admin' && req.user.campName)) {
      camp = await db.findCamp({ contactEmail: req.user.email });
    }
    
    // If not camp owner, check if user is a member of any camp
    if (!camp) {
      const member = await db.findMember({ user: req.user._id, status: 'active' });
      if (member) {
        camp = await db.findCamp({ _id: member.camp });
      }
    }
    
    if (!camp) {
      return res.status(404).json({ message: 'No camp found for user' });
    }

    const rosters = await db.findAllRosters({ camp: camp._id });
    
    // Populate member details for each roster
    const populatedRosters = [];
    for (const roster of rosters) {
      const populatedMembers = [];
      for (const memberEntry of roster.members) {
        const member = await db.findMember({ _id: memberEntry.member });
        if (member) {
          const user = await db.findUser({ _id: member.user });
          if (user) {
            populatedMembers.push({
              ...memberEntry,
              memberDetails: {
                ...member,
                userDetails: {
                  firstName: user.firstName,
                  lastName: user.lastName,
                  email: user.email,
                  profilePhoto: user.profilePhoto,
                  bio: user.bio,
                  playaName: user.playaName,
                  city: user.city,
                  yearsBurned: user.yearsBurned,
                  skills: user.skills,
                  socialMedia: user.socialMedia,
                  hasTicket: user.hasTicket,
                  hasVehiclePass: user.hasVehiclePass,
                  arrivalDate: user.arrivalDate,
                  departureDate: user.departureDate,
                  interestedInEAP: user.interestedInEAP
                }
              }
            });
          }
        }
      }
      
      populatedRosters.push({
        ...roster,
        members: populatedMembers
      });
    }
    
    res.json(populatedRosters);
  } catch (error) {
    console.error('Get rosters error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/rosters/active
// @desc    Get the active roster for the current camp
// @access  Private (Camp owners only)
router.get('/active', authenticateToken, async (req, res) => {
  try {
    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campName)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    const camp = await db.findCamp({ contactEmail: req.user.email });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    const roster = await db.findActiveRoster({ camp: camp._id });
    
    // Debug: Log the roster data before sending
    console.log('🔍 [GET /api/rosters/active] Roster data:', JSON.stringify(roster, null, 2));
    if (roster && roster.members && roster.members.length > 0) {
      console.log('🔍 [GET /api/rosters/active] First member data:', JSON.stringify(roster.members[0], null, 2));
      if (roster.members[0].user) {
        console.log('🔍 [GET /api/rosters/active] First member user data:', JSON.stringify(roster.members[0].user, null, 2));
        console.log('🔍 [GET /api/rosters/active] First member playaName:', roster.members[0].user.playaName);
      }
    }
    
    res.json(roster);
  } catch (error) {
    console.error('Get active roster error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/rosters
// @desc    Create a new roster
// @access  Private (Camp owners only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Roster name is required' });
    }

    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campName)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    const camp = await db.findCamp({ contactEmail: req.user.email });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Check if there's already an active roster
    const existingActiveRoster = await db.findActiveRoster({ camp: camp._id });
    
    // Create the roster
    const roster = await db.createRoster({
      camp: camp._id,
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
      camp: camp._id, 
      status: 'active' 
    });

    for (const member of approvedMembers) {
      await db.addMemberToRoster(roster._id, member._id, req.user._id);
    }

    res.status(201).json(roster);
  } catch (error) {
    console.error('Create roster error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Only one active roster is allowed per camp' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/rosters/:id
// @desc    Update a roster (rename)
// @access  Private (Camp owners only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Roster name is required' });
    }
    
    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campName)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    const camp = await db.findCamp({ contactEmail: req.user.email });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    const roster = await db.findRoster({ _id: parseInt(id), camp: camp._id });
    if (!roster) {
      return res.status(404).json({ message: 'Roster not found' });
    }

    const updatedRoster = await db.updateRoster(parseInt(id), { name: name.trim() });
    res.json(updatedRoster);
  } catch (error) {
    console.error('Update roster error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/rosters/:id/archive
// @desc    Archive a roster
// @access  Private (Camp owners only)
router.put('/:id/archive', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campName)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    const camp = await db.findCamp({ contactEmail: req.user.email });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    const roster = await db.findRoster({ _id: parseInt(id), camp: camp._id });
    if (!roster) {
      return res.status(404).json({ message: 'Roster not found' });
    }

    if (roster.isArchived) {
      return res.status(400).json({ message: 'Roster is already archived' });
    }

    const archivedRoster = await db.archiveRoster(parseInt(id), req.user._id);
    res.json(archivedRoster);
  } catch (error) {
    console.error('Archive roster error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/rosters/:id/export
// @desc    Export roster as CSV
// @access  Private (Camp owners only)
router.get('/:id/export', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campName)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    const camp = await db.findCamp({ contactEmail: req.user.email });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    const roster = await db.findRoster({ _id: parseInt(id), camp: camp._id });
    if (!roster) {
      return res.status(404).json({ message: 'Roster not found' });
    }

    // Populate member details
    const populatedMembers = [];
    for (const memberEntry of roster.members) {
      const member = await db.findMember({ _id: memberEntry.member });
      if (member) {
        const user = await db.findUser({ _id: member.user });
        if (user) {
          // Get application data to include duesStatus
          const application = await db.findMemberApplication({ 
            applicant: member.user, 
            camp: camp._id,
            status: 'approved'
          });
          
          populatedMembers.push({
            ...memberEntry,
            memberDetails: {
              ...member,
              userDetails: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                profilePhoto: user.profilePhoto,
                bio: user.bio,
                playaName: user.playaName,
                city: user.city,
                yearsBurned: user.yearsBurned,
                skills: user.skills,
                socialMedia: user.socialMedia,
                hasTicket: user.hasTicket,
                hasVehiclePass: user.hasVehiclePass,
                arrivalDate: user.arrivalDate,
                departureDate: user.departureDate,
                interestedInEAP: user.interestedInEAP,
                interestedInStrike: user.interestedInStrike,
                duesStatus: application?.duesStatus || 'Unpaid'
              }
            }
          });
        }
      }
    }

    // Generate CSV content
    const csvHeaders = [
      'Name',
      'City',
      'Years Burned',
      'Skills',
      'Has Ticket',
      'Has Vehicle Pass',
      'Arrival Date',
      'Departure Date',
      'Early Arrival Interest',
      'Bio',
      'Added to Roster'
    ];

    const csvRows = populatedMembers.map(memberEntry => {
      const user = memberEntry.memberDetails.userDetails;
      return [
        `"${user.firstName} ${user.lastName}"`,
        `"${user.city || 'N/A'}"`,
        user.yearsBurned || 0,
        `"${(user.skills || []).join(', ')}"`,
        user.hasTicket ? 'Yes' : 'No',
        user.hasVehiclePass ? 'Yes' : 'No',
        user.arrivalDate ? new Date(user.arrivalDate).toLocaleDateString() : 'N/A',
        user.departureDate ? new Date(user.departureDate).toLocaleDateString() : 'N/A',
        user.interestedInEAP ? 'Yes' : 'No',
        `"${(user.bio || '').replace(/"/g, '""')}"`,
        new Date(memberEntry.addedAt).toLocaleDateString()
      ];
    });

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');

    // Set response headers for CSV download
    const filename = `${roster.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_roster.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Export roster error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/rosters/members/:memberId
// @desc    Remove a member from active roster and mark as rejected
// @access  Private (Camp owners only)
router.delete('/members/:memberId', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    
    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campName)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    const camp = await db.findCamp({ contactEmail: req.user.email });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Find the active roster
    const activeRoster = await db.findActiveRoster({ camp: camp._id });
    if (!activeRoster) {
      return res.status(404).json({ message: 'No active roster found' });
    }

    // Remove member from roster
    const updatedRoster = await db.removeMemberFromRoster(activeRoster._id, memberId);
    
    // Find and update the member's application status to rejected
    const member = await db.findMember({ _id: memberId });
    if (member) {
      // Update the member record
      await db.updateMember(memberId, { 
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: req.user._id,
        reviewNotes: 'Removed from active roster'
      });
      
      // Also update the corresponding application record
      const application = await db.findMemberApplication({ 
        applicant: member.user, 
        camp: camp._id 
      });
      if (application) {
        await db.updateMemberApplication(application._id, {
          status: 'rejected',
          reviewedAt: new Date(),
          reviewedBy: req.user._id,
          reviewNotes: 'Removed from active roster'
        });
      }
    }

    res.json({ message: 'Member removed from roster and marked as rejected' });
  } catch (error) {
    console.error('Remove member from roster error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/rosters/:id
// @desc    Get a specific roster with members
// @access  Private (Camp owners only)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campName)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    const camp = await db.findCamp({ contactEmail: req.user.email });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    const roster = await db.findRoster({ _id: parseInt(id), camp: camp._id });
    if (!roster) {
      return res.status(404).json({ message: 'Roster not found' });
    }

    // Populate member details
    const populatedMembers = [];
    for (const memberEntry of roster.members) {
      const member = await db.findMember({ _id: memberEntry.member });
      if (member) {
        // Get user details for the member
        const user = await db.findUser({ _id: member.user });
        if (user) {
          populatedMembers.push({
            ...memberEntry,
            memberDetails: {
              ...member,
              userDetails: {
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                profilePhoto: user.profilePhoto,
                bio: user.bio,
                playaName: user.playaName,
                city: user.city,
                yearsBurned: user.yearsBurned,
                skills: user.skills,
                socialMedia: user.socialMedia,
                hasTicket: user.hasTicket,
                hasVehiclePass: user.hasVehiclePass,
                arrivalDate: user.arrivalDate,
                departureDate: user.departureDate,
                interestedInEAP: user.interestedInEAP,
                interestedInStrike: user.interestedInStrike,
                duesStatus: memberEntry.duesStatus || 'Unpaid'
              }
            }
          });
        }
      }
    }

    const rosterWithMembers = {
      ...roster,
      members: populatedMembers
    };

    res.json(rosterWithMembers);
  } catch (error) {
    console.error('Get roster error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/rosters/:rosterId/members/:memberId/dues
// @desc    Update dues status for a roster member
// @access  Private (Camp owners only)
router.put('/:rosterId/members/:memberId/dues', authenticateToken, async (req, res) => {
  try {
    const { rosterId, memberId } = req.params;
    const { duesStatus } = req.body;

    // Validate dues status
    if (!duesStatus || !['Paid', 'Unpaid'].includes(duesStatus)) {
      return res.status(400).json({ message: 'Invalid dues status' });
    }

    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campName)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    const camp = await db.findCamp({ contactEmail: req.user.email });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    const roster = await db.findRoster({ _id: parseInt(rosterId), camp: camp._id });
    if (!roster) {
      return res.status(404).json({ message: 'Roster not found' });
    }

    // Find the member in the roster
    const memberIndex = roster.members.findIndex(m => m.member.toString() === memberId.toString());
    if (memberIndex === -1) {
      return res.status(404).json({ message: 'Member not found in roster' });
    }

    // Update the dues status
    roster.members[memberIndex].duesStatus = duesStatus;
    roster.updatedAt = new Date().toISOString();

    // Save the updated roster
    const updatedRoster = await db.updateRoster(roster._id, roster);

    res.json({ 
      message: 'Dues status updated successfully',
      duesStatus: duesStatus,
      memberId: memberId
    });
  } catch (error) {
    console.error('Error updating dues status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/rosters/camp/:campId
// @desc    Get roster for a specific camp (camp owners and members)
// @access  Private (Camp owners and members only)
router.get('/camp/:campId', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;
    const numericCampId = parseInt(campId);
    
    // Check if camp exists
    const camp = await db.findCamp({ _id: numericCampId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Check if user is camp owner or member
    const isCampOwner = camp.contactEmail === req.user.email;
    const isCampMember = await db.findMember({ camp: numericCampId, user: req.user._id, status: 'active' });
    
    if (!isCampOwner && !isCampMember) {
      return res.status(403).json({ message: 'Access denied - must be camp owner or member' });
    }

    const roster = await db.findActiveRoster({ camp: numericCampId });
    
    if (!roster) {
      return res.json({ members: [] });
    }

    // Populate member details
    const membersWithDetails = await Promise.all(roster.members.map(async (member) => {
      // First find the member record
      const memberRecord = await db.findMember({ _id: member.member });
      if (!memberRecord) {
        return {
          ...member,
          user: null
        };
      }
      
      // Then find the user record
      const user = await db.findUser({ _id: memberRecord.user });
      return {
        ...member,
        user: user ? {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          profilePhoto: user.profilePhoto,
          bio: user.bio,
          playaName: user.playaName,
          city: user.city,
          yearsBurned: user.yearsBurned,
          skills: user.skills
        } : null
      };
    }));

    res.json({
      ...roster,
      members: membersWithDetails
    });
  } catch (error) {
    console.error('Get camp roster error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PATCH /api/roster/member/:memberId/dues
// @desc    Update member's dues status
// @access  Private (Camp admins/leads only)
router.patch('/member/:memberId/dues', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 [DUES UPDATE] Starting dues status update');
    console.log('📝 [DUES UPDATE] Request params:', { memberId: req.params.memberId });
    console.log('📝 [DUES UPDATE] Request body:', req.body);
    console.log('📝 [DUES UPDATE] Request headers:', req.headers);
    console.log('📝 [DUES UPDATE] User context:', { 
      accountType: req.user?.accountType, 
      email: req.user?.email, 
      campName: req.user?.campName 
    });

    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      console.log('❌ [DUES UPDATE] Request body is missing or invalid');
      return res.status(400).json({ message: 'Request body is required' });
    }
    
    // Check if user is camp admin/lead
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campName)) {
      console.log('❌ [DUES UPDATE] Permission denied - user not camp admin/lead');
      return res.status(403).json({ message: 'Camp admin/lead access required' });
    }

    const { memberId } = req.params;
    const { isPaid } = req.body;

    console.log('📝 [DUES UPDATE] Extracted values:', { memberId, isPaid, typeofIsPaid: typeof isPaid });

    // Validate input
    if (typeof isPaid !== 'boolean') {
      console.log('❌ [DUES UPDATE] Invalid input - isPaid must be boolean, received:', isPaid, typeof isPaid);
      return res.status(400).json({ message: 'isPaid must be a boolean value' });
    }

    // Get camp ID from user context
    let campId;
    console.log('🔍 [DUES UPDATE] Looking up camp...');
    
    try {
      if (req.user.accountType === 'camp') {
        console.log('📝 [DUES UPDATE] Camp account - looking up by contactEmail:', req.user.email);
        const camp = await db.findCamp({ contactEmail: req.user.email });
        console.log('📝 [DUES UPDATE] Camp lookup result:', camp ? { _id: camp._id, campName: camp.campName } : 'null');
        campId = camp ? camp._id : null;
      } else if (req.user.accountType === 'admin' && req.user.campName) {
        console.log('📝 [DUES UPDATE] Admin account - looking up by campName:', req.user.campName);
        const camp = await db.findCamp({ campName: req.user.campName });
        console.log('📝 [DUES UPDATE] Camp lookup result:', camp ? { _id: camp._id, campName: camp.campName } : 'null');
        campId = camp ? camp._id : null;
      }
    } catch (campLookupError) {
      console.error('❌ [DUES UPDATE] Error during camp lookup:', campLookupError);
      return res.status(500).json({ message: 'Error looking up camp', error: campLookupError.message });
    }

    if (!campId) {
      console.log('❌ [DUES UPDATE] Camp not found');
      return res.status(404).json({ message: 'Camp not found' });
    }

    console.log('🏕️ [DUES UPDATE] Camp ID resolved:', campId);

    // Find the member in the active roster
    console.log('🔍 [DUES UPDATE] Looking for active roster...');
    let activeRoster;
    
    try {
      activeRoster = await db.findActiveRoster({ camp: campId });
      console.log('📝 [DUES UPDATE] Active roster result:', activeRoster ? { 
        _id: activeRoster._id, 
        membersCount: activeRoster.members?.length || 0,
        isActive: activeRoster.isActive,
        isArchived: activeRoster.isArchived
      } : 'null');
    } catch (rosterLookupError) {
      console.error('❌ [DUES UPDATE] Error during roster lookup:', rosterLookupError);
      return res.status(500).json({ message: 'Error looking up roster', error: rosterLookupError.message });
    }
    
    if (!activeRoster || !activeRoster.members) {
      console.log('❌ [DUES UPDATE] No active roster found');
      return res.status(404).json({ message: 'No active roster found for this camp' });
    }

    // Debug: Log all member IDs in the roster
    console.log('📝 [DUES UPDATE] Members in roster:', activeRoster.members.map(m => ({
      member: m.member,
      memberType: typeof m.member,
      status: m.status,
      duesPaid: m.duesPaid
    })));
    console.log('📝 [DUES UPDATE] Looking for memberId:', memberId, 'type:', typeof memberId);

    // Find the specific member entry in the roster
    let targetMemberEntry = null;
    for (const memberEntry of activeRoster.members) {
      console.log('📝 [DUES UPDATE] Comparing:', memberEntry.member, 'vs', memberId, 
        '| toString comparison:', memberEntry.member?.toString() === memberId);
      if (memberEntry.member && memberEntry.member.toString() === memberId) {
        targetMemberEntry = memberEntry;
        break;
      }
    }

    if (!targetMemberEntry) {
      console.log('❌ [DUES UPDATE] Member not found in roster');
      console.log('📝 [DUES UPDATE] Available member IDs:', activeRoster.members.map(m => m.member?.toString()));
      return res.status(404).json({ message: 'Member not found in active roster' });
    }

    console.log('✅ [DUES UPDATE] Member found in roster:', {
      memberId: targetMemberEntry.member,
      status: targetMemberEntry.status,
      currentDuesPaid: targetMemberEntry.duesPaid
    });

    // Update the dues status with explicit database mapping
    console.log('💾 [DUES UPDATE] Current member entry:', targetMemberEntry);
    console.log('💾 [DUES UPDATE] Updating dues status from', targetMemberEntry.duesStatus, 'to', isPaid ? 'Paid' : 'Unpaid');
    const originalDuesStatus = targetMemberEntry.duesStatus;
    
    // Create explicit update payload to match database schema (duesStatus as string)
    const updatePayload = { duesStatus: isPaid ? 'Paid' : 'Unpaid' };
    console.log('📝 [DUES UPDATE] Update payload:', updatePayload);
    
    // Find the index of the member entry in the roster for targeted update
    const memberIndex = activeRoster.members.findIndex(memberEntry => 
      memberEntry.member && memberEntry.member.toString() === memberId
    );
    
    if (memberIndex === -1) {
      console.log('❌ [DUES UPDATE] Member index not found in roster');
      return res.status(404).json({ message: 'Member index not found in roster' });
    }
    
    console.log('📝 [DUES UPDATE] Found member at index:', memberIndex);
    
    // Update only the specific member entry
    activeRoster.members[memberIndex] = {
      ...activeRoster.members[memberIndex],
      ...updatePayload
    };
    
    console.log('📝 [DUES UPDATE] Updated member entry:', activeRoster.members[memberIndex]);

    // Save the updated roster
    console.log('💾 [DUES UPDATE] Saving updated roster...');
    let updatedRoster;
    
    try {
      updatedRoster = await db.updateRoster(activeRoster._id, activeRoster);
      console.log('✅ [DUES UPDATE] Roster update completed');
    } catch (updateError) {
      console.error('❌ [DUES UPDATE] Error during roster update:', updateError);
      console.error('❌ [DUES UPDATE] Update error stack:', updateError.stack);
      return res.status(500).json({ message: 'Error updating roster', error: updateError.message });
    }

    console.log('🎉 [DUES UPDATE] Dues status updated successfully');
    console.log('📝 [DUES UPDATE] Final verification - Member dues status:', activeRoster.members[memberIndex].duesStatus);

    res.json({
      message: 'Dues status updated successfully',
      memberId,
      duesPaid: isPaid, // Keep this for frontend compatibility
      duesStatus: isPaid ? 'Paid' : 'Unpaid', // Add the actual database value
      previousValue: originalDuesStatus
    });
  } catch (error) {
    console.error('❌ [DUES UPDATE] Critical error during dues update:', error);
    console.error('❌ [DUES UPDATE] Error stack trace:', error.stack);
    console.error('❌ [DUES UPDATE] Error name:', error.name);
    console.error('❌ [DUES UPDATE] Error message:', error.message);
    res.status(500).json({ 
      message: 'Server error during dues update',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
