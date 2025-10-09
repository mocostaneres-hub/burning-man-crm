const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const User = require('../models/User');
const Camp = require('../models/Camp');
const Member = require('../models/Member');
const Admin = require('../models/Admin');
const { authenticateToken, requireAdmin, requirePermission } = require('../middleware/auth');
const db = require('../database/databaseAdapter');

// Configure multer for photo uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
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

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get all data from mock database
    const [
      allUsers,
      allCamps,
      allMembers
    ] = await Promise.all([
      db.findUsers(),
      db.findCamps(),
      db.findMembers()
    ]);

    // Calculate stats
    const totalUsers = allUsers.filter(user => user.isActive).length;
    const totalCamps = allCamps.filter(camp => camp.status === 'active').length;
    const totalMembers = allMembers.filter(member => member.status === 'active').length;
    const activeCamps = allCamps.filter(camp => camp.status === 'active' && camp.isRecruiting).length;
    
    // Get recent users (simplified)
    const recentUsers = allUsers
      .filter(user => user.isActive)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(user => ({
        firstName: user.firstName,
        lastName: user.lastName,
        campName: user.campName,
        accountType: user.accountType,
        createdAt: user.createdAt
      }));
    
    // Get recent camps (simplified)
    const recentCamps = allCamps
      .filter(camp => camp.status === 'active')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(camp => ({
        name: camp.name,
        theme: camp.theme,
        createdAt: camp.createdAt,
        owner: { campName: camp.owner || 'Unknown' }
      }));

    // Simple user growth (mock data)
    const userGrowth = [
      { _id: { year: 2025, month: 9 }, count: totalUsers }
    ];

    // Simple camp statistics (mock data)
    const campStats = [
      { _id: 'small', count: Math.floor(totalCamps * 0.4) },
      { _id: 'medium', count: Math.floor(totalCamps * 0.4) },
      { _id: 'large', count: Math.floor(totalCamps * 0.2) }
    ];

    res.json({
      stats: {
        totalUsers,
        totalCamps,
        totalMembers,
        activeCamps,
        userGrowth,
        campStats
      },
      recent: {
        users: recentUsers,
        camps: recentCamps
      }
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with pagination and filtering
// @access  Private (Admin only)
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      accountType,
      status
    } = req.query;

    // Get all users from mock database (exclude camp accounts - they should be in camps section)
    const allUsers = await db.findUsers();
    
    // Apply filters - exclude camp accounts from users list
    let filteredUsers = allUsers.filter(user => user.accountType !== 'camp');
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = filteredUsers.filter(user => 
        user.firstName?.toLowerCase().includes(searchLower) ||
        user.lastName?.toLowerCase().includes(searchLower) ||
        user.campName?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user._id?.toString().includes(searchLower)
      );
    }
    
    if (accountType) {
      filteredUsers = filteredUsers.filter(user => user.accountType === accountType);
    }
    
    if (status) {
      filteredUsers = filteredUsers.filter(user => user.isActive === (status === 'active'));
    }
    
    // Sort by creation date
    filteredUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const users = filteredUsers.slice(startIndex, endIndex);
    
    const total = filteredUsers.length;

    res.json({
      data: users,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/camps
// @desc    Get all camps with pagination and filtering
// @access  Private (Admin only)
router.get('/camps', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      recruiting
    } = req.query;

    // Get all camps from mock database
    const allCamps = await db.findCamps();
    
    // Enrich camps with owner information
    const enrichedCamps = await Promise.all(allCamps.map(async (camp) => {
      let owner = null;
      if (camp.contactEmail) {
        owner = await db.findUser({ email: camp.contactEmail });
      }
      return {
        ...camp,
        owner: owner ? {
          _id: owner._id,
          firstName: owner.firstName,
          lastName: owner.lastName,
          email: owner.email,
          accountType: owner.accountType
        } : null
      };
    }));
    
    // Apply filters
    let filteredCamps = enrichedCamps;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filteredCamps = filteredCamps.filter(camp => 
        camp.campName?.toLowerCase().includes(searchLower) ||
        camp.name?.toLowerCase().includes(searchLower) ||
        camp.description?.toLowerCase().includes(searchLower) ||
        camp.theme?.toLowerCase().includes(searchLower) ||
        camp.contactEmail?.toLowerCase().includes(searchLower) ||
        camp._id?.toString().includes(searchLower) ||
        camp.owner?.firstName?.toLowerCase().includes(searchLower) ||
        camp.owner?.lastName?.toLowerCase().includes(searchLower) ||
        camp.owner?.email?.toLowerCase().includes(searchLower)
      );
    }
    
    if (status) {
      filteredCamps = filteredCamps.filter(camp => camp.status === status);
    }
    
    if (recruiting !== undefined) {
      filteredCamps = filteredCamps.filter(camp => camp.isRecruiting === (recruiting === 'true'));
    }
    
    // Sort by creation date
    filteredCamps.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const camps = filteredCamps.slice(startIndex, endIndex);
    
    const total = filteredCamps.length;

    res.json({
      data: camps,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });

  } catch (error) {
    console.error('Get camps error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Update user status (activate/deactivate)
// @access  Private (Admin only)
router.put('/users/:id/status', requireAdmin, [
  body('isActive').isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { isActive } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/camps/:id/status
// @desc    Update camp status
// @access  Private (Admin only)
router.put('/camps/:id/status', requireAdmin, [
  body('status').isIn(['active', 'inactive', 'suspended', 'archived'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;

    const camp = await Camp.findById(req.params.id);
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    camp.status = status;
    await camp.save();

    res.json({
      message: 'Camp status updated successfully',
      camp
    });

  } catch (error) {
    console.error('Update camp status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/admins
// @desc    Create new admin user
// @access  Private (Super Admin only)
router.post('/admins', requirePermission('userManagement'), [
  body('userId').isMongoId(),
  body('role').isIn(['super-admin', 'moderator', 'support']),
  body('permissions').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, role, permissions = {} } = req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is already admin
    const existingAdmin = await Admin.findOne({ user: userId });
    if (existingAdmin) {
      return res.status(400).json({ message: 'User is already an admin' });
    }

    // Set default permissions based on role
    const defaultPermissions = {
      userManagement: role === 'super-admin',
      campManagement: role === 'super-admin' || role === 'moderator',
      systemSettings: role === 'super-admin',
      analytics: role === 'super-admin' || role === 'moderator',
      support: true
    };

    const admin = new Admin({
      user: userId,
      role,
      permissions: { ...defaultPermissions, ...permissions },
      createdBy: req.user._id
    });

    await admin.save();

    res.status(201).json({
      message: 'Admin created successfully',
      admin
    });

  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/admins
// @desc    Get all admins
// @access  Private (Admin only)
router.get('/admins', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const admins = await db.findAdmins({ isActive: true });

    res.json({ admins });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/admin/admins/:id
// @desc    Remove admin privileges
// @access  Private (Super Admin only)
router.delete('/admins/:id', requirePermission('userManagement'), async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Prevent removing super admin if it's the last one
    if (admin.role === 'super-admin') {
      const superAdminCount = await Admin.countDocuments({ role: 'super-admin', isActive: true });
      if (superAdminCount <= 1) {
        return res.status(400).json({ message: 'Cannot remove the last super admin' });
      }
    }

    admin.isActive = false;
    await admin.save();

    res.json({ message: 'Admin privileges removed successfully' });
  } catch (error) {
    console.error('Remove admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user by admin
// @access  Private (Admin only)
router.put('/users/:id', authenticateToken, requireAdmin, [
  body('firstName').optional().isLength({ min: 1 }).withMessage('First name is required'),
  body('lastName').optional().isLength({ min: 1 }).withMessage('Last name is required'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('accountType').optional().isIn(['personal', 'camp', 'admin']).withMessage('Invalid account type'),
], async (req, res) => {
  try {
    console.log('🔍 [PUT /api/admin/users/:id] Update user request');
    console.log('🔍 [PUT /api/admin/users/:id] User ID:', req.params.id);
    console.log('🔍 [PUT /api/admin/users/:id] Admin:', { _id: req.user._id, accountType: req.user.accountType });
    console.log('🔍 [PUT /api/admin/users/:id] Update data keys:', Object.keys(req.body));
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ [PUT /api/admin/users/:id] Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Log the admin action
    const adminUser = await db.findUser({ _id: req.user._id });
    if (!adminUser) {
      console.log('❌ [PUT /api/admin/users/:id] Admin user not found');
      return res.status(404).json({ message: 'Admin user not found' });
    }
    
    const targetUser = await db.findUser({ _id: id });
    
    if (!targetUser) {
      console.log('❌ [PUT /api/admin/users/:id] Target user not found');
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('🔍 [PUT /api/admin/users/:id] Target user found:', { _id: targetUser._id, email: targetUser.email });

    // Create action log entry (avoid circular references)
    const { actionHistory, ...safeUpdateData } = updateData;
    const actionLog = {
      action: 'user_updated',
      adminId: req.user._id,
      adminName: `${adminUser.firstName} ${adminUser.lastName}`,
      targetId: id,
      targetName: `${targetUser.firstName} ${targetUser.lastName}`,
      changes: safeUpdateData,
      timestamp: new Date().toISOString()
    };

    // Update user
    console.log('🔍 [PUT /api/admin/users/:id] Updating user...');
    const updatedUser = await db.updateUserById(id, updateData);
    console.log('✅ [PUT /api/admin/users/:id] User updated successfully');
    
    // Add action log to user's history (non-critical, wrapped in try-catch)
    try {
      if (!updatedUser.actionHistory) {
        updatedUser.actionHistory = [];
      }
      updatedUser.actionHistory.push(actionLog);
      await db.updateUserById(id, { actionHistory: updatedUser.actionHistory });
      console.log('✅ [PUT /api/admin/users/:id] Action history updated');
    } catch (historyError) {
      console.error('⚠️ [PUT /api/admin/users/:id] Failed to update action history (non-critical):', historyError);
      // Don't fail the whole request if action history update fails
    }

    res.json({ user: updatedUser });
  } catch (error) {
    console.error('❌ [PUT /api/admin/users/:id] Update user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT /api/admin/camps/:id
// @desc    Update camp by admin
// @access  Private (Admin only)
router.put('/camps/:id', authenticateToken, requireAdmin, [
  body('campName').optional().isLength({ min: 1 }).withMessage('Camp name is required'),
  body('theme').optional().isLength({ min: 1 }).withMessage('Theme is required'),
  body('status').optional().isIn(['active', 'inactive', 'suspended', 'archived']).withMessage('Invalid status'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Log the admin action
    const adminUser = await db.findUser({ _id: req.user._id });
    const targetCamp = await db.findCamp({ _id: id });
    
    if (!targetCamp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Handle photo uploads if present
    if (updateData.photos && Array.isArray(updateData.photos)) {
      // For now, we'll store the photos as-is (assuming they're base64 or URLs)
      // In a production environment, you'd want to upload to Cloudinary here
      console.log('Processing photo updates for camp:', id);
    }

    // Create action log entry (avoid circular references)
    const { actionHistory, ...safeUpdateData } = updateData;
    const actionLog = {
      action: 'camp_updated',
      adminId: req.user._id,
      adminName: `${adminUser.firstName} ${adminUser.lastName}`,
      targetId: id,
      targetName: targetCamp.campName,
      changes: safeUpdateData,
      timestamp: new Date().toISOString()
    };

    // Update camp
    const updatedCamp = await db.updateCampById(id, updateData);
    
    // Add action log to camp's history
    if (!updatedCamp.actionHistory) {
      updatedCamp.actionHistory = [];
    }
    updatedCamp.actionHistory.push(actionLog);
    await db.updateCampById(id, { actionHistory: updatedCamp.actionHistory });

    res.json({ camp: updatedCamp });
  } catch (error) {
    console.error('Update camp error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/camps/:id/upload-photo
// @desc    Upload photo for camp (admin only)
// @access  Private (Admin only)
router.post('/camps/:id/upload-photo', authenticateToken, requireAdmin, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { id } = req.params;
    const targetCamp = await db.findCamp({ _id: id });
    
    if (!targetCamp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Convert buffer to base64 for storage in mock database
    const base64Photo = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Add photo to camp's photos array
    const currentPhotos = targetCamp.photos || [];
    currentPhotos.push(base64Photo);

    // Update camp with new photo
    const updatedCamp = await db.updateCampById(id, { photos: currentPhotos });

    // Log the admin action
    const adminUser = await db.findUser({ _id: req.user._id });
    const actionLog = {
      action: 'camp_photo_uploaded',
      adminId: req.user._id,
      adminName: `${adminUser.firstName} ${adminUser.lastName}`,
      targetId: id,
      targetName: targetCamp.campName,
      changes: { photos: 'Photo uploaded' },
      timestamp: new Date().toISOString()
    };

    // Add action log to camp's history
    if (!updatedCamp.actionHistory) {
      updatedCamp.actionHistory = [];
    }
    updatedCamp.actionHistory.push(actionLog);
    await db.updateCampById(id, { actionHistory: updatedCamp.actionHistory });

    res.json({
      message: 'Camp photo uploaded successfully',
      photo: base64Photo,
      camp: updatedCamp
    });

  } catch (error) {
    console.error('Upload camp photo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/restore-camp-admin/:campId
// @desc    Restore admin features for a camp account (emergency fix endpoint)
// @access  Private (Can be called by the camp owner themselves)
router.post('/restore-camp-admin/:campId', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;
    
    console.log('🔄 [RESTORE ADMIN] Request from user:', req.user.email);
    console.log('🔄 [RESTORE ADMIN] Target camp ID:', campId);

    // Find the camp
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    console.log('✅ [RESTORE ADMIN] Found camp:', camp.name);
    console.log('📝 [RESTORE ADMIN] Camp owner ID:', camp.owner);

    // Security: Only allow the camp owner to restore their own admin status
    if (camp.owner.toString() !== req.user._id.toString()) {
      console.log('❌ [RESTORE ADMIN] Permission denied - user is not camp owner');
      return res.status(403).json({ message: 'Only the camp owner can restore admin status' });
    }

    // Find the owner user
    const owner = await db.findUser({ _id: camp.owner });
    if (!owner) {
      return res.status(404).json({ message: 'Camp owner user not found' });
    }

    console.log('👤 [RESTORE ADMIN] Current account type:', owner.accountType);
    console.log('👤 [RESTORE ADMIN] Current campId:', owner.campId);

    const changes = [];

    // Upgrade to admin account type if needed
    if (owner.accountType !== 'admin') {
      console.log('🔄 [RESTORE ADMIN] Upgrading account type to admin...');
      owner.accountType = 'admin';
      changes.push('Account type upgraded to admin');
    }

    // Ensure campId is set
    if (!owner.campId || owner.campId.toString() !== camp._id.toString()) {
      console.log('🔄 [RESTORE ADMIN] Setting campId...');
      owner.campId = camp._id;
      changes.push('campId set correctly');
    }

    // Save user changes
    if (changes.length > 0) {
      await db.updateUserById(owner._id, owner);
      console.log('✅ [RESTORE ADMIN] User updated successfully');
    }

    // Check/create Admin record
    let adminRecord = await db.findAdmin({ user: owner._id });
    
    if (!adminRecord) {
      console.log('🔄 [RESTORE ADMIN] Creating Admin record...');
      adminRecord = await db.createAdmin({
        user: owner._id,
        role: 'super-admin',
        permissions: {
          userManagement: true,
          campManagement: true,
          systemSettings: true,
          analytics: true,
          support: true
        },
        isActive: true,
        createdAt: new Date()
      });
      changes.push('Admin record created');
      console.log('✅ [RESTORE ADMIN] Admin record created');
    } else if (!adminRecord.isActive) {
      console.log('🔄 [RESTORE ADMIN] Activating Admin record...');
      adminRecord.isActive = true;
      await db.updateAdmin(adminRecord._id, adminRecord);
      changes.push('Admin record activated');
      console.log('✅ [RESTORE ADMIN] Admin record activated');
    }

    console.log('✅ [RESTORE ADMIN] Restoration complete!');
    
    res.json({
      success: true,
      message: 'Admin features restored successfully',
      changes: changes.length > 0 ? changes : ['No changes needed - already configured'],
      camp: {
        id: camp._id,
        name: camp.name
      },
      user: {
        id: owner._id,
        email: owner.email,
        accountType: owner.accountType,
        campId: owner.campId
      },
      adminRecord: {
        exists: !!adminRecord,
        active: adminRecord?.isActive
      }
    });

  } catch (error) {
    console.error('❌ [RESTORE ADMIN] Error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   DELETE /api/admin/camps/:id
// @desc    Delete camp by admin
// @access  Private (Admin only)
router.delete('/camps/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if camp exists
    const camp = await db.findCamp({ _id: id });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Log the admin action before deletion
    const adminUser = await db.findUser({ _id: req.user._id });
    console.log(`Admin ${adminUser.email} deleting camp: ${camp.name} (ID: ${id})`);

    // Delete the camp
    await db.deleteCamp(id);

    res.json({ 
      message: 'Camp deleted successfully',
      deletedCamp: {
        _id: camp._id,
        name: camp.name
      }
    });
  } catch (error) {
    console.error('Delete camp error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
