/**
 * Diagnostic API Endpoints
 * Used by system admins to investigate account issues
 */

const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Camp = require('../models/Camp');
const MemberApplication = require('../models/MemberApplication');
const Roster = require('../models/Roster');
const ActivityLog = require('../models/ActivityLog');

const router = express.Router();

// @route   GET /api/diagnostic/account/:idOrEmail
// @desc    Comprehensive account diagnostic
// @access  Private (Admin only)
router.get('/account/:idOrEmail', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { idOrEmail } = req.params;
    
    const report = {
      searchTerm: idOrEmail,
      timestamp: new Date(),
      findings: {},
      issues: [],
      recommendations: []
    };

    // Search for user by ID
    let userById = null;
    try {
      userById = await User.findById(idOrEmail);
      if (userById) {
        report.findings.userById = {
          found: true,
          _id: userById._id,
          email: userById.email,
          accountType: userById.accountType,
          firstName: userById.firstName,
          lastName: userById.lastName,
          campName: userById.campName,
          campId: userById.campId,
          isActive: userById.isActive,
          autoCreated: userById.autoCreated || false,
          createdAt: userById.createdAt,
          updatedAt: userById.updatedAt
        };
      }
    } catch (err) {
      // Invalid ObjectId format, skip
      report.findings.userById = { found: false, error: 'Invalid ID format' };
    }

    // Search for user by email
    const userByEmail = await User.findOne({ 
      email: { $regex: new RegExp(`^${idOrEmail}$`, 'i') } 
    });
    
    if (userByEmail) {
      report.findings.userByEmail = {
        found: true,
        _id: userByEmail._id,
        email: userByEmail.email,
        accountType: userByEmail.accountType,
        firstName: userByEmail.firstName,
        lastName: userByEmail.lastName,
        campName: userByEmail.campName,
        campId: userByEmail.campId,
        isActive: userByEmail.isActive,
        autoCreated: userByEmail.autoCreated || false,
        hasPassword: !!userByEmail.password,
        createdAt: userByEmail.createdAt
      };
    } else {
      report.findings.userByEmail = { found: false };
    }

    // Use whichever user we found
    const user = userById || userByEmail;

    // Search for camp by contactEmail
    const campByEmail = await Camp.findOne({ 
      contactEmail: { $regex: new RegExp(`^${idOrEmail}$`, 'i') } 
    });
    
    if (campByEmail) {
      report.findings.campByContactEmail = {
        found: true,
        _id: campByEmail._id,
        name: campByEmail.name,
        slug: campByEmail.slug,
        contactEmail: campByEmail.contactEmail,
        owner: campByEmail.owner,
        status: campByEmail.status,
        isPublic: campByEmail.isPublic,
        isPubliclyVisible: campByEmail.isPubliclyVisible,
        createdAt: campByEmail.createdAt
      };

      // Check owner validity
      if (!campByEmail.owner) {
        report.issues.push({
          severity: 'CRITICAL',
          issue: 'Camp has NO OWNER field',
          impact: 'Will cause "server error" and impersonation failures',
          affected: `Camp ${campByEmail._id}`
        });
        report.recommendations.push({
          action: 'Set camp owner',
          command: `Camp.findByIdAndUpdate('${campByEmail._id}', { owner: '${user?._id || '<user_id>'}' })`,
          automated: 'Will be fixed on next server restart by auto-repair script'
        });
      } else {
        // Check if owner user exists
        const ownerUser = await User.findById(campByEmail.owner);
        if (!ownerUser) {
          report.issues.push({
            severity: 'CRITICAL',
            issue: 'Camp owner field points to non-existent user',
            impact: 'Owner ID is invalid',
            affected: `Camp ${campByEmail._id}, owner ${campByEmail.owner}`
          });
          report.recommendations.push({
            action: 'Update camp owner to valid user',
            command: user ? `Camp.findByIdAndUpdate('${campByEmail._id}', { owner: '${user._id}' })` : 'Create user first',
            automated: 'Will be fixed on next server restart if user exists with contactEmail'
          });
        } else {
          report.findings.campOwner = {
            found: true,
            _id: ownerUser._id,
            email: ownerUser.email,
            accountType: ownerUser.accountType,
            isActive: ownerUser.isActive
          };
        }
      }
    } else {
      report.findings.campByContactEmail = { found: false };
    }

    // Search for camp by user's campId
    if (user && user.campId) {
      const campById = await Camp.findById(user.campId);
      if (campById) {
        report.findings.campByUserCampId = {
          found: true,
          _id: campById._id,
          name: campById.name,
          owner: campById.owner,
          contactEmail: campById.contactEmail
        };
      } else {
        report.findings.campByUserCampId = { found: false };
        report.issues.push({
          severity: 'ERROR',
          issue: 'User has campId but camp doesn\'t exist',
          impact: 'Broken user.campId reference',
          affected: `User ${user._id}, campId ${user.campId}`
        });
        report.recommendations.push({
          action: 'Clear invalid campId from user',
          command: `User.findByIdAndUpdate('${user._id}', { $unset: { campId: 1 } })`
        });
      }
    }

    // Check for inactive account
    if (user && !user.isActive) {
      report.issues.push({
        severity: 'WARNING',
        issue: 'User account is deactivated',
        impact: 'Cannot login or be impersonated',
        affected: `User ${user._id}`
      });
      report.recommendations.push({
        action: 'Activate user account',
        command: `User.findByIdAndUpdate('${user._id}', { isActive: true })`
      });
    }

    // Check applications
    if (user) {
      const applications = await MemberApplication.find({
        $or: [{ applicant: user._id }, { camp: user.campId }]
      }).countDocuments();
      
      report.findings.applicationsCount = applications;
    }

    // Summary
    report.summary = {
      hasUser: !!user,
      hasCamp: !!campByEmail,
      ownerLinkValid: campByEmail?.owner && !!report.findings.campOwner?.found,
      totalIssues: report.issues.length,
      canBeFixed: report.recommendations.some(r => r.automated)
    };

    res.json(report);

  } catch (error) {
    console.error('Diagnostic error:', error);
    res.status(500).json({ 
      message: 'Diagnostic failed', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;

