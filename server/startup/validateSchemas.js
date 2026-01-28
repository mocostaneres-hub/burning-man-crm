/**
 * Schema Validation Health Check
 * Validates that critical schemas are configured correctly on startup
 */

const mongoose = require('mongoose');

function validateCampSchema() {
  const Camp = require('../models/Camp');
  const schema = Camp.schema;
  
  console.log('🔍 [Schema Validation] Checking Camp schema...');
  
  // Check for duplicate fields
  const fieldNames = Object.keys(schema.paths);
  const duplicates = fieldNames.filter((name, index) => 
    fieldNames.indexOf(name) !== index
  );
  
  if (duplicates.length > 0) {
    console.error('❌ [Schema Validation] DUPLICATE FIELDS DETECTED:', duplicates);
    throw new Error(`Camp schema has duplicate fields: ${duplicates.join(', ')}`);
  }
  
  // Validate photos field structure
  const photosPath = schema.path('photos');
  if (!photosPath) {
    console.error('❌ [Schema Validation] photos field is missing!');
    throw new Error('Camp schema missing photos field');
  }
  
  // Check if photos is array type
  if (photosPath.instance !== 'Array') {
    console.error('❌ [Schema Validation] photos field is not an array!');
    throw new Error('Camp schema photos field must be an array');
  }
  
  // Check if photos array contains objects (not strings)
  const caster = photosPath.caster;
  if (caster && caster.instance === 'String') {
    console.error('❌ [Schema Validation] photos field is array of Strings!');
    console.error('   Expected: [{ url, caption, isPrimary }]');
    console.error('   Actual: [String]');
    throw new Error('Camp schema photos field must be array of objects, not strings');
  }
  
  // Validate photos has required subfields
  if (caster && caster.schema) {
    const hasUrl = caster.schema.path('url');
    const hasCaption = caster.schema.path('caption');
    const hasIsPrimary = caster.schema.path('isPrimary');
    
    if (!hasUrl) {
      console.warn('⚠️ [Schema Validation] photos.url field missing');
    }
    if (!hasCaption) {
      console.warn('⚠️ [Schema Validation] photos.caption field missing');
    }
    if (!hasIsPrimary) {
      console.warn('⚠️ [Schema Validation] photos.isPrimary field missing');
    }
    
    if (hasUrl && hasCaption && hasIsPrimary) {
      console.log('✅ [Schema Validation] photos field structure correct');
    }
  }
  
  console.log('✅ [Schema Validation] Camp schema validation passed');
}

function validateAllSchemas() {
  try {
    validateCampSchema();
    // Add more schema validations here as needed
    console.log('✅ [Schema Validation] All schemas validated successfully');
    return true;
  } catch (error) {
    console.error('❌ [Schema Validation] Validation failed:', error.message);
    if (process.env.NODE_ENV === 'production') {
      console.error('⚠️ [Schema Validation] CRITICAL: Schema validation failed in production!');
      console.error('   Server will continue but uploads may fail.');
      console.error('   Fix schema issues immediately!');
      return false;
    } else {
      throw error; // Fail fast in development
    }
  }
}

module.exports = { validateAllSchemas };
