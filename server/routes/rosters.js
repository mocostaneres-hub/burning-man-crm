const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/databaseAdapter');
const { getUserCampId, canAccessCamp, canManageCamp } = require('../utils/permissionHelpers');
const { recordActivity } = require('../services/activityLogger');
const { renderTemplate } = require('../utils/renderTemplate');
const { getCampTemplate, SYSTEM_DEFAULT_TEMPLATES } = require('../utils/duesTemplates');
const { sendDuesEmail } = require('../services/emailService');
const {
  DUES_STATUS,
  normalizeDuesStatus,
  isAllowedTransition,
  getEmailTrigger
} = require('../utils/duesStateMachine');

const router = express.Router();

function getMemberEntryIndex(roster, memberId) {
  return roster.members.findIndex((entry) => {
    if (!entry.member) return false;
    if (typeof entry.member === 'object' && entry.member._id) {
      return entry.member._id.toString() === memberId.toString();
    }
    return entry.member.toString() === memberId.toString();
  });
}

function resolveDuesVariables({ memberUser, camp, campDues, paymentDate }) {
  return {
    member_name: `${memberUser?.firstName || ''} ${memberUser?.lastName || ''}`.trim() || 'Member',
    camp_name: camp?.name || camp?.campName || 'Your Camp',
    dues_amount: campDues?.amount ? `${campDues.currency || 'USD'} ${campDues.amount}` : 'TBD',
    due_date: campDues?.dueDate ? new Date(campDues.dueDate).toLocaleDateString('en-US') : 'TBD',
    payment_link: campDues?.paymentLink || camp?.website || process.env.CLIENT_URL || 'https://www.g8road.com',
    payment_date: paymentDate ? new Date(paymentDate).toLocaleDateString('en-US') : new Date().toLocaleDateString('en-US')
  };
}

async function buildDuesEmailPreview({ camp, memberUser, type, paymentDate, overrideSubject, overrideBody }) {
  const template = getCampTemplate(camp, type);
  const variables = resolveDuesVariables({
    memberUser,
    camp,
    campDues: camp?.requirements?.dues,
    paymentDate
  });

  const rawSubject = overrideSubject || template.subject;
  const rawBody = overrideBody || template.body;

  return {
    type,
    variables,
    subject: renderTemplate(rawSubject, variables),
    body: renderTemplate(rawBody, variables)
  };
}

