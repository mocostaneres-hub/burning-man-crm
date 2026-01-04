require('dotenv').config();
const mongoose = require('mongoose');
const db = require('./server/database/databaseAdapter');
const Camp = require('./server/models/Camp');

async function updateCampSlug() {
  try {
    // Connect to MongoDB - allow override via command line argument
    const mongoUri = process.argv[2] || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI not found');
      console.log('');
      console.log('Usage:');
      console.log('  node update-camp-slug.js [MONGODB_URI]');
      console.log('');
      console.log('Example:');
      console.log('  node update-camp-slug.js "mongodb://user:pass@host:port/db"');
      console.log('');
      console.log('Or set MONGODB_URI in .env file');
      process.exit(1);
    }

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    const campId = '6904abe817ecb6e13d219ec2';
    const newSlug = 'bananahammocks';

    // Find the camp using database adapter
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      console.error(`❌ Camp with ID ${campId} not found`);
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`📋 Current camp: ${camp.name || camp.campName}`);
    console.log(`📋 Current slug: ${camp.slug || 'null'}`);

    // Check if the new slug already exists for another camp
    const existingCamp = await db.findCamp({ slug: newSlug });
    if (existingCamp && existingCamp._id.toString() !== campId) {
      console.error(`❌ Slug "${newSlug}" already exists for camp: ${existingCamp.name || existingCamp.campName} (ID: ${existingCamp._id})`);
      console.log('⚠️  Cannot update - slug must be unique');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Update the slug using database adapter
    const updatedCamp = await db.updateCamp({ _id: campId }, { slug: newSlug });

    if (!updatedCamp) {
      console.error('❌ Failed to update camp slug');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`✅ Successfully updated camp slug to: ${newSlug}`);
    console.log(`✅ Camp URL: https://www.g8road.com/camps/${newSlug}`);
    console.log(`✅ Camp name: ${updatedCamp.name || updatedCamp.campName}`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error updating camp slug:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

updateCampSlug();

