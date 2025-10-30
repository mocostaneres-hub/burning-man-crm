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

    // Calculate comprehensive stats
    const totalUsers = allUsers.length;
    const activeUsers = allUsers.filter(user => user.isActive).length;
    const inactiveUsers = totalUsers - activeUsers;
    const totalCamps = allCamps.length;
    const activeCamps = allCamps.filter(camp => camp.status === 'active').length;
    const totalMembers = allMembers.filter(member => member.status === 'active').length;
    const recruitingCamps = allCamps.filter(camp => camp.status === 'active' && camp.isRecruiting).length;
    
    // Account type breakdown
    const accountTypeStats = {
      personal: allUsers.filter(user => user.accountType === 'personal').length,
      camp: allUsers.filter(user => user.accountType === 'camp').length,
      admin: allUsers.filter(user => user.accountType === 'admin').length,
      unassigned: allUsers.filter(user => user.accountType === 'unassigned' || !user.accountType).length
    };
    
    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentUsers = allUsers
      .filter(user => new Date(user.createdAt) > thirtyDaysAgo)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(user => ({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        campName: user.campName,
        accountType: user.accountType,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }));
    
    const recentCamps = allCamps
      .filter(camp => new Date(camp.createdAt) > thirtyDaysAgo)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(camp => ({
        _id: camp._id,
        name: camp.name,
        status: camp.status,
        isRecruiting: camp.isRecruiting,
        memberCount: camp.memberCount || 0,
        createdAt: camp.createdAt,
        contactEmail: camp.contactEmail
      }));

    // User growth over time (last 12 months)
    const userGrowth = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      const monthUsers = allUsers.filter(user => {
        const userDate = new Date(user.createdAt);
        return userDate >= monthStart && userDate <= monthEnd;
      }).length;
      
      userGrowth.push({
        _id: { year: date.getFullYear(), month: date.getMonth() + 1 },
        count: monthUsers
      });
    }

    // Camp statistics by size
    const campStats = [
      { _id: 'small', count: allCamps.filter(camp => camp.campSize === 'small').length },
      { _id: 'medium', count: allCamps.filter(camp => camp.campSize === 'medium').length },
      { _id: 'large', count: allCamps.filter(camp => camp.campSize === 'large').length },
      { _id: 'mega', count: allCamps.filter(camp => camp.campSize === 'mega').length }
    ];

    // System health metrics
    const systemHealth = {
      totalAccounts: totalUsers,
      activeAccounts: activeUsers,
      inactiveAccounts: inactiveUsers,
      totalCamps: totalCamps,
      activeCamps: activeCamps,
      recruitingCamps: recruitingCamps,
      totalMembers: totalMembers,
      accountTypeBreakdown: accountTypeStats,
      recentActivity: {
        newUsers: recentUsers.length,
        newCamps: recentCamps.length
      }
    };

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        totalCamps,
        activeCamps,
        recruitingCamps,
        totalMembers,
        accountTypeStats,
        userGrowth,
        campStats
      },
      recent: {
        users: recentUsers,
        camps: recentCamps
      },
      systemHealth
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
    
    // Enrich camps with owner information and member count
    const enrichedCamps = await Promise.all(allCamps.map(async (camp) => {
      // Convert Mongoose document to plain object to avoid internal properties
      const campData = camp.toObject ? camp.toObject() : camp;
      
      let owner = null;
      if (campData.contactEmail) {
        owner = await db.findUser({ email: campData.contactEmail });
      }

      // Get actual member count from roster
      let memberCount = 0;
      try {
        const activeRoster = await db.findActiveRoster({ camp: campData._id });
        if (activeRoster && activeRoster.members) {
          memberCount = activeRoster.members.length;
        }
      } catch (rosterError) {
        console.warn(`Could not get roster for camp ${campData._id}:`, rosterError.message);
      }

      return {
        ...campData,
        memberCount, // Override with actual roster member count
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

    // Handle password reset if provided
    if (updateData.newPassword) {
      console.log('🔐 [Admin] Resetting password for user:', targetUser.email);
      
      try {
        // Use the User model directly to trigger password hashing
        const User = require('../models/User');
        const userDoc = await User.findById(targetUser._id);
        if (userDoc) {
          userDoc.password = updateData.newPassword; // Let the pre-save hook hash it
          await userDoc.save();
          console.log('✅ [Admin] User password updated successfully');
        } else {
          console.log('❌ [Admin] User document not found');
          return res.status(404).json({ message: 'User document not found' });
        }
      } catch (error) {
        console.error('❌ [Admin] Error updating user password:', error.message);
        return res.status(500).json({ message: 'Failed to update password', error: error.message });
      }
      
      // Remove password from update data to avoid storing it in user record
      delete updateData.newPassword;
    }

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
    let targetCamp = await db.findCamp({ _id: id });
    
    // If camp not found by ID, try to find by name if it's a known production camp
    if (!targetCamp) {
      console.log('🔍 [Admin] Camp not found by ID, checking for known production camps...');
      
      // Map of known production camp IDs to mock database names
      const productionCampMap = {
        '68e43fccedfdbb6a8a227f4d': 'Celestial Booties',
        // Add more mappings as needed
      };
      
      if (productionCampMap[id]) {
        targetCamp = await db.findCamp({ campName: productionCampMap[id] });
        if (targetCamp) {
          console.log('✅ [Admin] Found camp by name mapping:', targetCamp.campName);
        }
      }
    }
    
    if (!targetCamp) {
      console.log('❌ [Admin] Camp not found with ID:', id);
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Handle password reset if provided
    if (updateData.newPassword) {
      console.log('🔐 [Admin] Resetting camp account password for camp:', targetCamp.campName);
      
      // Find the camp admin user
      const campUser = await db.findUser({ campId: id, accountType: 'camp' });
      if (campUser) {
        try {
          // Use the User model directly to trigger password hashing
          const User = require('../models/User');
          const userDoc = await User.findById(campUser._id);
          if (userDoc) {
            userDoc.password = updateData.newPassword; // Let the pre-save hook hash it
            await userDoc.save();
            console.log('✅ [Admin] Camp account password updated successfully');
          } else {
            console.log('❌ [Admin] Camp user document not found');
            return res.status(404).json({ message: 'Camp user document not found' });
          }
        } catch (error) {
          console.error('❌ [Admin] Error updating camp password:', error.message);
          return res.status(500).json({ message: 'Failed to update password', error: error.message });
        }
      } else {
        console.log('⚠️ [Admin] No camp user found for this camp - skipping password reset');
        console.log('ℹ️ [Admin] Camp update will proceed without password reset');
      }
      
      // Remove password from update data to avoid storing it in camp record
      delete updateData.newPassword;
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

// @route   GET /api/admin/users/:id/history
// @desc    Get user action history and audit logs
// @access  Private (Admin only)
router.get('/users/:id/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await db.findUser({ _id: id });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get user's action history
    const actionHistory = user.actionHistory || [];
    
    // Get related activities (camp changes, member applications, etc.)
    const relatedActivities = [];
    
    // If user is a camp account, get camp-related activities
    if (user.accountType === 'camp' && user.campId) {
      const camp = await db.findCamp({ _id: user.campId });
      if (camp && camp.actionHistory) {
        relatedActivities.push(...camp.actionHistory.map(activity => ({
          ...activity,
          type: 'camp_activity'
        })));
      }
    }
    
    // Get member applications
    const memberApplications = await db.findMemberApplications({ applicant: id });
    relatedActivities.push(...memberApplications.map(app => ({
      action: 'member_application',
      targetId: app.camp,
      targetName: 'Camp Application',
      changes: { status: app.status },
      timestamp: app.appliedAt,
      type: 'application'
    })));
    
    // Combine and sort all activities
    const allActivities = [...actionHistory, ...relatedActivities]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        accountType: user.accountType,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      },
      activities: allActivities,
      totalActivities: allActivities.length
    });

  } catch (error) {
    console.error('Get user history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/camps/:id/history
// @desc    Get camp action history and audit logs
// @access  Private (Admin only)
router.get('/camps/:id/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const camp = await db.findCamp({ _id: id });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Get camp's action history
    const actionHistory = camp.actionHistory || [];
    
    // Get related activities (member changes, applications, etc.)
    const relatedActivities = [];
    
    // Get member roster changes
    const rosters = await db.findRosters({ camp: id });
    rosters.forEach(roster => {
      if (roster.actionHistory) {
        relatedActivities.push(...roster.actionHistory.map(activity => ({
          ...activity,
          type: 'roster_activity'
        })));
      }
    });
    
    // Get member applications for this camp
    const memberApplications = await db.findMemberApplications({ camp: id });
    relatedActivities.push(...memberApplications.map(app => ({
      action: 'member_application',
      targetId: app.applicant,
      targetName: 'Member Application',
      changes: { status: app.status },
      timestamp: app.appliedAt,
      type: 'application'
    })));
    
    // Combine and sort all activities
    const allActivities = [...actionHistory, ...relatedActivities]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      camp: {
        _id: camp._id,
        name: camp.name,
        status: camp.status,
        isRecruiting: camp.isRecruiting,
        memberCount: camp.memberCount || 0,
        createdAt: camp.createdAt,
        contactEmail: camp.contactEmail
      },
      activities: allActivities,
      totalActivities: allActivities.length
    });

  } catch (error) {
    console.error('Get camp history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/analytics
// @desc    Get comprehensive system analytics
// @access  Private (Admin only)
router.get('/analytics', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    const [
      allUsers,
      allCamps,
      allMembers,
      allApplications
    ] = await Promise.all([
      db.findUsers(),
      db.findCamps(),
      db.findMembers(),
      db.findMemberApplications()
    ]);

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // User analytics
    const newUsers = allUsers.filter(user => new Date(user.createdAt) > startDate);
    const activeUsers = allUsers.filter(user => user.isActive);
    const userRetention = {
      total: allUsers.length,
      active: activeUsers.length,
      retentionRate: allUsers.length > 0 ? (activeUsers.length / allUsers.length * 100).toFixed(2) : 0
    };

    // Camp analytics
    const newCamps = allCamps.filter(camp => new Date(camp.createdAt) > startDate);
    const recruitingCamps = allCamps.filter(camp => camp.isRecruiting);
    const campAnalytics = {
      total: allCamps.length,
      active: allCamps.filter(camp => camp.status === 'active').length,
      recruiting: recruitingCamps.length,
      new: newCamps.length
    };

    // Application analytics
    const newApplications = allApplications.filter(app => new Date(app.appliedAt) > startDate);
    const applicationStats = {
      total: allApplications.length,
      new: newApplications.length,
      pending: allApplications.filter(app => app.status === 'pending').length,
      approved: allApplications.filter(app => app.status === 'approved').length,
      rejected: allApplications.filter(app => app.status === 'rejected').length,
      approvalRate: allApplications.length > 0 ? 
        (allApplications.filter(app => app.status === 'approved').length / allApplications.length * 100).toFixed(2) : 0
    };

    // Account type distribution
    const accountTypeDistribution = {
      personal: allUsers.filter(user => user.accountType === 'personal').length,
      camp: allUsers.filter(user => user.accountType === 'camp').length,
      admin: allUsers.filter(user => user.accountType === 'admin').length,
      unassigned: allUsers.filter(user => user.accountType === 'unassigned' || !user.accountType).length
    };

    // Growth trends (daily for last 30 days)
    const growthTrends = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const dayUsers = allUsers.filter(user => {
        const userDate = new Date(user.createdAt);
        return userDate >= dayStart && userDate < dayEnd;
      }).length;
      
      const dayCamps = allCamps.filter(camp => {
        const campDate = new Date(camp.createdAt);
        return campDate >= dayStart && campDate < dayEnd;
      }).length;
      
      const dayApplications = allApplications.filter(app => {
        const appDate = new Date(app.appliedAt);
        return appDate >= dayStart && appDate < dayEnd;
      }).length;
      
      growthTrends.push({
        date: dayStart.toISOString().split('T')[0],
        users: dayUsers,
        camps: dayCamps,
        applications: dayApplications
      });
    }

    res.json({
      period,
      userAnalytics: userRetention,
      campAnalytics,
      applicationStats,
      accountTypeDistribution,
      growthTrends,
      summary: {
        totalAccounts: allUsers.length,
        totalCamps: allCamps.length,
        totalApplications: allApplications.length,
        newInPeriod: {
          users: newUsers.length,
          camps: newCamps.length,
          applications: newApplications.length
        }
      }
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/admin/users/bulk-action
// @desc    Perform bulk actions on users
// @access  Private (Admin only)
router.post('/users/bulk-action', authenticateToken, requireAdmin, [
  body('action').isIn(['activate', 'deactivate', 'delete', 'changeAccountType']),
  body('userIds').isArray().withMessage('User IDs must be an array'),
  body('accountType').optional().isIn(['personal', 'camp', 'admin']).withMessage('Invalid account type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { action, userIds, accountType } = req.body;
    const adminUser = await db.findUser({ _id: req.user._id });
    
    if (!adminUser) {
      return res.status(404).json({ message: 'Admin user not found' });
    }

    const results = [];
    const actionErrors = [];

    for (const userId of userIds) {
      try {
        const user = await db.findUser({ _id: userId });
        if (!user) {
          actionErrors.push({ userId, error: 'User not found' });
          continue;
        }

        let updateData = {};
        let actionDescription = '';

        switch (action) {
          case 'activate':
            updateData = { isActive: true };
            actionDescription = 'activated';
            break;
          case 'deactivate':
            updateData = { isActive: false };
            actionDescription = 'deactivated';
            break;
          case 'changeAccountType':
            if (!accountType) {
              actionErrors.push({ userId, error: 'Account type required' });
              continue;
            }
            updateData = { accountType };
            actionDescription = `account type changed to ${accountType}`;
            break;
          case 'delete':
            // Soft delete by deactivating
            updateData = { isActive: false, deletedAt: new Date() };
            actionDescription = 'deleted (soft)';
            break;
        }

        if (Object.keys(updateData).length > 0) {
          await db.updateUserById(userId, updateData);
          
          // Log the action
          const actionLog = {
            action: `bulk_${action}`,
            adminId: req.user._id,
            adminName: `${adminUser.firstName} ${adminUser.lastName}`,
            targetId: userId,
            targetName: `${user.firstName} ${user.lastName}`,
            changes: updateData,
            timestamp: new Date().toISOString()
          };

          // Add to user's action history
          const updatedUser = await db.findUser({ _id: userId });
          if (updatedUser) {
            if (!updatedUser.actionHistory) {
              updatedUser.actionHistory = [];
            }
            updatedUser.actionHistory.push(actionLog);
            await db.updateUserById(userId, { actionHistory: updatedUser.actionHistory });
          }

          results.push({
            userId,
            success: true,
            action: actionDescription
          });
        }
      } catch (error) {
        actionErrors.push({ userId, error: error.message });
      }
    }

    res.json({
      message: `Bulk action completed`,
      results,
      errors: actionErrors,
      summary: {
        total: userIds.length,
        successful: results.length,
        failed: actionErrors.length
      }
    });

  } catch (error) {
    console.error('Bulk action error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/admin/audit-logs
// @desc    Get system audit logs
// @access  Private (Admin only)
router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action, 
      adminId, 
      targetType,
      startDate,
      endDate 
    } = req.query;

    // Get all users and camps to collect action histories
    const [allUsers, allCamps] = await Promise.all([
      db.findUsers(),
      db.findCamps()
    ]);

    // Collect all action histories
    let allAuditLogs = [];
    
    // From users
    allUsers.forEach(user => {
      if (user.actionHistory) {
        allAuditLogs.push(...user.actionHistory.map(log => ({
          ...log,
          targetType: 'user',
          targetId: user._id
        })));
      }
    });
    
    // From camps
    allCamps.forEach(camp => {
      if (camp.actionHistory) {
        allAuditLogs.push(...camp.actionHistory.map(log => ({
          ...log,
          targetType: 'camp',
          targetId: camp._id
        })));
      }
    });

    // Apply filters
    let filteredLogs = allAuditLogs;

    if (action) {
      filteredLogs = filteredLogs.filter(log => log.action === action);
    }

    if (adminId) {
      filteredLogs = filteredLogs.filter(log => log.adminId === adminId);
    }

    if (targetType) {
      filteredLogs = filteredLogs.filter(log => log.targetType === targetType);
    }

    if (startDate) {
      const start = new Date(startDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= end);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    res.json({
      logs: paginatedLogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(filteredLogs.length / limit),
        totalLogs: filteredLogs.length,
        hasNext: endIndex < filteredLogs.length,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
