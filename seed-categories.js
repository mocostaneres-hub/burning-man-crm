const mongoose = require('mongoose');
const CampCategory = require('./server/models/CampCategory');
require('dotenv').config();

const defaultCategories = [
  'Art & Performance',
  'Music & Sound',
  'Healing & Wellness',
  'Education & Workshops',
  'Food & Beverage',
  'Theme Camp',
  'Village',
  'Sound Camp',
  'Placement Camp',
  'Chill Space',
  'Party Camp',
  'Family Friendly',
  'LGBTQ+',
  'International',
  'Veterans',
  'First-Timers Friendly'
];

const seedCategories = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/burning-man-crm';
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    console.log('📋 Seeding camp categories...\n');
    
    let createdCount = 0;
    let skippedCount = 0;

    for (const categoryName of defaultCategories) {
      const existing = await CampCategory.findOne({ name: categoryName });
      if (existing) {
        console.log(`  ⏭️  Category already exists: ${categoryName}`);
        skippedCount++;
      } else {
        await CampCategory.create({ name: categoryName });
        console.log(`  ✅ Created category: ${categoryName}`);
        createdCount++;
      }
    }

    console.log(`\n🎉 Seeding complete!`);
    console.log(`   Created: ${createdCount} categories`);
    console.log(`   Skipped: ${skippedCount} categories`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedCategories();

