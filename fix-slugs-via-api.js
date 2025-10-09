const databaseAdapter = require('./server/database/databaseAdapter');

async function fixCampSlugs() {
  try {
    console.log('🔍 Finding camps with null slugs...');
    
    // Get all camps
    const allCamps = await databaseAdapter.findCamps();
    console.log(`Found ${allCamps.length} total camps`);
    
    const campsToFix = [];
    
    for (const camp of allCamps) {
      if (!camp.slug || camp.slug === null || camp.slug === '') {
        campsToFix.push(camp);
        console.log(`Camp without slug: ${camp.campName || camp.name} (ID: ${camp._id})`);
      }
    }
    
    console.log(`\nFound ${campsToFix.length} camps that need slug fixes`);
    
    for (const camp of campsToFix) {
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
        const updateData = { slug };
        await databaseAdapter.updateCamp(camp._id.toString(), updateData);
        
        console.log(`  ✅ Updated camp with slug: ${slug}`);
      } else {
        console.log(`  ❌ No name found for camp ID: ${camp._id}`);
      }
    }
    
    console.log('\n✅ Finished fixing camp slugs');
    
    // Verify the fix
    console.log('\n🔍 Verifying fixes...');
    const mudskippers = await databaseAdapter.findCamp({ campName: 'Mudskippers' });
    if (mudskippers) {
      console.log(`Mudskippers camp slug: ${mudskippers.slug}`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing camp slugs:', error);
  }
}

fixCampSlugs();
