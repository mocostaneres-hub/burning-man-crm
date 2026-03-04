/**
 * Migration Script: Deprecate Contact Email Field
 * 
 * This script handles the deprecation of the contactEmail field in the Camp model.
 * It ensures data integrity during the transition from contactEmail to User.email authentication.
 * 
 * What this script does:
 * 1. Validates that all camps have proper owner relationships
 * 2. Identifies camps that need owner repair (using contactEmail fallback)
 * 3. Reports on data integrity issues
 * 4. Optionally repairs owner relationships where possible
 * 
 * Usage:
 *   node server/migrations/deprecate-contact-email.js [--dry-run] [--repair]
 * 
 *   --dry-run: Only reports issues without making changes (default)
 *   --repair:  Actually fixes owner relationships where possible
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Import models
const User = require('../models/User');
const Camp = require('../models/Camp');

const migrateCampContactEmails = async (options = {}) => {
  const { dryRun = true, repair = false } = options;
  
  console.log(`\n🔍 Starting Contact Email Deprecation Migration`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Repair: ${repair ? 'ENABLED' : 'DISABLED'}`);
  console.log('─'.repeat(60));

  try {
    // Get all camps (including those with contactEmail populated due to select: false)
    const allCamps = await Camp.find({}).select('+contactEmail');
    console.log(`📊 Found ${allCamps.length} total camps`);

    // Get all users for reference
    const allUsers = await User.find({});
    console.log(`📊 Found ${allUsers.length} total users`);

    let stats = {
      totalCamps: allCamps.length,
      campsWithOwner: 0,
      campsWithContactEmail: 0,
      campsWithBoth: 0,
      orphanedCamps: 0,
      needsRepair: 0,
      repaired: 0,
      errors: 0
    };

    let issues = [];

    for (const camp of allCamps) {
      const campInfo = {
        id: camp._id,
        name: camp.name || camp.campName || 'Unnamed Camp',
        hasOwner: !!camp.owner,
        hasContactEmail: !!camp.contactEmail,
        contactEmail: camp.contactEmail
      };

      // Update stats
      if (campInfo.hasOwner) stats.campsWithOwner++;
      if (campInfo.hasContactEmail) stats.campsWithContactEmail++;
      if (campInfo.hasOwner && campInfo.hasContactEmail) stats.campsWithBoth++;

      // Try to find owner user
      let ownerUser = null;

      // Strategy 1: Direct owner lookup
      if (camp.owner) {
        ownerUser = allUsers.find(user => user._id.toString() === camp.owner.toString());
      }

      // Strategy 2: Fallback by contactEmail
      if (!ownerUser && camp.contactEmail) {
        ownerUser = allUsers.find(user => 
          user.email && user.email.toLowerCase() === camp.contactEmail.toLowerCase()
        );
        
        if (ownerUser && (!camp.owner || camp.owner.toString() !== ownerUser._id.toString())) {
          stats.needsRepair++;
          issues.push({
            type: 'NEEDS_REPAIR',
            camp: campInfo,
            user: {
              id: ownerUser._id,
              email: ownerUser.email,
              accountType: ownerUser.accountType
            },
            message: `Camp has contactEmail ${camp.contactEmail} but owner field is ${camp.owner || 'null'}`
          });

          // Repair if enabled
          if (repair && !dryRun) {
            try {
              await Camp.updateOne(
                { _id: camp._id }, 
                { owner: ownerUser._id }
              );
              stats.repaired++;
              console.log(`✅ Repaired: ${campInfo.name} - set owner to ${ownerUser._id}`);
            } catch (error) {
              stats.errors++;
              console.error(`❌ Failed to repair ${campInfo.name}:`, error.message);
            }
          }
        }
      }

      // Strategy 3: Camp account user lookup
      if (!ownerUser) {
        ownerUser = allUsers.find(user => 
          user.accountType === 'camp' && 
          user.campId && 
          user.campId.toString() === camp._id.toString()
        );
      }

      // Check for orphaned camps
      if (!ownerUser) {
        stats.orphanedCamps++;
        issues.push({
          type: 'ORPHANED',
          camp: campInfo,
          message: `No owner user found via any strategy`
        });
      }
    }

    // Print summary
    console.log('\n📈 MIGRATION SUMMARY:');
    console.log('─'.repeat(40));
    console.log(`Total camps:              ${stats.totalCamps}`);
    console.log(`Camps with owner:         ${stats.campsWithOwner}`);
    console.log(`Camps with contactEmail:  ${stats.campsWithContactEmail}`);
    console.log(`Camps with both:          ${stats.campsWithBoth}`);
    console.log(`Orphaned camps:           ${stats.orphanedCamps}`);
    console.log(`Camps needing repair:     ${stats.needsRepair}`);
    if (repair && !dryRun) {
      console.log(`Camps repaired:           ${stats.repaired}`);
      console.log(`Repair errors:            ${stats.errors}`);
    }

    // Print issues
    if (issues.length > 0) {
      console.log('\n⚠️  ISSUES FOUND:');
      console.log('─'.repeat(40));
      
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.type}] ${issue.camp.name}`);
        console.log(`   ID: ${issue.camp.id}`);
        console.log(`   Message: ${issue.message}`);
        if (issue.user) {
          console.log(`   User: ${issue.user.email} (${issue.user.id})`);
        }
        console.log();
      });
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('─'.repeat(40));
    
    if (stats.orphanedCamps > 0) {
      console.log(`• ${stats.orphanedCamps} orphaned camps found. Consider manual cleanup.`);
    }
    
    if (stats.needsRepair > 0 && !repair) {
      console.log(`• ${stats.needsRepair} camps need owner repair. Run with --repair to fix.`);
    }
    
    if (stats.campsWithContactEmail > 0) {
      console.log(`• ${stats.campsWithContactEmail} camps still have contactEmail data.`);
      console.log('  This is preserved for backward compatibility but no longer used publicly.');
    }

    console.log('\n✅ Migration analysis complete');
    return { stats, issues };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  const args = process.argv.slice(2);
  const options = {
    dryRun: !args.includes('--live'),
    repair: args.includes('--repair')
  };

  try {
    await connectDB();
    const result = await migrateCampContactEmails(options);
    
    console.log('\n🎉 Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { migrateCampContactEmails };