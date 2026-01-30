#!/usr/bin/env node

/**
 * List all databases on MongoDB server and show which ones have data
 * This helps identify the correct production database name
 */

const mongoose = require('mongoose');

// Get MongoDB URI from command line or environment
const MONGODB_URI = process.argv[2] || process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Please provide MongoDB URI as argument or MONGODB_URI env var');
  console.error('Usage: node list-databases.js "mongodb://user:pass@host:port"');
  process.exit(1);
}

async function listDatabases() {
  try {
    console.log('🔍 Connecting to MongoDB server...\n');
    
    // Use the URI as-is (will connect to 'test' db by default, which is fine for listing)
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connected to MongoDB!\n');
    console.log('📊 Listing all databases:\n');
    console.log('=' .repeat(80));

    // Get admin database to list all databases
    const adminDb = mongoose.connection.db.admin();
    const { databases } = await adminDb.listDatabases();

    // Sort by size (largest first)
    databases.sort((a, b) => b.sizeOnDisk - a.sizeOnDisk);

    for (const db of databases) {
      const sizeMB = (db.sizeOnDisk / 1024 / 1024).toFixed(2);
      const hasData = db.sizeOnDisk > 0;
      const indicator = hasData ? '✅' : '⭕';
      
      console.log(`${indicator} ${db.name.padEnd(30)} | Size: ${sizeMB.padStart(10)} MB`);
      
      // If database has data, show collections
      if (hasData && db.name !== 'admin' && db.name !== 'local') {
        try {
          const dbConnection = mongoose.connection.useDb(db.name);
          const collections = await dbConnection.db.listCollections().toArray();
          
          if (collections.length > 0) {
            console.log('   Collections:');
            for (const coll of collections) {
              const collStats = await dbConnection.db.collection(coll.name).countDocuments();
              console.log(`   - ${coll.name.padEnd(25)} (${collStats} documents)`);
            }
          }
        } catch (err) {
          console.log('   (Could not read collections)');
        }
      }
      console.log('-'.repeat(80));
    }

    console.log('\n💡 Your MONGODB_URI should end with the database name that has your data:');
    console.log('   mongodb://user:pass@host:port/DATABASE_NAME');
    
    // Find most likely production database
    const productionDb = databases.find(db => 
      db.sizeOnDisk > 0 && 
      !['admin', 'local', 'test', 'config'].includes(db.name)
    );

    if (productionDb) {
      console.log(`\n🎯 Most likely production database: "${productionDb.name}"`);
      console.log(`\n✅ Update your Railway MONGODB_URI to:`);
      console.log(`   mongodb://mongo:aWAjWkGLSDnmvYVDRFAZtrbfGJyQO0wB@yamanote.proxy.rlwy.net:41945/${productionDb.name}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

listDatabases();
