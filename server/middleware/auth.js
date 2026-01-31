const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const db = require('../database/databaseAdapter');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('🔐 Auth header:', authHeader);
    console.log('🔐 Extracted token:', token ? `${token.substring(0, 20)}...` : 'null');
    console.log('🔐 Token length:', token ? token.length : 0);

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔐 JWT decoded userId:', decoded.userId, 'type:', typeof decoded.userId);
    
    // Use userId as-is (works for both numeric IDs and MongoDB ObjectId strings)
    const userId = decoded.userId;
    const user = await db.findUser({ _id: userId });
    console.log('🔐 User found:', user ? `ID: ${user._id} (${typeof user._id})` : 'null');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account deactivated' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Check if user is admin
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if user has admin account type
    if (req.user.accountType === 'admin') {
      req.admin = { user: req.user._id, role: 'admin' };
      return next();
    }

    // Fallback: check for separate Admin collection
    const admin = await db.findAdmin({ user: req.user._id, isActive: true });
    
    if (!admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Check specific admin permissions
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    if (req.admin.role === 'super-admin' || req.admin.permissions[permission]) {
      return next();
    }

    return res.status(403).json({ message: `Permission '${permission}' required` });
  };
};

// Check if user is camp lead
const requireCampLead = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if user is admin (admins can access everything)
    const admin = await Admin.findOne({ user: req.user._id, isActive: true });
    if (admin) {
      req.admin = admin;
      return next();
    }

    // Check if user is camp lead
    const Member = require('../models/Member');
    const member = await Member.findOne({ 
      user: req.user._id, 
      role: 'camp-lead',
      status: 'active'
    }).populate('camp');

    if (!member) {
      return res.status(403).json({ message: 'Camp lead access required' });
    }

    req.member = member;
    next();
  } catch (error) {
    console.error('Camp lead middleware error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Check if user is project lead or higher
const requireProjectLead = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if user is admin (admins can access everything)
    const admin = await Admin.findOne({ user: req.user._id, isActive: true });
    if (admin) {
      req.admin = admin;
      return next();
    }

    // Check if user is camp lead or project lead
    const Member = require('../models/Member');
    const member = await Member.findOne({ 
      user: req.user._id, 
      role: { $in: ['camp-lead', 'project-lead'] },
      status: 'active'
    }).populate('camp');

    if (!member) {
      return res.status(403).json({ message: 'Project lead or higher access required' });
    }

    req.member = member;
    next();
  } catch (error) {
    console.error('Project lead middleware error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Check if user is member of specific camp
const requireCampMember = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const campId = req.params.campId || req.body.campId;
    if (!campId) {
      return res.status(400).json({ message: 'Camp ID required' });
    }

    // Check if user is admin (admins can access everything)
    const admin = await Admin.findOne({ user: req.user._id, isActive: true });
    if (admin) {
      req.admin = admin;
      return next();
    }

    // Check if user is member of the camp
    const Member = require('../models/Member');
    const member = await Member.findOne({ 
      user: req.user._id, 
      camp: campId,
      status: 'active'
    }).populate('camp');

    if (!member) {
      return res.status(403).json({ message: 'Camp membership required' });
    }

    req.member = member;
    next();
  } catch (error) {
    console.error('Camp member middleware error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Check if user can access camp (camp account OR Camp Admin OR Camp Lead)
// Camp Admin = any authenticated user with camp-lead role for the camp (does NOT require roster membership)
// Camp Lead = roster member with isCampLead=true and status='approved'
// This matches the authorization used for camp profile editing (PUT /api/camps/:id)
const requireCampAccount = async (req, res, next) => {
  try {
    console.log('🔍 [requireCampAccount] Middleware started');
    console.log('   User ID:', req.user?._id, 'Account Type:', req.user?.accountType);
    
    if (!req.user) {
      console.error('❌ [requireCampAccount] No user in request');
      return res.status(401).json({ message: 'Authentication required' });
    }

    const campId = req.params.campId || req.body.campId;
    if (!campId) {
      console.error('❌ [requireCampAccount] No campId in request');
      return res.status(400).json({ message: 'Camp ID required' });
    }
    
    console.log('🔍 [requireCampAccount] Target campId:', campId);
    
    // Validate campId format for MongoDB
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(campId)) {
      console.error('❌ [requireCampAccount] Invalid campId format:', campId);
      return res.status(400).json({ message: 'Invalid camp ID format' });
    }

    // Check if user is system admin (admins can access everything)
    console.log('🔍 [requireCampAccount] Checking system admin...');
    const admin = await Admin.findOne({ user: req.user._id, isActive: true });
    if (admin) {
      req.admin = admin;
      console.log('✅ [requireCampAccount] System admin authorized:', req.user._id);
      return next();
    }
    console.log('   Not a system admin');

    // Check if user is camp account uploading for themselves
    console.log('🔍 [requireCampAccount] Checking camp ownership...');
    const { canAccessCamp, isCampLeadForCamp } = require('../utils/permissionHelpers');
    const isCampOwner = await canAccessCamp(req, campId);
    if (isCampOwner) {
      console.log('✅ [requireCampAccount] Camp account authorized:', req.user._id);
      return next();
    }
    console.log('   Not camp owner');

    // Check if user is Camp Lead (roster member with delegated admin permissions)
    console.log('🔍 [requireCampAccount] Checking Camp Lead status...');
    const isCampLead = await isCampLeadForCamp(req, campId);
    if (isCampLead) {
      console.log('✅ [requireCampAccount] Camp Lead authorized:', req.user._id);
      return next();
    }
    console.log('   Not Camp Lead');

    // Check if user is Camp Admin (has camp-lead role for this camp)
    // IMPORTANT: This does NOT require active roster membership - any Member record with camp-lead role grants access
    console.log('🔍 [requireCampAccount] Checking Camp Admin status...');
    const db = require('../database/databaseAdapter');
    
    const campLead = await db.findMember({ 
      user: req.user._id, 
      camp: campId, 
      role: 'camp-lead'
    });
    
    if (campLead) {
      console.log('✅ [requireCampAccount] Camp Admin (camp-lead role) authorized:', req.user._id);
      req.member = campLead;
      return next();
    }

    console.log('❌ [requireCampAccount] Access denied - not camp account, system admin, Camp Lead, or Camp Admin');
    console.log('   User ID:', req.user._id, 'Account Type:', req.user.accountType, 'Target Camp:', campId);
    
    return res.status(403).json({ message: 'Access denied. You must be the camp account, Camp Lead, or Camp Admin for this camp.' });
  } catch (error) {
    console.error('❌ [requireCampAccount] Middleware error:', error.message);
    console.error('❌ [requireCampAccount] Stack:', error.stack);
    
    // Handle specific error types
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid camp ID format' });
    }
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      return res.status(503).json({ message: 'Database temporarily unavailable' });
    }
    
    return res.status(500).json({ 
      message: 'Server error during authorization',
      ...(process.env.NODE_ENV !== 'production' && { error: error.message })
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (user && user.isActive) {
          req.user = user;
          console.log('✅ [optionalAuth] Authenticated user:', user.email);
        } else {
          console.log('⚠️ [optionalAuth] User not found or inactive, continuing without auth');
        }
      } catch (tokenError) {
        // Token is invalid/expired - continue without authentication
        console.log('⚠️ [optionalAuth] Token invalid/expired, continuing without auth:', tokenError.message);
      }
    } else {
      console.log('ℹ️ [optionalAuth] No token provided, continuing without auth');
    }

    next();
  } catch (error) {
    // Continue without authentication on any error
    console.log('⚠️ [optionalAuth] Error in middleware, continuing without auth:', error.message);
    next();
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requirePermission,
  requireCampLead,
  requireProjectLead,
  requireCampMember,
  requireCampAccount,
  optionalAuth
};
