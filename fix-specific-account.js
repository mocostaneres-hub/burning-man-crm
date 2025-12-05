#!/usr/bin/env node

/**
 * Fix Script for Specific Account
 * ID: 6903379660596ef9579eb0c5
 * Email: Raf.kuhn@gmail.com
 * 
 * Run this on Railway to fix the account in production
 */

const mongoose = require('mongoose');
const User = require('./server/models/User');
const Camp = require('./server/models/Camp');
const bcrypt = require('bcryptjs');
const { recordActivity } = require('./server/services/activityLogger');
require('dotenv').config();

async function fixAccount() {
  try {
    console.log('\n🔧 ACCOUNT FIX SCRIPT');
    console.log('=' .repeat(80));
    console.log('Target ID: 6903379660596ef9579eb0c5');
    console.log('Target Email: Raf.kuhn@gmail.com');
    console.log('=' .repeat(80) + '\n');

    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // STEP 1: Find user by ID
    console.log('STEP 1: Searching for user by ID...');
    let user = await User.findById('6903379660596ef9579eb0c5');
    
    if (!user) {
      console.log('  ❌ User not found by ID');
      
      // STEP 2: Try to find by email
      console.log('\nSTEP 2: Searching for user by email...');
      user = await User.findOne({ email: /^Raf\.kuhn@gmail\.com$/i });
      
      if (!user) {
        console.log('  ❌ User not found by email either');
        console.log('\n⚠️  CREATING NEW USER...');
        
        // Create the user
        const randomPassword = require('crypto').randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);
        
        user = await User.create({
          email: 'Raf.kuhn@gmail.com',
          password: hashedPassword,
          accountType: 'camp', // Assuming camp account
          firstName: 'Camp',
          lastName: 'Admin',
          isActive: true,
          autoCreated: true,
          autoCreatedReason: 'Manual fix script - account was missing'
        });
        
        console.log('  ✅ User created:', user._id);
        console.log('  📧 Email:', user.email);
        console.log('  ⚠️  User needs to reset password');
      } else {
        console.log('  ✅ User found by email:', user._id);
      }
    } else {
      console.log('  ✅ User found by ID:', user._id);
    }

    console.log('\n📊 User Details:');
    console.log('  ID:', user._id);
    console.log('  Email:', user.email);
    console.log('  Account Type:', user.accountType);
    console.log('  Active:', user.isActive);
    console.log('  Camp ID:', user.campId || '(not set)');

    // STEP 3: Find or create camp
    console.log('\nSTEP 3: Searching for camp...');
    let camp = await Camp.findOne({ contactEmail: /^Raf\.kuhn@gmail\.com$/i });
    
    if (!camp) {
      console.log('  ❌ Camp not found');
      
      // Check if user has campId set
      if (user.campId) {
        console.log('  🔍 User has campId, checking if camp exists...');
        camp = await Camp.findById(user.campId);
        
        if (camp) {
          console.log('  ✅ Camp found by user.campId:', camp._id);
        } else {
          console.log('  ❌ Camp with that ID doesn\'t exist');
          console.log('  🧹 Clearing invalid campId from user...');
          await User.findByIdAndUpdate(user._id, { $unset: { campId: 1 } });
          user.campId = null;
        }
      }
      
      if (!camp) {
        console.log('\n⚠️  CREATING NEW CAMP...');
        
        const campName = user.campName || 'Camp ' + user.firstName;
        const slug = campName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        camp = await Camp.create({
          name: campName,
          slug: slug,
          description: `Welcome to ${campName}!`,
          contactEmail: user.email,
          owner: user._id, // CRITICAL: Set owner
          status: 'active',
          isPublic: true,
          isPubliclyVisible: false, // New camps default to private
          acceptingApplications: false
        });
        
        console.log('  ✅ Camp created:', camp._id);
        console.log('  📝 Name:', camp.name);
        console.log('  🔗 Slug:', camp.slug);
        
        // Update user with campId
        await User.findByIdAndUpdate(user._id, { campId: camp._id });
        user.campId = camp._id;
        console.log('  🔗 User.campId updated');
        
        // Log the creation
        await recordActivity('CAMP', camp._id, user._id, 'ENTITY_CREATED', {
          field: 'camp',
          action: 'created_by_fix_script',
          reason: 'Camp was missing for user account'
        });
      }
    } else {
      console.log('  ✅ Camp found:', camp._id);
      console.log('  📝 Name:', camp.name);
      console.log('  👤 Owner:', camp.owner || '(NOT SET!)');
    }

    // STEP 4: Validate and fix camp owner
    console.log('\nSTEP 4: Validating camp owner...');
    if (!camp.owner) {
      console.log('  ❌ Camp has NO OWNER - FIXING...');
      camp.owner = user._id;
      await camp.save();
      console.log('  ✅ Camp owner set to:', user._id);
      
      await recordActivity('CAMP', camp._id, user._id, 'OWNER_AUTO_REPAIRED', {
        field: 'owner',
        action: 'manual_fix_script',
        oldValue: null,
        newValue: user._id.toString(),
        reason: 'Camp was missing owner field'
      });
    } else {
      // Check if owner user exists
      const ownerUser = await User.findById(camp.owner);
      if (!ownerUser) {
        console.log('  ❌ Camp owner points to non-existent user');
        console.log('  🔄 Updating to current user...');
        camp.owner = user._id;
        await camp.save();
        console.log('  ✅ Camp owner updated to:', user._id);
        
        await recordActivity('CAMP', camp._id, user._id, 'OWNER_AUTO_REPAIRED', {
          field: 'owner',
          action: 'manual_fix_script',
          oldValue: camp.owner.toString(),
          newValue: user._id.toString(),
          reason: 'Camp owner was invalid'
        });
      } else {
        console.log('  ✅ Camp owner is valid:', camp.owner);
        
        // Check if owner matches the user
        if (camp.owner.toString() !== user._id.toString()) {
          console.log('  ⚠️  Camp owner is different from the user');
          console.log('     Camp owner:', camp.owner);
          console.log('     User ID:', user._id);
          console.log('  ℹ️  This might be intentional - not changing');
        }
      }
    }

    // STEP 5: Ensure user.campId is set
    console.log('\nSTEP 5: Validating user.campId...');
    if (!user.campId) {
      console.log('  ❌ User has no campId - FIXING...');
      await User.findByIdAndUpdate(user._id, { campId: camp._id });
      console.log('  ✅ User.campId set to:', camp._id);
    } else if (user.campId.toString() !== camp._id.toString()) {
      console.log('  ⚠️  User.campId doesn\'t match found camp');
      console.log('     User.campId:', user.campId);
      console.log('     Camp._id:', camp._id);
      console.log('  🔄 Updating to correct camp...');
      await User.findByIdAndUpdate(user._id, { campId: camp._id });
      console.log('  ✅ User.campId updated');
    } else {
      console.log('  ✅ User.campId is correct:', user.campId);
    }

    // STEP 6: Ensure user is active
    console.log('\nSTEP 6: Checking account status...');
    if (!user.isActive) {
      console.log('  ⚠️  User account is DEACTIVATED');
      console.log('  🔄 Activating...');
      await User.findByIdAndUpdate(user._id, { isActive: true });
      console.log('  ✅ User account activated');
      
      await recordActivity('MEMBER', user._id, user._id, 'STATUS_CHANGE', {
        field: 'isActive',
        oldValue: false,
        newValue: true,
        action: 'activated_by_fix_script'
      });
    } else {
      console.log('  ✅ User account is active');
    }

    // Final summary
    console.log('\n' + '=' .repeat(80));
    console.log('✅ ACCOUNT FIX COMPLETE');
    console.log('=' .repeat(80));
    console.log('User ID:', user._id);
    console.log('User Email:', user.email);
    console.log('User Account Type:', user.accountType);
    console.log('User Active:', user.isActive);
    console.log('User Camp ID:', user.campId);
    console.log('');
    console.log('Camp ID:', camp._id);
    console.log('Camp Name:', camp.name);
    console.log('Camp Slug:', camp.slug);
    console.log('Camp Owner:', camp.owner);
    console.log('Camp Status:', camp.status);
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('1. User should be able to login with email: Raf.kuhn@gmail.com');
    console.log('2. User may need to reset password using "Forgot Password"');
    console.log('3. Camp should now be accessible at: https://www.g8road.com/camp/' + camp.slug);
    console.log('4. System admin can now impersonate this account');
    console.log('5. Check system admin panel - user should now appear in the list');
    console.log('=' .repeat(80) + '\n');

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.error('Stack:', error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the fix
fixAccount();

