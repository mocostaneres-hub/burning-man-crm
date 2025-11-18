const Camp = require('../models/Camp');

/**
 * Generate a URL-friendly slug from a camp name
 * @param {string} campName - The camp name to convert to slug
 * @returns {string} - URL-friendly slug
 */
function generateSlugFromName(campName) {
  if (!campName || typeof campName !== 'string') {
    return '';
  }

  return campName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate a unique slug for a camp
 * @param {string} campName - The camp name to convert to slug
 * @param {string} excludeCampId - Camp ID to exclude from uniqueness check (for updates)
 * @returns {Promise<string>} - Unique slug
 */
async function generateUniqueCampSlug(campName, excludeCampId = null) {
  if (!campName || typeof campName !== 'string' || campName.trim() === '') {
    throw new Error('Camp name is required to generate slug');
  }

  let baseSlug = generateSlugFromName(campName);
  
  // Ensure base slug is not empty
  if (!baseSlug) {
    baseSlug = 'camp';
  }

  // Check if slug already exists
  const query = { slug: baseSlug };
  if (excludeCampId) {
    query._id = { $ne: excludeCampId };
  }

  let existingCamp = await Camp.findOne(query);
  
  // If slug doesn't exist, return it
  if (!existingCamp) {
    return baseSlug;
  }

  // If slug exists, append a number to make it unique
  let counter = 2;
  let uniqueSlug = `${baseSlug}-${counter}`;
  
  while (true) {
    const checkQuery = { slug: uniqueSlug };
    if (excludeCampId) {
      checkQuery._id = { $ne: excludeCampId };
    }
    
    existingCamp = await Camp.findOne(checkQuery);
    
    if (!existingCamp) {
      return uniqueSlug;
    }
    
    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
    
    // Safety limit to prevent infinite loops
    if (counter > 1000) {
      throw new Error('Unable to generate unique slug after 1000 attempts');
    }
  }
}

module.exports = {
  generateSlugFromName,
  generateUniqueCampSlug
};