// @route   GET /api/rosters/:rosterId/dues/templates
// @desc    Get camp-level dues template defaults for roster's camp
// @access  Private (Camp admins/leads)
router.get('/:rosterId/dues/templates', authenticateToken, async (req, res) => {
  try {
    const { rosterId } = req.params;

    const roster = await db.findRoster({ _id: rosterId }) || await db.findRoster({ _id: parseInt(rosterId) });
    if (!roster) return res.status(404).json({ message: 'Roster not found' });

    const camp = await db.findCamp({ _id: roster.camp });
    if (!camp) return res.status(404).json({ message: 'Camp not found' });

    const hasPermission = await canManageCamp(req, camp._id);
    if (!hasPermission) return res.status(403).json({ message: 'Camp admin or Camp Lead access required' });

    res.json({
      templates: {
        instructions: {
          subject: camp.duesInstructionsSubject || '',
          body: camp.duesInstructionsBody || '',
          effectiveSubject: camp.duesInstructionsSubject || SYSTEM_DEFAULT_TEMPLATES.instructions.subject,
          effectiveBody: camp.duesInstructionsBody || SYSTEM_DEFAULT_TEMPLATES.instructions.body
        },
        receipt: {
          subject: camp.duesReceiptSubject || '',
          body: camp.duesReceiptBody || '',
          effectiveSubject: camp.duesReceiptSubject || SYSTEM_DEFAULT_TEMPLATES.receipt.subject,
          effectiveBody: camp.duesReceiptBody || SYSTEM_DEFAULT_TEMPLATES.receipt.body
        }
      }
    });
  } catch (error) {
    console.error('Get dues templates error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/rosters/:rosterId/dues/templates
// @desc    Update camp-level dues template defaults for roster's camp
// @access  Private (Camp admins/leads)
router.put('/:rosterId/dues/templates', authenticateToken, async (req, res) => {
  try {
    const { rosterId } = req.params;
    const { instructions, receipt } = req.body || {};

    const roster = await db.findRoster({ _id: rosterId }) || await db.findRoster({ _id: parseInt(rosterId) });
    if (!roster) return res.status(404).json({ message: 'Roster not found' });

    const camp = await db.findCamp({ _id: roster.camp });
    if (!camp) return res.status(404).json({ message: 'Camp not found' });

    const hasPermission = await canManageCamp(req, camp._id);
    if (!hasPermission) return res.status(403).json({ message: 'Camp admin or Camp Lead access required' });

    const normalizeField = (value) => {
      if (value === null || value === undefined) return null;
      const trimmed = String(value).trim();
      return trimmed === '' ? null : trimmed;
    };

    const updateData = {
      duesInstructionsSubject: normalizeField(instructions?.subject),
      duesInstructionsBody: normalizeField(instructions?.body),
      duesReceiptSubject: normalizeField(receipt?.subject),
      duesReceiptBody: normalizeField(receipt?.body)
    };

    await db.updateCamp({ _id: camp._id }, updateData);

    await recordActivity('CAMP', camp._id, req.user._id, 'PROFILE_UPDATE', {
      field: 'duesTemplates',
      rosterId: roster._id
    });

    res.json({ message: 'Dues templates updated successfully' });
  } catch (error) {
    console.error('Update dues templates error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/rosters/reload-data
// @desc    Force reload mock database data (development only)
// @access  Private (Camp owners only)
router.post('/reload-data', authenticateToken, async (req, res) => {
  try {
    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
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
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
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
    
    // Check if user is camp owner using helper
    if (req.user.accountType === 'camp' || (req.user.accountType === 'admin' && req.user.campId)) {
      const campId = await getUserCampId(req);
      if (campId) {
        camp = await db.findCamp({ _id: campId });
      }
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
// @access  Private (Camp owners, admins, and Camp Leads)
router.get('/active', authenticateToken, async (req, res) => {
  try {
    let campId;
    
    // For Camp Leads: get campId from query parameter (passed by frontend)
    if (req.query.campId) {
      campId = req.query.campId;
      
      // Verify Camp Lead has access to this camp (use canManageCamp which includes Camp Leads!)
      const { canManageCamp } = require('../utils/permissionHelpers');
      const hasAccess = await canManageCamp(req, campId);
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied to this camp' });
      }
    }
    // For camp owners and admins: get from user context
    else if (req.user.accountType === 'camp' || (req.user.accountType === 'admin' && req.user.campId)) {
      // Get camp using campId if available, otherwise fall back to contactEmail
      let camp;
      if (req.user.campId) {
        camp = await db.findCamp({ _id: req.user.campId });
      } else {
        camp = await db.findCamp({ contactEmail: req.user.email });
      }
      
      if (!camp) {
        return res.status(404).json({ message: 'Camp not found' });
      }
      
      campId = camp._id;
    } else {
      return res.status(403).json({ message: 'Camp account, admin, or Camp Lead required' });
    }

    const roster = await db.findActiveRoster({ camp: campId });
    
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
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    // Get camp using helper (immutable campId)
    const campId = await getUserCampId(req);
    if (!campId) {
      return res.status(404).json({ message: 'Camp not found' });
    }
    const camp = await db.findCamp({ _id: campId });
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

    // Log roster creation for CAMP
    await recordActivity('CAMP', camp._id, req.user._id, 'ENTITY_CREATED', {
      field: 'roster',
      rosterId: roster._id,
      rosterName: name,
      description: description || ''
    });

    // If there was an existing active roster, archive it
    if (existingActiveRoster) {
      await db.archiveRoster(existingActiveRoster._id, req.user._id);
      
      // Log roster archiving for CAMP
      await recordActivity('CAMP', camp._id, req.user._id, 'DATA_ACTION', {
        field: 'roster',
        action: 'archived',
        rosterId: existingActiveRoster._id,
        rosterName: existingActiveRoster.name,
        reason: 'Replaced by new active roster'
      });
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
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    // Get camp using helper (immutable campId)
    const campId = await getUserCampId(req);
    if (!campId) {
      return res.status(404).json({ message: 'Camp not found' });
    }
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Find roster - try as ObjectId first, then as integer (for legacy numeric IDs)
    let roster;
    roster = await db.findRoster({ _id: id, camp: camp._id });
    
    if (!roster) {
      // Fallback: try parsing as integer for legacy numeric IDs
      roster = await db.findRoster({ _id: parseInt(id), camp: camp._id });
    }
    
    if (!roster) {
      return res.status(404).json({ message: 'Roster not found' });
    }

    // Use the roster's actual ID for the update (could be ObjectId string or integer)
    const rosterId = roster._id;
    const updatedRoster = await db.updateRoster(rosterId, { name: name.trim() });
    res.json(updatedRoster);
  } catch (error) {
    console.error('Update roster error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/rosters/:id/archive
// @desc    Archive a roster
// @access  Private (Camp owners only)
router.put('/:id/archive', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    // Get camp using helper (immutable campId)
    const campId = await getUserCampId(req);
    if (!campId) {
      return res.status(404).json({ message: 'Camp not found' });
    }
    const camp = await db.findCamp({ _id: campId });
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
    
    // Log roster archiving for CAMP
    await recordActivity('CAMP', camp._id, req.user._id, 'DATA_ACTION', {
      field: 'roster',
      action: 'archived',
      rosterId: roster._id,
      rosterName: roster.name
    });
    
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
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    // Get camp using helper (immutable campId)
    const campId = await getUserCampId(req);
    if (!campId) {
      return res.status(404).json({ message: 'Camp not found' });
    }
    const camp = await db.findCamp({ _id: campId });
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
          
          // Get dues status from roster member entry first (most accurate), 
          // then member record, then application, then default to Unpaid
          const duesStatus = normalizeDuesStatus(memberEntry.duesStatus || member.duesStatus || application?.duesStatus || DUES_STATUS.UNPAID);
          
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
                duesStatus: duesStatus
              }
            }
          });
        }
      }
    }

    // Helper function to format dates like the frontend (DAYOFWEEK, MM/DD)
    const formatDateForCSV = (dateString) => {
      if (!dateString || dateString === '' || dateString === 'undefined' || dateString === 'null') {
        return 'Not specified';
      }
      
      try {
        let date;
        
        if (dateString instanceof Date) {
          date = dateString;
        } else if (typeof dateString === 'string') {
          // Handle different date formats
          if (dateString.includes('T')) {
            // Already has time component
            date = new Date(dateString);
          } else {
            // Add timezone offset to handle date parsing correctly
            date = new Date(dateString + 'T12:00:00');
          }
        } else {
          return 'Not specified';
        }
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
          return 'Not specified';
        }
        
        return date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: '2-digit',
          day: '2-digit'
        }).replace(/(\w+),\s*(\d+)\/(\d+)/, '$1, $2/$3');
      } catch (error) {
        return 'Not specified';
      }
    };

    // Helper function to format travel plans (arrival and departure in one cell)
    const formatTravelPlans = (arrivalDate, departureDate) => {
      const arrival = formatDateForCSV(arrivalDate);
      const departure = formatDateForCSV(departureDate);
      
      if (arrival === 'Not specified' && departure === 'Not specified') {
        return 'Not specified';
      } else if (arrival === 'Not specified') {
        return `To: ${departure}`;
      } else if (departure === 'Not specified') {
        return `From: ${arrival}`;
      } else {
        return `${arrival} - ${departure}`;
      }
    };

    // Helper function to format ticket/VP status
    const formatTicketVPStatus = (value) => {
      if (value === null || value === undefined) return 'Not informed';
      return value ? 'Yes' : 'No';
    };

    // Helper function to format social media links
    const formatSocialMedia = (socialMedia) => {
      if (!socialMedia) return 'N/A';
      const links = [];
      if (socialMedia.instagram) links.push(`Instagram: ${socialMedia.instagram}`);
      if (socialMedia.facebook) links.push(`Facebook: ${socialMedia.facebook}`);
      if (socialMedia.linkedin) links.push(`LinkedIn: ${socialMedia.linkedin}`);
      return links.length > 0 ? links.join('; ') : 'N/A';
    };

    // Generate CSV content with all available fields
    const csvHeaders = [
      'First Name',
      'Last Name',
      'Email',
      'Playa Name',
      'City',
      'Years Burned',
      'Skills',
      'Has Ticket',
      'Has Vehicle Pass',
      'Travel Plans',
      'Early Arrival Interest',
      'Late Departure Interest',
      'Bio',
      'Social Media',
      'Dues Status',
      'Added to Roster'
    ];

    const csvRows = populatedMembers.map(memberEntry => {
      const user = memberEntry.memberDetails.userDetails;
      const overrides = memberEntry.overrides || {};
      
      // Use overrides if available, otherwise fall back to user data
      const playaName = overrides.playaName !== undefined ? overrides.playaName : user.playaName;
      const yearsBurned = overrides.yearsBurned !== undefined ? overrides.yearsBurned : user.yearsBurned;
      const skills = overrides.skills !== undefined ? overrides.skills : user.skills;
      
      return [
        `"${user.firstName || 'N/A'}"`,
        `"${user.lastName || 'N/A'}"`,
        `"${user.email || 'N/A'}"`,
        `"${playaName || 'Not set'}"`,
        `"${user.city || 'N/A'}"`,
        (yearsBurned === 0 || yearsBurned === '0') ? 'Virgin' : (yearsBurned || 0),
        `"${(skills || []).join(', ')}"`,
        formatTicketVPStatus(user.hasTicket),
        formatTicketVPStatus(user.hasVehiclePass),
        `"${formatTravelPlans(user.arrivalDate, user.departureDate)}"`,
        user.interestedInEAP ? 'Yes' : 'No',
        user.interestedInStrike ? 'Yes' : 'No',
        `"${(user.bio || '').replace(/"/g, '""')}"`,
        `"${formatSocialMedia(user.socialMedia).replace(/"/g, '""')}"`,
        normalizeDuesStatus(user.duesStatus || DUES_STATUS.UNPAID),
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
    
    // Log roster export for CAMP
    await recordActivity('CAMP', camp._id, req.user._id, 'DATA_ACTION', {
      field: 'roster',
      action: 'exported',
      rosterId: roster._id,
      rosterName: roster.name,
      format: 'CSV',
      memberCount: populatedMembers.length
    });
    
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
    
    // Resolve camp from member record to avoid relying on JWT campLead fields
    const member = await db.findMember({ _id: memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const campId = member.camp;
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Permission check (camp owner/admin or Camp Lead)
    const hasPermission = await canManageCamp(req, camp._id);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    // Find the active roster
    const activeRoster = await db.findActiveRoster({ camp: camp._id });
    if (!activeRoster) {
      return res.status(404).json({ message: 'No active roster found' });
    }

    // Find member before removal for logging
    const memberUser = member ? await db.findUser({ _id: member.user }) : null;
    const memberName = memberUser ? `${memberUser.firstName} ${memberUser.lastName}` : 'Unknown';
    
    // Remove member from roster
    const updatedRoster = await db.removeMemberFromRoster(activeRoster._id, memberId);
    
    // Log member removal for both MEMBER and CAMP
    if (member && memberUser) {
      await recordActivity('MEMBER', member.user, req.user._id, 'ENTITY_REMOVED', {
        field: 'roster',
        rosterId: activeRoster._id,
        rosterName: activeRoster.name,
        campId: camp._id,
        campName: camp.name || camp.campName,
        reason: 'Removed from active roster'
      });
      
      await recordActivity('CAMP', camp._id, req.user._id, 'ENTITY_REMOVED', {
        field: 'roster',
        rosterId: activeRoster._id,
        rosterName: activeRoster.name,
        memberId: memberId,
        memberName: memberName,
        memberEmail: memberUser.email,
        reason: 'Removed from active roster'
      });
    }
    
    // Find and update the member's application status to withdrawn (allows re-application)
    if (member) {
      console.log('🔄 [Roster Removal] Updating member and application status to "withdrawn"');
      
      // Update the member record to withdrawn status
      await db.updateMember(memberId, { 
        status: 'withdrawn',
        reviewedAt: new Date(),
        reviewedBy: req.user._id,
        reviewNotes: 'Removed from active roster - eligible to reapply'
      });
      
      // Also update the corresponding application record to withdrawn
      const application = await db.findMemberApplication({ 
        applicant: member.user, 
        camp: camp._id 
      });
      if (application) {
        await db.updateMemberApplication(application._id, {
          status: 'withdrawn',
          reviewedAt: new Date(),
          reviewedBy: req.user._id,
          reviewNotes: 'Removed from active roster - eligible to reapply'
        });
        console.log('✅ [Roster Removal] Application status updated to "withdrawn":', application._id);
      }
    }

    res.json({ message: 'Member removed from roster and can now reapply' });
  } catch (error) {
    console.error('Remove member from roster error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/rosters/:rosterId/members
// @desc    Manually add a new member to roster
// @access  Private (Camp admins/leads only)
router.post('/:rosterId/members', authenticateToken, async (req, res) => {
  try {
    const { rosterId } = req.params;
    const memberData = req.body;

    // Validate required fields
    if (!memberData.firstName || !memberData.lastName || !memberData.email) {
      return res.status(400).json({ message: 'First name, last name, and email are required' });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(memberData.email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    // Resolve roster and camp to avoid relying on JWT campLead fields
    const roster = await db.findRoster({ _id: rosterId });
    if (!roster) {
      return res.status(404).json({ message: 'Roster not found' });
    }
    
    const campId = roster.camp;
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    const hasPermission = await canManageCamp(req, camp._id);
    if (!hasPermission) {
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    // Check if user with this email already exists
    let user = await db.findUser({ email: memberData.email });
    
    if (!user) {
      // Create new user account
      const newUser = {
        firstName: memberData.firstName,
        lastName: memberData.lastName,
        email: memberData.email,
        password: 'TempPass123!', // Temporary password - user should reset
        accountType: 'personal',
        playaName: memberData.playaName || '',
        city: memberData.city || '',
        yearsBurned: memberData.yearsBurned || 0,
        hasTicket: memberData.hasTicket,
        hasVehiclePass: memberData.hasVehiclePass,
        arrivalDate: memberData.arrivalDate || null,
        departureDate: memberData.departureDate || null,
        skills: memberData.skills || [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      user = await db.createUser(newUser);
    }

    // Check if user is already in this roster
    const isAlreadyMember = roster.members.some(m => 
      m.user?.toString() === user._id.toString() || 
      m.user?._id?.toString() === user._id.toString()
    );
    
    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already a member of this roster' });
    }

    // Create member record
    const newMember = {
      user: user._id,
      camp: camp._id,
      roster: rosterId,
      addedAt: new Date(),
      addedBy: req.user._id,
      status: 'approved',
      dues: {
        paid: memberData.duesPaid === true,
        paidAt: memberData.duesPaid === true ? new Date() : null
      }
    };

    const createdMember = await db.createMember(newMember);

    // Add member to roster
    await db.addMemberToRoster(
      rosterId,
      createdMember._id,
      req.user._id,
      { duesStatus: memberData.duesPaid === true ? DUES_STATUS.PAID : DUES_STATUS.UNPAID }
    );
    
    // Log member addition for both MEMBER and CAMP
    await recordActivity('MEMBER', user._id, req.user._id, 'RESOURCE_ASSIGNED', {
      field: 'roster',
      rosterId: rosterId,
      rosterName: roster.name,
      campId: camp._id,
      campName: camp.name || camp.campName,
      memberId: createdMember._id
    });
    
    await recordActivity('CAMP', camp._id, req.user._id, 'RESOURCE_ASSIGNED', {
      field: 'roster',
      rosterId: rosterId,
      rosterName: roster.name,
      memberId: createdMember._id,
      memberName: `${user.firstName} ${user.lastName}`,
      memberEmail: user.email
    });

    res.status(201).json({
      message: 'Member added successfully',
      member: createdMember,
      user: user
    });
  } catch (error) {
    console.error('Add member to roster error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/rosters/:id
// @desc    Get a specific roster with members
// @access  Private (Camp owners only)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    // Get camp using helper (immutable campId)
    const campId = await getUserCampId(req);
    if (!campId) {
      return res.status(404).json({ message: 'Camp not found' });
    }
    const camp = await db.findCamp({ _id: campId });
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
                duesStatus: normalizeDuesStatus(memberEntry.duesStatus || DUES_STATUS.UNPAID)
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

// @route   POST /api/rosters/:rosterId/members/:memberId/dues/preview
// @desc    Build editable dues email preview before sending
// @access  Private (Camp admins/leads)
router.post('/:rosterId/members/:memberId/dues/preview', authenticateToken, async (req, res) => {
  try {
    const { rosterId, memberId } = req.params;
    const { actionType, targetStatus, subject, body } = req.body;

    const roster = await db.findRoster({ _id: rosterId }) || await db.findRoster({ _id: parseInt(rosterId) });
    if (!roster) return res.status(404).json({ message: 'Roster not found' });

    const camp = await db.findCamp({ _id: roster.camp });
    if (!camp) return res.status(404).json({ message: 'Camp not found' });

    const hasPermission = await canManageCamp(req, camp._id);
    if (!hasPermission) return res.status(403).json({ message: 'Camp admin or Camp Lead access required' });

    const memberIndex = getMemberEntryIndex(roster, memberId);
    if (memberIndex === -1) return res.status(404).json({ message: 'Member not found in roster' });

    const member = await db.findMember({ _id: memberId });
    const memberUser = member ? await db.findUser({ _id: member.user }) : null;
    if (!memberUser?.email) return res.status(400).json({ message: 'Member does not have an email address' });

    let previewType = actionType;
    if (!previewType && targetStatus) {
      const previousStatus = normalizeDuesStatus(roster.members[memberIndex].duesStatus || DUES_STATUS.UNPAID);
      previewType = getEmailTrigger(previousStatus, targetStatus);
    }

    if (!previewType || !['instructions', 'receipt'].includes(previewType)) {
      return res.status(400).json({ message: 'Preview type must be instructions or receipt' });
    }

    const paymentDate = previewType === 'receipt' ? new Date() : null;
    const preview = await buildDuesEmailPreview({
      camp,
      memberUser,
      type: previewType,
      paymentDate,
      overrideSubject: subject,
      overrideBody: body
    });

    res.json({
      preview,
      recipient: memberUser.email
    });
  } catch (error) {
    console.error('Preview dues email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/rosters/:rosterId/members/:memberId/dues/send-email
// @desc    Send dues instruction/receipt without changing status
// @access  Private (Camp admins/leads)
router.post('/:rosterId/members/:memberId/dues/send-email', authenticateToken, async (req, res) => {
  try {
    const { rosterId, memberId } = req.params;
    const { actionType, subject, body, saveAsCampDefault } = req.body;

    if (!actionType || !['instructions', 'receipt'].includes(actionType)) {
      return res.status(400).json({ message: 'actionType must be instructions or receipt' });
    }

    const roster = await db.findRoster({ _id: rosterId }) || await db.findRoster({ _id: parseInt(rosterId) });
    if (!roster) return res.status(404).json({ message: 'Roster not found' });

    const camp = await db.findCamp({ _id: roster.camp });
    if (!camp) return res.status(404).json({ message: 'Camp not found' });

    const hasPermission = await canManageCamp(req, camp._id);
    if (!hasPermission) return res.status(403).json({ message: 'Camp admin or Camp Lead access required' });

    const memberIndex = getMemberEntryIndex(roster, memberId);
    if (memberIndex === -1) return res.status(404).json({ message: 'Member not found in roster' });

    const member = await db.findMember({ _id: memberId });
    const memberUser = member ? await db.findUser({ _id: member.user }) : null;
    if (!memberUser?.email) return res.status(400).json({ message: 'Member does not have an email address' });

    const preview = await buildDuesEmailPreview({
      camp,
      memberUser,
      type: actionType,
      paymentDate: actionType === 'receipt' ? (roster.members[memberIndex].duesPaidAt || new Date()) : null,
      overrideSubject: subject,
      overrideBody: body
    });

    await sendDuesEmail({
      to: memberUser.email,
      subject: preview.subject,
      body: preview.body
    });

    if (saveAsCampDefault === true) {
      const updateData = actionType === 'instructions'
        ? {
            duesInstructionsSubject: subject || null,
            duesInstructionsBody: body || null
          }
        : {
            duesReceiptSubject: subject || null,
            duesReceiptBody: body || null
          };
      await db.updateCamp({ _id: camp._id }, updateData);
    }

    if (actionType === 'receipt') {
      roster.members[memberIndex].duesReceiptSentAt = new Date();
      roster.markModified('members');
      await roster.save();
    }

    await recordActivity('CAMP', camp._id, req.user._id, 'DATA_ACTION', {
      field: 'duesEmail',
      action: actionType,
      memberId,
      memberEmail: memberUser.email,
      rosterId: roster._id
    });

    res.json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Send dues email error:', error);
    res.status(500).json({ message: 'Failed to send email' });
  }
});

// @route   PUT /api/rosters/:rosterId/members/:memberId/dues
// @desc    Update structured dues status for a roster member
// @access  Private (Camp admins/leads)
router.put('/:rosterId/members/:memberId/dues', authenticateToken, async (req, res) => {
  try {
    const { rosterId, memberId } = req.params;
    const { duesStatus, emailPreview, saveAsCampDefault } = req.body;

    const nextStatus = normalizeDuesStatus(duesStatus);
    if (!Object.values(DUES_STATUS).includes(nextStatus)) {
      return res.status(400).json({ message: 'Invalid dues status' });
    }

    const roster = await db.findRoster({ _id: rosterId }) || await db.findRoster({ _id: parseInt(rosterId) });
    if (!roster) return res.status(404).json({ message: 'Roster not found' });

    const camp = await db.findCamp({ _id: roster.camp });
    if (!camp) return res.status(404).json({ message: 'Camp not found' });

    const hasPermission = await canManageCamp(req, camp._id);
    if (!hasPermission) return res.status(403).json({ message: 'Camp admin or Camp Lead access required' });

    const memberIndex = getMemberEntryIndex(roster, memberId);
    if (memberIndex === -1) return res.status(404).json({ message: 'Member not found in roster' });

    const previousStatus = normalizeDuesStatus(roster.members[memberIndex].duesStatus || DUES_STATUS.UNPAID);
    if (previousStatus === nextStatus) {
      return res.status(200).json({ message: 'No dues status change', duesStatus: previousStatus, memberId });
    }

    if (!isAllowedTransition(previousStatus, nextStatus)) {
      return res.status(400).json({ message: `Invalid transition from ${previousStatus} to ${nextStatus}` });
    }

    const emailTriggerType = getEmailTrigger(previousStatus, nextStatus);
    const member = await db.findMember({ _id: memberId });
    const memberUser = member ? await db.findUser({ _id: member.user }) : null;

    if (emailTriggerType) {
      if (!memberUser?.email) {
        return res.status(400).json({ message: 'Cannot send dues email: member has no email' });
      }
      if (!emailPreview?.subject || !emailPreview?.body) {
        return res.status(400).json({ message: 'Email preview subject and body are required before sending' });
      }
    }

    let renderedEmail = null;
    if (emailTriggerType) {
      renderedEmail = await buildDuesEmailPreview({
        camp,
        memberUser,
        type: emailTriggerType,
        paymentDate: nextStatus === DUES_STATUS.PAID ? new Date() : null,
        overrideSubject: emailPreview.subject,
        overrideBody: emailPreview.body
      });

      try {
        await sendDuesEmail({
          to: memberUser.email,
          subject: renderedEmail.subject,
          body: renderedEmail.body
        });
      } catch (emailError) {
        await recordActivity('CAMP', camp._id, req.user._id, 'DATA_ACTION', {
          field: 'duesEmail',
          action: 'failed',
          memberId,
          memberEmail: memberUser.email,
          trigger: emailTriggerType,
          error: emailError.message
        });
        return res.status(502).json({ message: 'Failed to send dues email; status not updated' });
      }

      if (saveAsCampDefault === true) {
        const updateData = emailTriggerType === 'instructions'
          ? {
              duesInstructionsSubject: emailPreview.subject,
              duesInstructionsBody: emailPreview.body
            }
          : {
              duesReceiptSubject: emailPreview.subject,
              duesReceiptBody: emailPreview.body
            };
        await db.updateCamp({ _id: camp._id }, updateData);
      }
    }

    const now = new Date();
    roster.members[memberIndex].duesStatus = nextStatus;
    roster.members[memberIndex].paid = nextStatus === DUES_STATUS.PAID;

    if (nextStatus === DUES_STATUS.INSTRUCTED) {
      roster.members[memberIndex].duesInstructedAt = now;
    }
    if (nextStatus === DUES_STATUS.PAID) {
      roster.members[memberIndex].duesPaidAt = now;
      roster.members[memberIndex].duesPaidByUserId = req.user._id;
      roster.members[memberIndex].duesReceiptSentAt = now;
    }
    if (previousStatus === DUES_STATUS.PAID && nextStatus === DUES_STATUS.UNPAID) {
      roster.members[memberIndex].duesPaidAt = null;
      roster.members[memberIndex].duesPaidByUserId = null;
      // Keep duesReceiptSentAt for historical audit.
    }

    roster.markModified('members');
    roster.updatedAt = now;
    await roster.save();

    if (member && memberUser) {
      await recordActivity('MEMBER', member.user, req.user._id, 'SETTING_TOGGLED', {
        field: 'duesStatus',
        oldValue: previousStatus,
        newValue: nextStatus,
        rosterId: roster._id,
        campId: camp._id,
        emailTriggerType: emailTriggerType || null
      });

      await recordActivity('CAMP', camp._id, req.user._id, 'SETTING_TOGGLED', {
        field: 'duesStatus',
        oldValue: previousStatus,
        newValue: nextStatus,
        rosterId: roster._id,
        memberId,
        memberName: `${memberUser.firstName} ${memberUser.lastName}`,
        memberEmail: memberUser.email,
        emailTriggerType: emailTriggerType || null
      });
    }

    res.json({
      message: 'Dues status updated successfully',
      duesStatus: nextStatus,
      memberId
    });
  } catch (error) {
    console.error('Error updating dues status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/rosters/:rosterId/members/:memberId/overrides
// @desc    Update roster-specific member overrides (playaName, yearsBurned, skills)
// @access  Private (Camp owners and Camp Leads)
router.put('/:rosterId/members/:memberId/overrides', authenticateToken, async (req, res) => {
  try {
    const { rosterId, memberId } = req.params;
    const { 
      playaName, 
      yearsBurned, 
      skills,
      hasTicket,
      hasVehiclePass,
      interestedInEAP,
      interestedInStrike,
      arrivalDate,
      departureDate,
      city,
      state
    } = req.body;

    console.log('🔄 [Roster Override] Starting update:', { rosterId, memberId, updates: req.body });

    // Resolve roster and camp to avoid relying on JWT campLead fields
    let roster;
    roster = await db.findRoster({ _id: rosterId });
    
    if (!roster) {
      // Fallback: try parsing as integer for legacy numeric IDs
      console.log('⚠️ [Roster Override] Trying integer roster ID...');
      roster = await db.findRoster({ _id: parseInt(rosterId) });
    }
    
    if (!roster) {
      console.error('❌ [Roster Override] Roster not found:', { rosterId });
      return res.status(404).json({ message: 'Roster not found' });
    }

    const campId = roster.camp;
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      console.log('❌ [Roster Override] Camp not found in database');
      return res.status(404).json({ message: 'Camp not found' });
    }

    console.log('✅ [Roster Override] Camp found:', { campId: camp._id, campName: camp.name });

    // Check if user has permission (camp owner OR Camp Lead)
    const hasPermission = await canManageCamp(req, camp._id);
    if (!hasPermission) {
      console.log('❌ [Roster Override] Permission denied - not camp owner or Camp Lead');
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

    // Verify roster belongs to this camp (defensive)
    if (roster.camp.toString() !== camp._id.toString()) {
      return res.status(403).json({ message: 'Access denied - roster belongs to different camp' });
    }

    console.log('✅ [Roster Override] Roster found:', { rosterId: roster._id, membersCount: roster.members?.length });

    // Find the member in the roster
    // Handle both populated member objects and member ID strings
    console.log('🔍 [Roster Override] Searching for member in roster...');
    const memberIndex = roster.members.findIndex(m => {
      if (!m.member) return false;
      
      // If member is populated (object), compare by _id
      if (typeof m.member === 'object' && m.member._id) {
        return m.member._id.toString() === memberId.toString();
      }
      
      // If member is just an ID (string/ObjectId)
      return m.member.toString() === memberId.toString();
    });
    
    if (memberIndex === -1) {
      console.error('❌ [Roster Override] Member not found in roster:', { 
        memberId, 
        availableMembers: roster.members.map(m => {
          const id = typeof m.member === 'object' ? m.member?._id?.toString() : m.member?.toString();
          return id;
        })
      });
      return res.status(404).json({ message: 'Member not found in roster' });
    }

    console.log('✅ [Roster Override] Member found at index:', memberIndex);

    // Get member info for logging BEFORE making changes
    const member = await db.findMember({ _id: memberId });
    const memberUser = member ? await db.findUser({ _id: member.user }) : null;
    
    // CRITICAL: Capture old overrides BEFORE making any updates
    const oldOverrides = JSON.parse(JSON.stringify(roster.members[memberIndex].overrides || {}));
    
    // Create or update the overrides object
    if (!roster.members[memberIndex].overrides) {
      roster.members[memberIndex].overrides = {};
    }

    // Track which fields changed BEFORE updating
    const changedFields = [];
    
    // Update all provided fields and track changes
    if (playaName !== undefined) {
      const oldValue = oldOverrides.playaName;
      if (playaName !== oldValue) {
        changedFields.push({ field: 'playaName', oldValue: oldValue, newValue: playaName });
      }
      roster.members[memberIndex].overrides.playaName = playaName;
      console.log('📝 [Roster Override] Updated playaName:', playaName);
    }
    if (yearsBurned !== undefined) {
      const oldValue = oldOverrides.yearsBurned;
      if (yearsBurned !== oldValue) {
        changedFields.push({ field: 'yearsBurned', oldValue: oldValue, newValue: yearsBurned });
      }
      roster.members[memberIndex].overrides.yearsBurned = yearsBurned;
      console.log('📝 [Roster Override] Updated yearsBurned:', yearsBurned);
    }
    if (skills !== undefined) {
      const oldValue = oldOverrides.skills;
      const oldValueStr = JSON.stringify(oldValue || []);
      const newValueStr = JSON.stringify(skills || []);
      if (oldValueStr !== newValueStr) {
        changedFields.push({ field: 'skills', oldValue: oldValue, newValue: skills });
      }
      roster.members[memberIndex].overrides.skills = skills;
      console.log('📝 [Roster Override] Updated skills:', skills);
    }
    if (hasTicket !== undefined) {
      const oldValue = oldOverrides.hasTicket;
      if (hasTicket !== oldValue) {
        changedFields.push({ field: 'hasTicket', oldValue: oldValue, newValue: hasTicket });
      }
      roster.members[memberIndex].overrides.hasTicket = hasTicket;
      console.log('📝 [Roster Override] Updated hasTicket:', hasTicket);
    }
    if (hasVehiclePass !== undefined) {
      const oldValue = oldOverrides.hasVehiclePass;
      if (hasVehiclePass !== oldValue) {
        changedFields.push({ field: 'hasVehiclePass', oldValue: oldValue, newValue: hasVehiclePass });
      }
      roster.members[memberIndex].overrides.hasVehiclePass = hasVehiclePass;
      console.log('📝 [Roster Override] Updated hasVehiclePass:', hasVehiclePass);
    }
    if (interestedInEAP !== undefined) {
      const oldValue = oldOverrides.interestedInEAP;
      if (interestedInEAP !== oldValue) {
        changedFields.push({ field: 'interestedInEAP', oldValue: oldValue, newValue: interestedInEAP });
      }
      roster.members[memberIndex].overrides.interestedInEAP = interestedInEAP;
      console.log('📝 [Roster Override] Updated interestedInEAP:', interestedInEAP);
    }
    if (interestedInStrike !== undefined) {
      const oldValue = oldOverrides.interestedInStrike;
      if (interestedInStrike !== oldValue) {
        changedFields.push({ field: 'interestedInStrike', oldValue: oldValue, newValue: interestedInStrike });
      }
      roster.members[memberIndex].overrides.interestedInStrike = interestedInStrike;
      console.log('📝 [Roster Override] Updated interestedInStrike:', interestedInStrike);
    }
    if (arrivalDate !== undefined) {
      const oldValue = oldOverrides.arrivalDate;
      if (arrivalDate !== oldValue) {
        changedFields.push({ field: 'arrivalDate', oldValue: oldValue, newValue: arrivalDate });
      }
      roster.members[memberIndex].overrides.arrivalDate = arrivalDate;
      console.log('📝 [Roster Override] Updated arrivalDate:', arrivalDate);
    }
    if (departureDate !== undefined) {
      const oldValue = oldOverrides.departureDate;
      if (departureDate !== oldValue) {
        changedFields.push({ field: 'departureDate', oldValue: oldValue, newValue: departureDate });
      }
      roster.members[memberIndex].overrides.departureDate = departureDate;
      console.log('📝 [Roster Override] Updated departureDate:', departureDate);
    }
    if (city !== undefined) {
      const oldValue = oldOverrides.city;
      if (city !== oldValue) {
        changedFields.push({ field: 'city', oldValue: oldValue, newValue: city });
      }
      roster.members[memberIndex].overrides.city = city;
      console.log('📝 [Roster Override] Updated city:', city);
    }
    if (state !== undefined) {
      const oldValue = oldOverrides.state;
      if (state !== oldValue) {
        changedFields.push({ field: 'state', oldValue: oldValue, newValue: state });
      }
      roster.members[memberIndex].overrides.state = state;
      console.log('📝 [Roster Override] Updated state:', state);
    }
    
    console.log(`🔍 [Roster Override] Detected ${changedFields.length} field changes:`, changedFields.map(f => f.field).join(', '));
    
    // CRITICAL: Mark the members array as modified for Mongoose to save it
    roster.markModified('members');
    roster.updatedAt = new Date();

    // Save the updated roster directly (must use .save() for markModified to work)
    console.log('💾 [Roster Override] Saving roster...');
    await roster.save();
    console.log('✅ [Roster Override] Roster saved successfully');
    console.log('📊 [Roster Override] Saved overrides:', JSON.stringify(roster.members[memberIndex].overrides, null, 2));
    
    // Log profile updates for each changed field (for both MEMBER and CAMP)
    if (member && memberUser && changedFields.length > 0) {
      console.log(`✅ [Roster Override] Logging ${changedFields.length} field changes for member ${memberUser.email}`);
      
      for (const change of changedFields) {
        // Format values for display
        let formattedOldValue = change.oldValue;
        let formattedNewValue = change.newValue;
        
        // Handle boolean values
        if (typeof change.oldValue === 'boolean') {
          formattedOldValue = change.oldValue ? 'Yes' : 'No';
        }
        if (typeof change.newValue === 'boolean') {
          formattedNewValue = change.newValue ? 'Yes' : 'No';
        }
        
        // Handle array values (skills)
        if (Array.isArray(change.oldValue)) {
          formattedOldValue = change.oldValue.length > 0 ? change.oldValue.join(', ') : '(none)';
        }
        if (Array.isArray(change.newValue)) {
          formattedNewValue = change.newValue.length > 0 ? change.newValue.join(', ') : '(none)';
        }
        
        // Handle date values
        if (change.field === 'arrivalDate' || change.field === 'departureDate') {
          if (change.oldValue) {
            formattedOldValue = new Date(change.oldValue).toLocaleDateString();
          } else {
            formattedOldValue = '(not set)';
          }
          if (change.newValue) {
            formattedNewValue = new Date(change.newValue).toLocaleDateString();
          } else {
            formattedNewValue = '(not set)';
          }
        }
        
        await recordActivity('MEMBER', member.user, req.user._id, 'PROFILE_UPDATE', {
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          oldValueDisplay: formattedOldValue,
          newValueDisplay: formattedNewValue,
          rosterId: roster._id,
          rosterName: roster.name,
          campId: camp._id,
          campName: camp.name || camp.campName,
          source: 'roster_override'
        });
        
        await recordActivity('CAMP', camp._id, req.user._id, 'PROFILE_UPDATE', {
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          oldValueDisplay: formattedOldValue,
          newValueDisplay: formattedNewValue,
          rosterId: roster._id,
          rosterName: roster.name,
          memberId: memberId,
          memberName: `${memberUser.firstName} ${memberUser.lastName}`,
          memberEmail: memberUser.email,
          source: 'roster_override'
        });
      }
      
      console.log(`✅ [Roster Override] Successfully logged ${changedFields.length} field changes`);
    } else if (changedFields.length === 0) {
      console.log('⚠️ [Roster Override] No field changes detected - skipping audit log');
    } else {
      console.log('⚠️ [Roster Override] Member or memberUser not found - skipping audit log');
    }

    res.json({ 
      message: 'Member overrides updated successfully',
      member: roster.members[memberIndex]
    });
  } catch (error) {
    console.error('Update member overrides error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/rosters/camp/:campId
// @desc    Get roster for a specific camp (camp owners and members)
// @access  Private (Camp owners and members only)
router.get('/camp/:campId', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;
    console.log('🔍 [GET /api/rosters/camp/:campId] Request for campId:', campId);
    
    // Try both string and numeric versions of campId
    let camp;
    try {
      camp = await db.findCamp({ _id: campId });
    } catch (err) {
      console.log('⚠️ [GET /api/rosters/camp/:campId] Failed with string campId, trying numeric...');
      const numericCampId = parseInt(campId);
      camp = await db.findCamp({ _id: numericCampId });
    }
    
    if (!camp) {
      console.log('❌ [GET /api/rosters/camp/:campId] Camp not found');
      return res.status(404).json({ message: 'Camp not found' });
    }

    console.log('✅ [GET /api/rosters/camp/:campId] Camp found:', camp._id);

    // Check if user is camp owner or member
    // Check camp ownership using helper
    const isCampOwner = await canAccessCamp(req, camp._id);
    const isCampMember = await db.findMember({ camp: camp._id, user: req.user._id, status: 'active' });
    
    console.log('🔐 [GET /api/rosters/camp/:campId] Access check:', { isCampOwner, isCampMember: !!isCampMember });
    
    if (!isCampOwner && !isCampMember) {
      console.log('❌ [GET /api/rosters/camp/:campId] Access denied');
      return res.status(403).json({ message: 'Access denied - must be camp owner or member' });
    }

    const roster = await db.findActiveRoster({ camp: camp._id });
    
    console.log('📋 [GET /api/rosters/camp/:campId] Roster found:', roster ? `with ${roster.members?.length || 0} members` : 'none');
    
    if (!roster || !roster.members || roster.members.length === 0) {
      console.log('⚠️ [GET /api/rosters/camp/:campId] No roster or members found');
      return res.json({ members: [] });
    }

    // Populate member details with better error handling
    const membersWithDetails = [];
    for (const member of roster.members) {
      try {
        // First find the member record
        const memberRecord = await db.findMember({ _id: member.member });
        if (!memberRecord) {
          console.warn(`⚠️ [GET /api/rosters/camp/:campId] Member record not found for ID: ${member.member}`);
          continue;
        }
        
        // Then find the user record
        const user = await db.findUser({ _id: memberRecord.user });
        if (!user) {
          console.warn(`⚠️ [GET /api/rosters/camp/:campId] User not found for member: ${member.member}`);
          continue;
        }
        
        membersWithDetails.push({
          ...member,
          user: {
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
          }
        });
      } catch (memberError) {
        console.error(`❌ [GET /api/rosters/camp/:campId] Error processing member ${member.member}:`, memberError);
        // Continue with next member instead of failing entire request
      }
    }

    console.log('✅ [GET /api/rosters/camp/:campId] Returning', membersWithDetails.length, 'members');

    res.json({
      members: membersWithDetails
    });
  } catch (error) {
    console.error('❌ [GET /api/rosters/camp/:campId] Fatal error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PATCH /api/roster/member/:memberId/dues
// @desc    Update member's dues status
// @access  Private (Camp owners and Camp Leads)
router.patch('/member/:memberId/dues', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    const isPaid = req.body?.isPaid === true || req.body?.duesStatus === DUES_STATUS.PAID || req.body?.duesStatus === 'Paid';

    console.log('🔄 [DUES UPDATE] Starting dues status update');
    console.log('📝 [DUES UPDATE] Request params:', { memberId: req.params.memberId });
    console.log('📝 [DUES UPDATE] Request body:', req.body);

    // Validate request body exists
    if (!req.body || typeof req.body !== 'object') {
      console.log('❌ [DUES UPDATE] Request body is missing or invalid');
      return res.status(400).json({ message: 'Request body is required' });
    }

    // Resolve camp from member record to avoid relying on JWT campLead fields
    console.log('🔍 [DUES UPDATE] Looking up camp via member...');
    const member = await db.findMember({ _id: memberId });
    if (!member) {
      console.log('❌ [DUES UPDATE] Member not found');
      return res.status(404).json({ message: 'Member not found' });
    }

    const campId = member.camp;
    console.log('🏕️ [DUES UPDATE] Camp ID resolved:', campId);

    // Check if user has permission (camp owner OR Camp Lead)
    const hasPermission = await canManageCamp(req, campId);
    if (!hasPermission) {
      console.log('❌ [DUES UPDATE] Permission denied - not camp owner or Camp Lead');
      return res.status(403).json({ message: 'Camp owner or Camp Lead access required' });
    }

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
      const memberId_str = typeof memberEntry.member === 'object' && memberEntry.member._id 
        ? memberEntry.member._id.toString() 
        : memberEntry.member?.toString();
      
      console.log('📝 [DUES UPDATE] Comparing:', memberId_str, 'vs', memberId);
      
      if (memberId_str === memberId) {
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
    console.log('💾 [DUES UPDATE] Updating dues status from', targetMemberEntry.duesStatus, 'to', isPaid ? DUES_STATUS.PAID : DUES_STATUS.UNPAID);
    const originalDuesStatus = targetMemberEntry.duesStatus;
    
    // Create explicit update payload to match database schema (duesStatus as string)
    const updatePayload = { duesStatus: isPaid ? DUES_STATUS.PAID : DUES_STATUS.UNPAID, paid: isPaid };
    console.log('📝 [DUES UPDATE] Update payload:', updatePayload);
    
    // Find the index of the member entry in the roster for targeted update
    const memberIndex = activeRoster.members.findIndex(memberEntry => {
      if (!memberEntry.member) return false;
      if (typeof memberEntry.member === 'object' && memberEntry.member._id) {
        return memberEntry.member._id.toString() === memberId;
      }
      return memberEntry.member.toString() === memberId;
    });
    
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
      duesStatus: isPaid ? DUES_STATUS.PAID : DUES_STATUS.UNPAID, // Add the actual database value
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

// @route   POST /api/rosters/member/:memberId/grant-camp-lead
// @desc    Grant Camp Lead role to a roster member
// @access  Private (Camp owners only)
router.post('/member/:memberId/grant-camp-lead', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    console.log('🎖️ [GRANT CAMP LEAD] Starting role assignment for memberId:', memberId);

    // Only camp owners can grant Camp Lead role (not Camp Leads themselves)
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      console.log('❌ [GRANT CAMP LEAD] Permission denied - user not camp owner');
      return res.status(403).json({ message: 'Only camp owners can assign Camp Lead role' });
    }

    // Get camp ID from user context
    const campId = await getUserCampId(req);
    if (!campId) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    console.log('🏕️ [GRANT CAMP LEAD] Camp ID resolved:', campId);

    // Find the active roster
    const activeRoster = await db.findActiveRoster({ camp: campId });
    if (!activeRoster || !activeRoster.members) {
      return res.status(404).json({ message: 'No active roster found for this camp' });
    }

    // Find the specific member entry in the roster
    // Handle both populated member objects and member ID strings
    const memberIndex = activeRoster.members.findIndex(entry => {
      if (!entry.member) return false;
      
      // If member is populated (object), compare by _id
      if (typeof entry.member === 'object' && entry.member._id) {
        return entry.member._id.toString() === memberId;
      }
      
      // If member is just an ID (string/ObjectId)
      return entry.member.toString() === memberId;
    });

    console.log('🔍 [GRANT CAMP LEAD] Searching for memberId:', memberId);
    console.log('🔍 [GRANT CAMP LEAD] Found memberIndex:', memberIndex);

    if (memberIndex === -1) {
      console.log('❌ [GRANT CAMP LEAD] Member not found in roster');
      console.log('📋 [GRANT CAMP LEAD] Available member IDs:', activeRoster.members.map(m => {
        const id = typeof m.member === 'object' ? m.member?._id?.toString() : m.member?.toString();
        return id;
      }));
      return res.status(404).json({ message: 'Member not found in roster' });
    }

    const memberEntry = activeRoster.members[memberIndex];

    // Validate: Member must have status='approved'
    if (memberEntry.status !== 'approved') {
      return res.status(400).json({ 
        message: 'Camp Lead role can only be assigned to approved roster members',
        currentStatus: memberEntry.status
      });
    }

    // Check if already a Camp Lead
    if (memberEntry.isCampLead === true) {
      return res.status(400).json({ message: 'Member is already a Camp Lead' });
    }

    // Get member details for logging and notification
    const member = await db.findMember({ _id: memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member record not found' });
    }

    const user = await db.findUser({ _id: member.user });
    if (!user) {
      return res.status(404).json({ message: 'User record not found' });
    }

    // Update the member entry to grant Camp Lead role
    activeRoster.members[memberIndex].isCampLead = true;

    // CRITICAL: Mark the members array as modified for Mongoose to save it
    activeRoster.markModified('members');
    activeRoster.updatedAt = new Date();

    // Save the updated roster directly (must use .save() for markModified to work)
    await activeRoster.save();
    console.log('✅ [GRANT CAMP LEAD] Role granted and saved successfully');
    
    // Verify the save worked
    const verifyRoster = await db.findRoster({ _id: activeRoster._id });
    const verifyMember = verifyRoster.members.find(m => {
      const id = typeof m.member === 'object' ? m.member._id?.toString() : m.member?.toString();
      return id === memberId;
    });
    console.log('🔍 [GRANT CAMP LEAD] Verified isCampLead after save:', verifyMember?.isCampLead);

    // Record activity (member + camp)
    await recordActivity('MEMBER', user._id, req.user._id, 'CAMP_LEAD_GRANTED', {
      memberId,
      memberName: `${user.firstName} ${user.lastName}`,
      memberEmail: user.email,
      campId
    });
    await recordActivity('CAMP', campId, req.user._id, 'CAMP_LEAD_GRANTED', {
      memberId,
      memberName: `${user.firstName} ${user.lastName}`,
      memberEmail: user.email,
      campId
    });

    // Send email notification
    try {
      const { sendCampLeadGrantedEmail } = require('../services/emailService');
      const camp = await db.findCamp({ _id: campId });
      
      await sendCampLeadGrantedEmail(user, camp);
      console.log('✅ [GRANT CAMP LEAD] Notification email sent');
    } catch (emailError) {
      console.error('⚠️ [GRANT CAMP LEAD] Failed to send notification email:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      message: 'Camp Lead role granted successfully',
      memberId,
      memberName: `${user.firstName} ${user.lastName}`,
      isCampLead: true
    });
  } catch (error) {
    console.error('❌ [GRANT CAMP LEAD] Critical error:', error);
    res.status(500).json({ 
      message: 'Server error granting Camp Lead role',
      error: error.message
    });
  }
});

// @route   POST /api/rosters/member/:memberId/revoke-camp-lead
// @desc    Revoke Camp Lead role from a roster member
// @access  Private (Camp owners only)
router.post('/member/:memberId/revoke-camp-lead', authenticateToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    console.log('🚫 [REVOKE CAMP LEAD] Starting role revocation for memberId:', memberId);

    // Only camp owners can revoke Camp Lead role (not Camp Leads themselves)
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      console.log('❌ [REVOKE CAMP LEAD] Permission denied - user not camp owner');
      return res.status(403).json({ message: 'Only camp owners can revoke Camp Lead role' });
    }

    // Get camp ID from user context
    const campId = await getUserCampId(req);
    if (!campId) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    console.log('🏕️ [REVOKE CAMP LEAD] Camp ID resolved:', campId);

    // Find the active roster
    const activeRoster = await db.findActiveRoster({ camp: campId });
    if (!activeRoster || !activeRoster.members) {
      return res.status(404).json({ message: 'No active roster found for this camp' });
    }

    // Find the specific member entry in the roster
    // Handle both populated member objects and member ID strings
    const memberIndex = activeRoster.members.findIndex(entry => {
      if (!entry.member) return false;
      
      // If member is populated (object), compare by _id
      if (typeof entry.member === 'object' && entry.member._id) {
        return entry.member._id.toString() === memberId;
      }
      
      // If member is just an ID (string/ObjectId)
      return entry.member.toString() === memberId;
    });

    console.log('🔍 [REVOKE CAMP LEAD] Searching for memberId:', memberId);
    console.log('🔍 [REVOKE CAMP LEAD] Found memberIndex:', memberIndex);

    if (memberIndex === -1) {
      console.log('❌ [REVOKE CAMP LEAD] Member not found in roster');
      return res.status(404).json({ message: 'Member not found in roster' });
    }

    const memberEntry = activeRoster.members[memberIndex];

    // Check if currently a Camp Lead
    if (memberEntry.isCampLead !== true) {
      return res.status(400).json({ message: 'Member is not currently a Camp Lead' });
    }

    // Get member details for logging
    const member = await db.findMember({ _id: memberId });
    if (!member) {
      return res.status(404).json({ message: 'Member record not found' });
    }

    const user = await db.findUser({ _id: member.user });
    if (!user) {
      return res.status(404).json({ message: 'User record not found' });
    }

    // Update the member entry to revoke Camp Lead role
    activeRoster.members[memberIndex].isCampLead = false;

    // CRITICAL: Mark the members array as modified for Mongoose to save it
    activeRoster.markModified('members');
    activeRoster.updatedAt = new Date();

    // Save the updated roster directly (must use .save() for markModified to work)
    await activeRoster.save();
    console.log('✅ [REVOKE CAMP LEAD] Role revoked and saved successfully');
    
    // Verify the save worked
    const verifyRoster = await db.findRoster({ _id: activeRoster._id });
    const verifyMember = verifyRoster.members.find(m => {
      const id = typeof m.member === 'object' ? m.member._id?.toString() : m.member?.toString();
      return id === memberId;
    });
    console.log('🔍 [REVOKE CAMP LEAD] Verified isCampLead after save:', verifyMember?.isCampLead);

    // Record activity (member + camp)
    await recordActivity('MEMBER', user._id, req.user._id, 'CAMP_LEAD_REVOKED', {
      memberId,
      memberName: `${user.firstName} ${user.lastName}`,
      memberEmail: user.email,
      campId
    });
    await recordActivity('CAMP', campId, req.user._id, 'CAMP_LEAD_REVOKED', {
      memberId,
      memberName: `${user.firstName} ${user.lastName}`,
      memberEmail: user.email,
      campId
    });

    // Note: Do NOT send email notification on revocation (per requirements)

    res.json({
      message: 'Camp Lead role revoked successfully',
      memberId,
      memberName: `${user.firstName} ${user.lastName}`,
      isCampLead: false
    });
  } catch (error) {
    console.error('❌ [REVOKE CAMP LEAD] Critical error:', error);
    res.status(500).json({ 
      message: 'Server error revoking Camp Lead role',
      error: error.message
    });
  }
});

module.exports = router;
