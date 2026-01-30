/**
 * Email normalization utilities
 * Ensures consistent email handling across the application
 */

/**
 * Normalize email address to lowercase and trim whitespace
 * @param {string} email - Email address to normalize
 * @returns {string} - Normalized email address
 */
function normalizeEmail(email) {
  if (!email || typeof email !== 'string') {
    return '';
  }
  return email.toLowerCase().trim();
}

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Normalize and validate email
 * @param {string} email - Email address to process
 * @returns {{valid: boolean, normalized: string, error?: string}}
 */
function processEmail(email) {
  const normalized = normalizeEmail(email);
  
  if (!normalized) {
    return { valid: false, normalized: '', error: 'Email is required' };
  }
  
  if (!isValidEmail(normalized)) {
    return { valid: false, normalized: '', error: 'Invalid email format' };
  }
  
  return { valid: true, normalized };
}

module.exports = {
  normalizeEmail,
  isValidEmail,
  processEmail
};
