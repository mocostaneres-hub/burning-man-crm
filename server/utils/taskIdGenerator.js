/**
 * Generate a unique 6-character task ID code
 * Format: T + 5 random alphanumeric characters (uppercase letters and digits)
 * Example: T9B4L1, TA5E9Z, T0X3M7
 */
const generateTaskIdCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'T'; // Always start with 'T'
  
  // Generate 5 random characters
  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }
  
  return code;
};

/**
 * Generate a unique task ID code with database uniqueness check
 * @param {Function} checkExists - Async function that checks if a code exists in DB
 * @returns {Promise<string>} - A unique task ID code
 */
const generateUniqueTaskIdCode = async (checkExists) => {
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loops
  
  while (attempts < maxAttempts) {
    const code = generateTaskIdCode();
    
    // Check if this code already exists
    const exists = await checkExists(code);
    
    if (!exists) {
      return code;
    }
    
    attempts++;
  }
  
  // If we couldn't generate a unique code after maxAttempts, throw error
  throw new Error('Unable to generate unique task ID code after multiple attempts');
};

module.exports = {
  generateTaskIdCode,
  generateUniqueTaskIdCode
};

