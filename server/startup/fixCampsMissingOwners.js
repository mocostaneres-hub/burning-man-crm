/**
 * Automated Camp Owner Repair - Startup Script
 * 
 * Automatically fixes camps created after 2025-12-01 where owner is missing or null.
 * Creates camp user accounts using contactEmail if they don't exist.
 * 
 * Run on server startup to ensure data integrity.
 */

const Camp = require('../models/Camp');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { recordActivity } = require('../services/activityLogger');

async function fixCampsMissingOwnersOnStartup() {
  console.log('\n🔧 [Camp Repair] Starting automated camp owner repair...');
  
  try {
    // Find all camps with missing owner created after 2025-12-01
    const camps = await Camp.find({
      $or: [
        { owner: null }, 
        { owner: "" }, 
        { owner: { $exists: false } }
      ],
      createdAt: { $gte: new Date("2025-12-01") }
    });

    if (camps.length === 0) {
      console.log('✅ [Camp Repair] No camps need repair. All camps have owners.');
      return { repaired: 0, created: 0, skipped: 0 };
    }

    console.log(`📊 [Camp Repair] Found ${camps.length} camps needing repair`);

    let repaired = 0;
    let usersCreated = 0;
    let skipped = 0;

    for (const camp of camps) {
      const campId = camp._id;
      const campName = camp.name || camp.campName || 'Unknown Camp';

      // Skip if no contactEmail
      if (!camp.contactEmail) {
        console.warn(`⚠️  [Camp Repair] Skipped ${campName} (${campId}): No contactEmail`);
        skipped++;
        continue;
      }

      console.log(`🔍 [Camp Repair] Processing: ${campName} (${campId})`);
      console.log(`   Contact Email: ${camp.contactEmail}`);

      // Try to find existing user by contactEmail
      let user = await User.findOne({ email: camp.contactEmail });

      if (!user) {
        // Create new camp user account
        console.log(`   ➕ Creating new camp user account...`);
        
        // Generate secure random password (user will need to reset)
        const randomPassword = require('crypto').randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        user = await User.create({
          email: camp.contactEmail,
          password: hashedPassword,
          accountType: 'camp',
          campId: campId,
          campName: campName,
          firstName: campName.split(' ')[0] || 'Camp',
          lastName: 'Admin',
          isActive: true,
          createdAt: new Date(),
          // Store a flag indicating this was auto-created
          autoCreated: true,
          autoCreatedReason: 'Camp owner repair on startup'
        });

        console.log(`   ✅ Created user: ${user._id}`);
        usersCreated++;

        // Log the user creation
        await recordActivity('CAMP', campId, user._id, 'USER_AUTO_CREATED', {
          field: 'owner_user',
          action: 'auto_created_on_startup',
          userId: user._id.toString(),
          email: user.email,
          reason: 'Automated repair for missing camp owner'
        });
      } else {
        console.log(`   ✅ Found existing user: ${user._id}`);
        
        // Update user's campId if not set
        if (!user.campId) {
          user.campId = campId;
          await user.save();
          console.log(`   🔗 Updated user.campId`);
        }
      }

      // Update camp owner
      const oldOwner = camp.owner;
      camp.owner = user._id;
      await camp.save();

      console.log(`   ✅ Repaired camp.owner: ${camp.owner}`);
      repaired++;

      // Log the repair
      await recordActivity('CAMP', campId, user._id, 'OWNER_AUTO_REPAIRED', {
        field: 'owner',
        action: 'auto_repaired_on_startup',
        oldValue: oldOwner ? oldOwner.toString() : null,
        newValue: user._id.toString(),
        userId: user._id.toString(),
        userEmail: user.email,
        reason: 'Automated repair for missing camp owner'
      });
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ [Camp Repair] COMPLETED');
    console.log('='.repeat(60));
    console.log(`Camps processed:     ${camps.length}`);
    console.log(`Camps repaired:      ${repaired}`);
    console.log(`Users created:       ${usersCreated}`);
    console.log(`Camps skipped:       ${skipped}`);
    console.log('='.repeat(60) + '\n');

    return { repaired, created: usersCreated, skipped };

  } catch (error) {
    console.error('❌ [Camp Repair] Error during automated repair:', error);
    throw error;
  }
}

module.exports = { fixCampsMissingOwnersOnStartup };

