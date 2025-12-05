#!/usr/bin/env node

/**
 * Complete Account Deletion Script
 * Email: Raf.kuhn@gmail.com
 * ID: 6903379660596ef9579eb0c5
 * 
 * WARNING: This permanently deletes the account and ALL associated data
 * Run this on Railway to delete the account in production
 */

const mongoose = require('mongoose');
const User = require('./server/models/User');
const Camp = require('./server/models/Camp');
const MemberApplication = require('./server/models/MemberApplication');
const Roster = require('./server/models/Roster');
const ActivityLog = require('./server/models/ActivityLog');
const Invite = require('./server/models/Invite');
const Task = require('./server/models/Task');
require('dotenv').config();

async function deleteAccount() {
  try {
    console.log('\n🗑️  COMPLETE ACCOUNT DELETION');
    console.log('=' .repeat(80));
    console.log('⚠️  WARNING: This will PERMANENTLY DELETE all data!');
    console.log('Target Email: Raf.kuhn@gmail.com');
    console.log('Target ID: 6903379660596ef9579eb0c5');
    console.log('=' .repeat(80) + '\n');

    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = 'Raf.kuhn@gmail.com';
    const userId = '6903379660596ef9579eb0c5';
    
    let deletionSummary = {
      users: 0,
      camps: 0,
      applications: 0,
      rosters: 0,
      rosterMembers: 0,
      activityLogs: 0,
      invites: 0,
      tasks: 0
    };

    // STEP 1: Find and delete user(s)
    console.log('STEP 1: Finding and deleting user account(s)...');
    console.log('-'.repeat(80));
    
    // Try to find by ID first
    let user = await User.findById(userId);
    if (user) {
      console.log(`  ✅ Found user by ID: ${user._id}`);
      console.log(`     Email: ${user.email}`);
      console.log(`     Account Type: ${user.accountType}`);
      console.log(`     Camp ID: ${user.campId || 'none'}`);
    }
    
    // Also check by email (case-insensitive)
    const usersByEmail = await User.find({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    });
    
    console.log(`  📊 Found ${usersByEmail.length} user(s) with email: ${email}\n`);
    
    const allUsers = new Set();
    if (user) allUsers.add(user._id.toString());
    usersByEmail.forEach(u => allUsers.add(u._id.toString()));
    
    const userIds = Array.from(allUsers);
    const campIds = new Set();
    
    // Collect camp IDs before deletion
    for (const uid of userIds) {
      const u = await User.findById(uid);
      if (u && u.campId) {
        campIds.add(u.campId.toString());
      }
    }

    // STEP 2: Find camps by contactEmail or owner
    console.log('STEP 2: Finding associated camps...');
    console.log('-'.repeat(80));
    
    const campsByEmail = await Camp.find({ 
      contactEmail: { $regex: new RegExp(`^${email}$`, 'i') } 
    });
    
    const campsByOwner = await Camp.find({ 
      owner: { $in: userIds } 
    });
    
    campsByEmail.forEach(c => campIds.add(c._id.toString()));
    campsByOwner.forEach(c => campIds.add(c._id.toString()));
    
    console.log(`  📊 Found ${campIds.size} camp(s) associated with this account\n`);
    
    campIds.forEach((cid, i) => {
      const camp = [...campsByEmail, ...campsByOwner].find(c => c._id.toString() === cid);
      if (camp) {
        console.log(`     Camp ${i + 1}: ${camp.name} (${camp._id})`);
      }
    });
    console.log('');

    // STEP 3: Delete applications
    console.log('STEP 3: Deleting applications...');
    console.log('-'.repeat(80));
    
    const applicationsResult = await MemberApplication.deleteMany({
      $or: [
        { applicant: { $in: userIds } },
        { camp: { $in: Array.from(campIds) } }
      ]
    });
    
    deletionSummary.applications = applicationsResult.deletedCount;
    console.log(`  ✅ Deleted ${applicationsResult.deletedCount} application(s)\n`);

    // STEP 4: Delete/update rosters
    console.log('STEP 4: Cleaning up rosters...');
    console.log('-'.repeat(80));
    
    // Find rosters for these camps
    const rosters = await Roster.find({ 
      camp: { $in: Array.from(campIds) } 
    });
    
    let removedMembers = 0;
    
    for (const roster of rosters) {
      // Remove members that reference these users
      const originalMemberCount = roster.members.length;
      roster.members = roster.members.filter(m => 
        !userIds.includes(m.member?.toString()) && 
        !userIds.includes(m.user?.toString())
      );
      
      const membersRemoved = originalMemberCount - roster.members.length;
      removedMembers += membersRemoved;
      
      if (membersRemoved > 0) {
        await roster.save();
        console.log(`  🧹 Removed ${membersRemoved} member(s) from roster ${roster._id}`);
      }
    }
    
    // Delete empty rosters or rosters belonging to camps being deleted
    const rostersDeleted = await Roster.deleteMany({
      $or: [
        { camp: { $in: Array.from(campIds) } },
        { members: { $size: 0 } }
      ]
    });
    
    deletionSummary.rosters = rostersDeleted.deletedCount;
    deletionSummary.rosterMembers = removedMembers;
    console.log(`  ✅ Deleted ${rostersDeleted.deletedCount} roster(s)`);
    console.log(`  ✅ Removed ${removedMembers} member reference(s)\n`);

    // STEP 5: Delete invites
    console.log('STEP 5: Deleting invites...');
    console.log('-'.repeat(80));
    
    const invitesResult = await Invite.deleteMany({
      $or: [
        { camp: { $in: Array.from(campIds) } },
        { invitedBy: { $in: userIds } },
        { appliedBy: { $in: userIds } },
        { email: { $regex: new RegExp(`^${email}$`, 'i') } }
      ]
    });
    
    deletionSummary.invites = invitesResult.deletedCount;
    console.log(`  ✅ Deleted ${invitesResult.deletedCount} invite(s)\n`);

    // STEP 6: Delete tasks
    console.log('STEP 6: Deleting tasks...');
    console.log('-'.repeat(80));
    
    const tasksResult = await Task.deleteMany({
      $or: [
        { camp: { $in: Array.from(campIds) } },
        { createdBy: { $in: userIds } },
        { 'assignments.user': { $in: userIds } }
      ]
    });
    
    deletionSummary.tasks = tasksResult.deletedCount;
    console.log(`  ✅ Deleted ${tasksResult.deletedCount} task(s)\n`);

    // STEP 7: Delete activity logs
    console.log('STEP 7: Deleting activity logs...');
    console.log('-'.repeat(80));
    
    const activityLogsResult = await ActivityLog.deleteMany({
      $or: [
        { entityType: 'MEMBER', entityId: { $in: userIds } },
        { entityType: 'CAMP', entityId: { $in: Array.from(campIds) } },
        { actingUserId: { $in: userIds } }
      ]
    });
    
    deletionSummary.activityLogs = activityLogsResult.deletedCount;
    console.log(`  ✅ Deleted ${activityLogsResult.deletedCount} activity log(s)\n`);

    // STEP 8: Delete camps
    console.log('STEP 8: Deleting camps...');
    console.log('-'.repeat(80));
    
    if (campIds.size > 0) {
      const campsResult = await Camp.deleteMany({
        _id: { $in: Array.from(campIds) }
      });
      
      deletionSummary.camps = campsResult.deletedCount;
      console.log(`  ✅ Deleted ${campsResult.deletedCount} camp(s)\n`);
    } else {
      console.log(`  ℹ️  No camps to delete\n`);
    }

    // STEP 9: Delete users (final step)
    console.log('STEP 9: Deleting user account(s)...');
    console.log('-'.repeat(80));
    
    const usersResult = await User.deleteMany({
      _id: { $in: userIds }
    });
    
    deletionSummary.users = usersResult.deletedCount;
    console.log(`  ✅ Deleted ${usersResult.deletedCount} user(s)\n`);

    // SUMMARY
    console.log('=' .repeat(80));
    console.log('✅ DELETION COMPLETE');
    console.log('=' .repeat(80));
    console.log('');
    console.log('📊 Deletion Summary:');
    console.log(`   Users deleted:           ${deletionSummary.users}`);
    console.log(`   Camps deleted:           ${deletionSummary.camps}`);
    console.log(`   Applications deleted:    ${deletionSummary.applications}`);
    console.log(`   Rosters deleted:         ${deletionSummary.rosters}`);
    console.log(`   Roster members removed:  ${deletionSummary.rosterMembers}`);
    console.log(`   Invites deleted:         ${deletionSummary.invites}`);
    console.log(`   Tasks deleted:           ${deletionSummary.tasks}`);
    console.log(`   Activity logs deleted:   ${deletionSummary.activityLogs}`);
    console.log('');
    console.log('✅ Email "Raf.kuhn@gmail.com" is now available for new registration');
    console.log('✅ User can sign up fresh at: https://www.g8road.com/register');
    console.log('');
    console.log('=' .repeat(80) + '\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR during deletion:', error);
    console.error('Stack:', error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Confirmation check
console.log('\n⚠️  WARNING: You are about to PERMANENTLY DELETE an account and ALL associated data!');
console.log('Email: Raf.kuhn@gmail.com');
console.log('ID: 6903379660596ef9579eb0c5');
console.log('\nThis will delete:');
console.log('  - User account(s)');
console.log('  - Camp(s)');
console.log('  - Applications');
console.log('  - Rosters and member entries');
console.log('  - Invites');
console.log('  - Tasks');
console.log('  - Activity logs');
console.log('\nThis action CANNOT be undone!\n');

// Run the deletion
setTimeout(() => {
  console.log('🚀 Starting deletion in 2 seconds...\n');
  setTimeout(deleteAccount, 2000);
}, 1000);

