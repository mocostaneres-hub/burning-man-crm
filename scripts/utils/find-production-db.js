#!/usr/bin/env node

/**
 * Try connecting to common database names to find which one has data
 */

const mongoose = require('mongoose');

const BASE_URI = 'mongodb://mongo:aWAjWkGLSDnmvYVDRFAZtrbfGJyQO0wB@yamanote.proxy.rlwy.net:41945';

// Common database names to try
const dbNames = [
  'burning-man-crm',
  'burningman-crm',
  'burning_man_crm',
  'burningman',
  'production',
  'prod',
  'railway',
  'g8road',
  'g8',
  'main',
  'database',
  'test'
];

async function checkDatabase(dbName) {
  try {
    const uri = `${BASE_URI}/${dbName}`;
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000
    });

    // Try to count documents in common collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    if (collections.length === 0) {
      console.log(`⭕ ${dbName.padEnd(25)} - Empty (no collections)`);
      await mongoose.disconnect();
      return null;
    }

    console.log(`\n✅ ${dbName.padEnd(25)} - HAS DATA!`);
    console.log(`   Collections found (${collections.length}):`);
    
    let totalDocs = 0;
    for (const coll of collections) {
      try {
        const count = await mongoose.connection.db.collection(coll.name).countDocuments();
        totalDocs += count;
        if (count > 0) {
          console.log(`   - ${coll.name.padEnd(25)} (${count} documents)`);
        }
      } catch (err) {
        // Skip if can't count
      }
    }

    await mongoose.disconnect();
    return { name: dbName, collections: collections.length, documents: totalDocs };
    
  } catch (error) {
    if (error.message.includes('Authentication')) {
      console.log(`❌ Authentication failed for ${dbName}`);
      return 'auth_failed';
    }
    // Database doesn't exist or connection failed
    console.log(`⭕ ${dbName.padEnd(25)} - Not found or empty`);
    try {
      await mongoose.disconnect();
    } catch (e) {}
    return null;
  }
}

async function findProductionDatabase() {
  console.log('🔍 Searching for production database...\n');
  console.log('Trying common database names:');
  console.log('='.repeat(80));

  const results = [];
  let authFailed = false;

  for (const dbName of dbNames) {
    const result = await checkDatabase(dbName);
    if (result === 'auth_failed') {
      authFailed = true;
      break;
    }
    if (result) {
      results.push(result);
    }
  }

  console.log('\n' + '='.repeat(80));

  if (authFailed) {
    console.log('\n❌ Authentication failed. The MongoDB user might not have access.');
    console.log('   Please check your Railway MongoDB credentials.');
    return;
  }

  if (results.length === 0) {
    console.log('\n❌ No databases with data found.');
    console.log('   Tried databases:', dbNames.join(', '));
    console.log('\n💡 Your data might be in a database with a different name.');
    console.log('   Please check your Railway MongoDB dashboard to see database names.');
  } else {
    console.log('\n🎯 Found database(s) with data:\n');
    results.sort((a, b) => b.documents - a.documents);
    
    for (const result of results) {
      console.log(`   📊 ${result.name}`);
      console.log(`      - ${result.collections} collections`);
      console.log(`      - ${result.documents} total documents\n`);
    }

    const mainDb = results[0];
    console.log('✅ Your MONGODB_URI should be:');
    console.log(`\n   mongodb://mongo:aWAjWkGLSDnmvYVDRFAZtrbfGJyQO0wB@yamanote.proxy.rlwy.net:41945/${mainDb.name}\n`);
    console.log('📋 Copy this URI and update it in Railway > Variables > MONGODB_URI');
  }
}

findProductionDatabase();
