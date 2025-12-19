#!/usr/bin/env node
/**
 * Migration Script: Add authProviders field to existing users
 * 
 * This script initializes the authProviders array for all existing users
 * based on their current authentication methods.
 * 
 * Logic:
 * - If user has googleId → add 'google'
 * - If user has appleId → add 'apple'
 * - If user has no OAuth IDs → add 'password' (default)
 * - Users can have multiple providers
 * 
 * Run with: node migrate-add-auth-providers.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./server/models/User');

async function migrateAuthProviders() {
  try {
    console.log('🔄 [Migration] Starting authProviders migration...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI or MONGO_URI environment variable is required');
    }
    
    await mongoose.connect(mongoUri);
    console.log('✅ [Migration] Connected to MongoDB');
    
    // Find all users without authProviders or with empty authProviders
    const usersToUpdate = await User.find({
      $or: [
        { authProviders: { $exists: false } },
        { authProviders: { $size: 0 } },
        { authProviders: null }
      ]
    });
    
    console.log(`📊 [Migration] Found ${usersToUpdate.length} users to update`);
    
    let updated = 0;
    let skipped = 0;
    
    for (const user of usersToUpdate) {
      const providers = [];
      
      // Check for OAuth providers
      if (user.googleId) {
        providers.push('google');
      }
      if (user.appleId) {
        providers.push('apple');
      }
      
      // If no OAuth providers found, assume password authentication
      if (providers.length === 0) {
        providers.push('password');
      }
      
      // Update user
      try {
        await User.findByIdAndUpdate(user._id, {
          authProviders: providers
        });
        
        console.log(`✅ [Migration] Updated user ${user.email}: ${providers.join(', ')}`);
        updated++;
      } catch (error) {
        console.error(`❌ [Migration] Failed to update user ${user.email}:`, error.message);
        skipped++;
      }
    }
    
    console.log('\n📊 [Migration] Summary:');
    console.log(`   ✅ Updated: ${updated} users`);
    console.log(`   ⚠️  Skipped: ${skipped} users`);
    console.log(`   📈 Total: ${usersToUpdate.length} users processed`);
    console.log('\n✅ [Migration] Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ [Migration] Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 [Migration] Database connection closed');
  }
}

// Run migration
migrateAuthProviders()
  .then(() => {
    console.log('✅ [Migration] Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ [Migration] Script failed:', error);
    process.exit(1);
  });

