const express = require('express');
const router = express.Router();
const db = require('../database/databaseAdapter');

// @route   POST /api/fix-slugs
// @desc    Fix camp slugs for camps that have null slugs
// @access  Admin only (temporary endpoint)
router.post('/', async (req, res) => {
  try {
    console.log('🔧 Starting slug fix process...');
    
    // Get all camps
    const allCamps = await db.findCamps();
    console.log(`Found ${allCamps.length} total camps`);
    
    const campsToFix = [];
    
    for (const camp of allCamps) {
      if (!camp.slug || camp.slug === null || camp.slug === '') {
        campsToFix.push(camp);
        console.log(`Camp without slug: ${camp.campName || camp.name} (ID: ${camp._id})`);
      }
    }
    
    console.log(`Found ${campsToFix.length} camps that need slug fixes`);
    
    const fixedCamps = [];
    
    for (const camp of campsToFix) {
      console.log(`Fixing slug for camp: ${camp.campName || camp.name}`);
      
      // Generate slug from campName or name
      const name = camp.campName || camp.name;
      if (name) {
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        
        console.log(`Generated slug: ${slug}`);
        
        // Update the camp with the new slug
        const updateData = { slug };
        await db.updateCamp(camp._id.toString(), updateData);
        
        fixedCamps.push({
          id: camp._id,
          name: camp.campName || camp.name,
          slug: slug
        });
        
        console.log(`Updated camp with slug: ${slug}`);
      } else {
        console.log(`No name found for camp ID: ${camp._id}`);
      }
    }
    
    console.log('✅ Finished fixing camp slugs');
    
    res.json({
      message: 'Slug fix completed',
      totalCamps: allCamps.length,
      fixedCamps: fixedCamps.length,
      details: fixedCamps
    });
    
  } catch (error) {
    console.error('❌ Error fixing camp slugs:', error);
    res.status(500).json({ 
      error: 'Failed to fix camp slugs',
      message: error.message 
    });
  }
});

module.exports = router;
