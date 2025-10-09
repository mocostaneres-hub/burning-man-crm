const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Camp = require('./server/models/Camp');
const User = require('./server/models/User');

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('❌ MONGODB_URI environment variable is required');
  process.exit(1);
}

console.log('🔗 Connecting to MongoDB...');
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function generateCampSlugs() {
  console.log('🔄 Generating camp slugs...');
  
  const camps = await Camp.find({});
  let updatedCount = 0;
  
  for (const camp of camps) {
    if (!camp.slug || camp.slug !== camp.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) {
      const newSlug = camp.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      // Check if slug already exists
      const existingCamp = await Camp.findOne({ slug: newSlug, _id: { $ne: camp._id } });
      if (existingCamp) {
        // If slug exists, append camp ID to make it unique
        camp.slug = `${newSlug}-${camp._id}`;
      } else {
        camp.slug = newSlug;
      }
      
      await camp.save();
      updatedCount++;
      console.log(`✅ Updated camp "${camp.name}" with slug: ${camp.slug}`);
    }
  }
  
  console.log(`🎉 Updated ${updatedCount} camps with new slugs`);
}

async function generateUserSlugs() {
  console.log('🔄 Generating user URL slugs...');
  
  const users = await User.find({ accountType: 'personal' });
  let updatedCount = 0;
  
  for (const user of users) {
    const nameToUse = user.playaName || `${user.firstName || ''} ${user.lastName || ''}`.trim();
    
    if (nameToUse && (!user.urlSlug || user.urlSlug !== nameToUse.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))) {
      let newSlug = nameToUse
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      // Check if slug already exists
      const existingUser = await User.findOne({ urlSlug: newSlug, _id: { $ne: user._id } });
      if (existingUser) {
        // If slug exists, append user ID to make it unique
        newSlug = `${newSlug}-${user._id}`;
      }
      
      user.urlSlug = newSlug;
      await user.save();
      updatedCount++;
      console.log(`✅ Updated user "${nameToUse}" with URL slug: ${user.urlSlug}`);
    }
  }
  
  console.log(`🎉 Updated ${updatedCount} users with new URL slugs`);
}

async function migrateSlugs() {
  try {
    console.log('🚀 Starting URL slug migration...');
    
    await generateCampSlugs();
    await generateUserSlugs();
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    mongoose.connection.close();
  }
}

migrateSlugs();
