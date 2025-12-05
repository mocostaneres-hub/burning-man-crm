#!/usr/bin/env node

/**
 * Diagnostic Script for Account Investigation
 * ID: 6903379660596ef9579eb0c5
 * Email: Raf.kuhn@gmail.com
 */

const mongoose = require('mongoose');
const User = require('./server/models/User');
const Camp = require('./server/models/Camp');
const MemberApplication = require('./server/models/MemberApplication');
const Roster = require('./server/models/Roster');
const ActivityLog = require('./server/models/ActivityLog');
require('dotenv').config();

async function diagnoseAccount() {
  try {
    console.log('🔍 ACCOUNT DIAGNOSTIC REPORT');
    console.log('=' .repeat(80));
    console.log(`Target ID: 6903379660596ef9579eb0c5`);
    console.log(`Target Email: Raf.kuhn@gmail.com`);
    console.log('=' .repeat(80));
    console.log('');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // SECTION 1: Search for User by ID
    console.log('1️⃣  SEARCHING FOR USER BY ID');
    console.log('-'.repeat(80));
    const userById = await User.findById('6903379660596ef9579eb0c5');
    if (userById) {
      console.log('✅ User found by ID:');
      console.log(JSON.stringify({
        _id: userById._id,
        email: userById.email,
        accountType: userById.accountType,
        firstName: userById.firstName,
        lastName: userById.lastName,
        campName: userById.campName,
        campId: userById.campId,
        isActive: userById.isActive,
        createdAt: userById.createdAt,
        updatedAt: userById.updatedAt
      }, null, 2));
    } else {
      console.log('❌ No user found with ID: 6903379660596ef9579eb0c5');
    }
    console.log('');

    // SECTION 2: Search for User by Email
    console.log('2️⃣  SEARCHING FOR USER BY EMAIL');
    console.log('-'.repeat(80));
    const userByEmail = await User.findOne({ email: 'Raf.kuhn@gmail.com' });
    if (userByEmail) {
      console.log('✅ User found by email:');
      console.log(JSON.stringify({
        _id: userByEmail._id,
        email: userByEmail.email,
        accountType: userByEmail.accountType,
        firstName: userByEmail.firstName,
        lastName: userByEmail.lastName,
        campName: userByEmail.campName,
        campId: userByEmail.campId,
        isActive: userByEmail.isActive,
        createdAt: userByEmail.createdAt,
        updatedAt: userByEmail.updatedAt,
        password: userByEmail.password ? '*** (exists)' : '(missing)',
        autoCreated: userByEmail.autoCreated || false
      }, null, 2));
    } else {
      console.log('❌ No user found with email: Raf.kuhn@gmail.com');
    }
    console.log('');

    // SECTION 3: Search for Camp by contactEmail
    console.log('3️⃣  SEARCHING FOR CAMP BY CONTACT EMAIL');
    console.log('-'.repeat(80));
    const campByEmail = await Camp.findOne({ contactEmail: 'Raf.kuhn@gmail.com' });
    if (campByEmail) {
      console.log('✅ Camp found by contactEmail:');
      console.log(JSON.stringify({
        _id: campByEmail._id,
        name: campByEmail.name,
        slug: campByEmail.slug,
        contactEmail: campByEmail.contactEmail,
        owner: campByEmail.owner,
        status: campByEmail.status,
        isPublic: campByEmail.isPublic,
        isPubliclyVisible: campByEmail.isPubliclyVisible,
        createdAt: campByEmail.createdAt,
        updatedAt: campByEmail.updatedAt
      }, null, 2));
      
      // Check if owner exists
      if (campByEmail.owner) {
        const owner = await User.findById(campByEmail.owner);
        if (owner) {
          console.log('\n  ✅ Camp owner user exists:');
          console.log(`     Owner ID: ${owner._id}`);
          console.log(`     Owner Email: ${owner.email}`);
          console.log(`     Owner Account Type: ${owner.accountType}`);
        } else {
          console.log('\n  ❌ Camp owner user NOT FOUND!');
          console.log(`     Owner ID in camp: ${campByEmail.owner}`);
          console.log('     🚨 CRITICAL ISSUE: Camp has invalid owner reference');
        }
      } else {
        console.log('\n  ❌ Camp has NO OWNER field!');
        console.log('     🚨 CRITICAL ISSUE: This will cause "server error" and impersonation failures');
      }
    } else {
      console.log('❌ No camp found with contactEmail: Raf.kuhn@gmail.com');
    }
    console.log('');

    // SECTION 4: Search for Camp by ID (if user has campId)
    if (userByEmail && userByEmail.campId) {
      console.log('4️⃣  SEARCHING FOR CAMP BY USER\'S CAMPID');
      console.log('-'.repeat(80));
      const campById = await Camp.findById(userByEmail.campId);
      if (campById) {
        console.log('✅ Camp found by user.campId:');
        console.log(JSON.stringify({
          _id: campById._id,
          name: campById.name,
          slug: campById.slug,
          contactEmail: campById.contactEmail,
          owner: campById.owner,
          status: campById.status
        }, null, 2));
      } else {
        console.log('❌ No camp found with ID:', userByEmail.campId);
        console.log('   🚨 ISSUE: User has campId but camp doesn\'t exist');
      }
      console.log('');
    }

    // SECTION 5: Search Applications
    console.log('5️⃣  SEARCHING FOR APPLICATIONS');
    console.log('-'.repeat(80));
    const applications = await MemberApplication.find({
      $or: [
        { 'applicant': userById?._id || userByEmail?._id },
        { camp: campByEmail?._id }
      ]
    }).populate('applicant').populate('camp');
    
    if (applications.length > 0) {
      console.log(`✅ Found ${applications.length} application(s):`);
      applications.forEach((app, i) => {
        console.log(`\n  Application ${i + 1}:`);
        console.log(`    ID: ${app._id}`);
        console.log(`    Status: ${app.status}`);
        console.log(`    Applicant: ${app.applicant?.email || 'N/A'}`);
        console.log(`    Camp: ${app.camp?.name || 'N/A'}`);
        console.log(`    Created: ${app.createdAt}`);
      });
    } else {
      console.log('ℹ️  No applications found');
    }
    console.log('');

    // SECTION 6: Search Rosters
    console.log('6️⃣  SEARCHING FOR ROSTER ENTRIES');
    console.log('-'.repeat(80));
    if (campByEmail || userByEmail?.campId) {
      const campIdToSearch = campByEmail?._id || userByEmail?.campId;
      const rosters = await Roster.find({ camp: campIdToSearch });
      
      if (rosters.length > 0) {
        console.log(`✅ Found ${rosters.length} roster(s) for this camp:`);
        rosters.forEach((roster, i) => {
          console.log(`\n  Roster ${i + 1}:`);
          console.log(`    ID: ${roster._id}`);
          console.log(`    Status: ${roster.status}`);
          console.log(`    Members: ${roster.members?.length || 0}`);
        });
      } else {
        console.log('ℹ️  No rosters found for this camp');
      }
    } else {
      console.log('⚠️  No camp ID available to search rosters');
    }
    console.log('');

    // SECTION 7: Check Activity Logs
    console.log('7️⃣  CHECKING ACTIVITY LOGS');
    console.log('-'.repeat(80));
    const activityLogs = await ActivityLog.find({
      $or: [
        { entityId: userById?._id || userByEmail?._id },
        { entityId: campByEmail?._id },
        { actingUserId: userById?._id || userByEmail?._id }
      ]
    }).sort({ timestamp: -1 }).limit(10);
    
    if (activityLogs.length > 0) {
      console.log(`✅ Found ${activityLogs.length} recent activity log entries:`);
      activityLogs.forEach((log, i) => {
        console.log(`\n  Activity ${i + 1}:`);
        console.log(`    Type: ${log.activityType}`);
        console.log(`    Entity: ${log.entityType} (${log.entityId})`);
        console.log(`    Timestamp: ${log.timestamp}`);
        if (log.details) {
          console.log(`    Details: ${JSON.stringify(log.details).substring(0, 100)}...`);
        }
      });
    } else {
      console.log('ℹ️  No activity logs found');
    }
    console.log('');

    // SECTION 8: ISSUE SUMMARY AND RECOMMENDATIONS
    console.log('=' .repeat(80));
    console.log('📋 ISSUE SUMMARY');
    console.log('=' .repeat(80));
    
    const issues = [];
    const recommendations = [];

    // Check for critical issues
    if (!userById && !userByEmail) {
      issues.push('🚨 CRITICAL: No user account found with ID or email');
      recommendations.push('1. Create user account manually or check if email is slightly different');
    }

    if (campByEmail && !campByEmail.owner) {
      issues.push('🚨 CRITICAL: Camp exists but has NO OWNER field');
      recommendations.push('2. Run auto-repair on next server restart OR manually set camp.owner');
      recommendations.push('   Command: Camp.findByIdAndUpdate("' + campByEmail._id + '", { owner: "<user_id>" })');
    }

    if (campByEmail && campByEmail.owner) {
      const owner = await User.findById(campByEmail.owner);
      if (!owner) {
        issues.push('🚨 CRITICAL: Camp owner field points to non-existent user');
        recommendations.push('3. Create missing owner user OR update camp.owner to correct user ID');
      }
    }

    if (userByEmail && userByEmail.accountType === 'camp' && !userByEmail.campId) {
      issues.push('⚠️  WARNING: Camp user has no campId field set');
      recommendations.push('4. Update user.campId to link to their camp');
    }

    if (!userByEmail?.isActive) {
      issues.push('⚠️  WARNING: User account is deactivated');
      recommendations.push('5. Activate user account: User.findByIdAndUpdate("<id>", { isActive: true })');
    }

    if (issues.length === 0) {
      console.log('✅ No critical issues detected');
    } else {
      console.log('Issues found:\n');
      issues.forEach(issue => console.log(`  ${issue}`));
    }

    console.log('\n' + '=' .repeat(80));
    console.log('💡 RECOMMENDATIONS');
    console.log('=' .repeat(80));
    
    if (recommendations.length === 0) {
      console.log('✅ No actions required');
    } else {
      console.log('');
      recommendations.forEach(rec => console.log(rec));
    }

    console.log('\n' + '=' .repeat(80));
    console.log('🔧 QUICK FIX COMMANDS');
    console.log('=' .repeat(80));
    
    if (campByEmail && !campByEmail.owner && userByEmail) {
      console.log('\nTo fix missing owner:');
      console.log(`  node -e "require('./server/models/Camp').findByIdAndUpdate('${campByEmail._id}', { owner: '${userByEmail._id}' }).exec().then(() => console.log('Fixed')).catch(console.error)"`);
    }

    if (userByEmail && campByEmail && userByEmail.accountType === 'camp' && !userByEmail.campId) {
      console.log('\nTo link user to camp:');
      console.log(`  node -e "require('./server/models/User').findByIdAndUpdate('${userByEmail._id}', { campId: '${campByEmail._id}' }).exec().then(() => console.log('Fixed')).catch(console.error)"`);
    }

    console.log('\n');
    await mongoose.disconnect();
    console.log('✅ Diagnostic complete\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the diagnostic
diagnoseAccount();

