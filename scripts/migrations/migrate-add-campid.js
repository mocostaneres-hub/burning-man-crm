// Migration script to add campId to existing users
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./server/models/User');
const Camp = require('./server/models/Camp');

const migrateCampId = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all camps
    const camps = await Camp.find({});
    console.log(`📋 Found ${camps.length} camps\n`);

    let updatedCount = 0;

    for (const camp of camps) {
      // Find user by contactEmail (camp owner)
      const user = await User.findOne({ email: camp.contactEmail });
      
      if (user) {
        console.log(`Processing: ${user.email}`);
        console.log(`  Camp: ${camp.campName}`);
        console.log(`  Setting campId: ${camp._id}`);
        
        user.campId = camp._id;
        user.campName = camp.campName; // Ensure campName is also set
        await user.save();
        
        updatedCount++;
        console.log(`  ✅ Updated\n`);
      } else {
        console.log(`  ⚠️  No user found for camp: ${camp.campName} (${camp.contactEmail})\n`);
      }
    }

    console.log(`\n🎉 Migration complete!`);
    console.log(`   Updated ${updatedCount} users`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
};

migrateCampId();

