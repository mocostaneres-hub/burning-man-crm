const db = require('../../server/database/databaseAdapter');

async function checkFAQs() {
  try {
    console.log('🔍 Checking FAQs in database...');
    
    const allFAQs = await db.findFAQs();
    console.log('📋 Total FAQs found:', allFAQs.length);
    
    if (allFAQs.length > 0) {
      console.log('📝 First FAQ:');
      console.log('  Question:', allFAQs[0].question);
      console.log('  Audience:', allFAQs[0].audience);
      console.log('  Category:', allFAQs[0].category);
    }
    
    // Check with different filters
    const homepageFAQs = await db.findFAQs({ audience: 'homepage' });
    console.log('🏠 Homepage FAQs:', homepageFAQs.length);
    
    const activeFAQs = await db.findFAQs({ isActive: true });
    console.log('✅ Active FAQs:', activeFAQs.length);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkFAQs();
