const mongoose = require('mongoose');
const Camp = require('./server/models/Camp');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function fixCampSlugs() {
  try {
    console.log('🔍 Finding camps with null slugs...');
    
    // Find all camps with null or missing slugs
    const campsWithoutSlugs = await Camp.find({ 
      $or: [
        { slug: null },
        { slug: { $exists: false } },
        { slug: '' }
      ]
    });
    
    console.log(`Found ${campsWithoutSlugs.length} camps without slugs`);
    
    for (const camp of campsWithoutSlugs) {
      console.log(`\n🔧 Fixing slug for camp: ${camp.campName || camp.name}`);
      
      // Generate slug from campName or name
      const name = camp.campName || camp.name;
      if (name) {
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        
        console.log(`  Generated slug: ${slug}`);
        
        // Update the camp with the new slug
        camp.slug = slug;
        await camp.save();
        
        console.log(`  ✅ Updated camp with slug: ${slug}`);
      } else {
        console.log(`  ❌ No name found for camp ID: ${camp._id}`);
      }
    }
    
    console.log('\n✅ Finished fixing camp slugs');
    
    // Verify the fix
    console.log('\n🔍 Verifying fixes...');
    const mudskippers = await Camp.findOne({ campName: 'Mudskippers' });
    if (mudskippers) {
      console.log(`Mudskippers camp slug: ${mudskippers.slug}`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing camp slugs:', error);
  } finally {
    mongoose.disconnect();
  }
}

fixCampSlugs();
