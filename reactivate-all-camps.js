const db = require('./server/database/databaseAdapter');

async function reactivateAllCamps() {
  try {
    console.log('🔄 Starting camp reactivation process...');
    
    // Get all camps regardless of status
    const allCamps = await db.findAllCamps({}, {});
    console.log(`📊 Found ${allCamps.length} total camps in database`);
    
    let reactivatedCount = 0;
    let alreadyActiveCount = 0;
    
    for (const camp of allCamps) {
      if (camp.status !== 'active') {
        console.log(`🔄 Reactivating camp: ${camp.campName || camp.name} (ID: ${camp._id})`);
        await db.updateCampById(camp._id, { status: 'active' });
        reactivatedCount++;
      } else {
        alreadyActiveCount++;
      }
    }
    
    console.log('\n✅ Reactivation complete!');
    console.log(`📈 Reactivated: ${reactivatedCount} camps`);
    console.log(`✅ Already active: ${alreadyActiveCount} camps`);
    console.log(`📊 Total camps: ${allCamps.length}`);
    
    // Verify the update
    const activeCamps = await db.findAllCamps({ status: 'active' }, {});
    console.log(`\n🎯 Verification: ${activeCamps.length} camps now have status='active'`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error reactivating camps:', error);
    process.exit(1);
  }
}

// Run the script
reactivateAllCamps();

