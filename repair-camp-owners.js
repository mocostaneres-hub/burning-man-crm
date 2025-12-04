#!/usr/bin/env node

/**
 * Repair Camp Owner Links
 * 
 * This script finds all camps with missing or incorrect owner links
 * and repairs them by matching camp.contactEmail with user.email
 */

const mongoose = require('mongoose');
const Camp = require('./server/models/Camp');
const User = require('./server/models/User');
require('dotenv').config();

const repairCampOwners = async () => {
  try {
    console.log('🔧 Starting camp owner repair process...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Find all camps
    const allCamps = await Camp.find({});
    console.log(`📊 Found ${allCamps.length} total camps\n`);
    
    let repairedCount = 0;
    let noUserFoundCount = 0;
    let alreadyCorrectCount = 0;
    const repairs = [];
    const noUserCamps = [];
    
    for (const camp of allCamps) {
      const campId = camp._id;
      const campName = camp.name || camp.campName || 'Unknown';
      const contactEmail = camp.contactEmail;
      
      // Skip if no contactEmail
      if (!contactEmail) {
        console.log(`⚠️  [${campId}] ${campName}: No contactEmail, skipping`);
        continue;
      }
      
      // Try to find user by contactEmail
      const user = await User.findOne({ email: contactEmail });
      
      if (!user) {
        noUserFoundCount++;
        noUserCamps.push({
          campId: campId.toString(),
          campName,
          contactEmail
        });
        console.log(`❌ [${campId}] ${campName}: No user found with email ${contactEmail}`);
        continue;
      }
      
      // Check if owner link is correct
      if (camp.owner && camp.owner.toString() === user._id.toString()) {
        alreadyCorrectCount++;
        console.log(`✅ [${campId}] ${campName}: Owner link already correct`);
        continue;
      }
      
      // Repair needed
      console.log(`🔧 [${campId}] ${campName}: Repairing owner link...`);
      console.log(`   Old owner: ${camp.owner || 'null'}`);
      console.log(`   New owner: ${user._id} (${user.email})`);
      
      // Update camp owner
      camp.owner = user._id;
      await camp.save();
      
      repairedCount++;
      repairs.push({
        campId: campId.toString(),
        campName,
        oldOwner: camp.owner ? camp.owner.toString() : null,
        newOwner: user._id.toString(),
        userEmail: user.email
      });
      
      console.log(`   ✅ Repaired!\n`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 REPAIR SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total camps processed:     ${allCamps.length}`);
    console.log(`Already correct:           ${alreadyCorrectCount}`);
    console.log(`Repaired:                  ${repairedCount}`);
    console.log(`No user found:             ${noUserFoundCount}`);
    console.log('='.repeat(60) + '\n');
    
    if (repairs.length > 0) {
      console.log('🔧 REPAIRS MADE:');
      repairs.forEach(r => {
        console.log(`   • ${r.campName} (${r.campId})`);
        console.log(`     → Linked to user: ${r.userEmail} (${r.newOwner})`);
      });
      console.log('');
    }
    
    if (noUserCamps.length > 0) {
      console.log('❌ CAMPS MISSING USER ACCOUNTS:');
      console.log('These camps have no matching user account and cannot be impersonated:');
      noUserCamps.forEach(c => {
        console.log(`   • ${c.campName} (${c.campId})`);
        console.log(`     Email: ${c.contactEmail}`);
      });
      console.log('\n⚠️  Action Required:');
      console.log('   1. Contact camp admins to register at the contactEmail address');
      console.log('   2. Or manually create user accounts for these camps');
      console.log('   3. Then run this script again to link them\n');
    }
    
    await mongoose.disconnect();
    console.log('✅ Done!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during repair:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the repair
repairCampOwners();

