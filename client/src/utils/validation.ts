/**
 * Validation utilities for the CRM application
 */

// Email validation regex (RFC 5322 compliant)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// URL validation regex
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

// Social media platform URL patterns
const SOCIAL_PATTERNS = {
  instagram: /^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?$/,
  facebook: /^https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9_.]+\/?$/,
  linkedin: /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[a-zA-Z0-9-]+\/?$/,
  twitter: /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+\/?$/,
  tiktok: /^https?:\/\/(www\.)?tiktok\.com\/@[a-zA-Z0-9_.]+\/?$/,
};

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * Validate email address
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email) {
    return { isValid: false, message: 'Email is required' };
  }
  
  if (!EMAIL_REGEX.test(email)) {
    return { isValid: false, message: 'Please enter a valid email address' };
  }
  
  return { isValid: true };
};

/**
 * Validate password strength
 */
export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/(?=.*\d)/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }
  
  return { isValid: true };
};

/**
 * Validate URL format
 */
export const validateURL = (url: string): ValidationResult => {
  if (!url) {
    return { isValid: true }; // URLs are often optional
  }
  
  if (!URL_REGEX.test(url)) {
    return { isValid: false, message: 'Please enter a valid URL (must start with http:// or https://)' };
  }
  
  return { isValid: true };
};

/**
 * Validate social media URL for specific platform
 */
export const validateSocialMediaURL = (
  url: string, 
  platform: keyof typeof SOCIAL_PATTERNS
): ValidationResult => {
  if (!url) {
    return { isValid: true }; // Social media URLs are optional
  }
  
  const pattern = SOCIAL_PATTERNS[platform];
  if (!pattern.test(url)) {
    return { 
      isValid: false, 
      message: `Please enter a valid ${platform} URL` 
    };
  }
  
  return { isValid: true };
};

/**
 * Validate phone number (basic US format)
 */
export const validatePhoneNumber = (phone: string): ValidationResult => {
  if (!phone) {
    return { isValid: true }; // Phone is often optional
  }
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length < 10 || digits.length > 11) {
    return { isValid: false, message: 'Please enter a valid phone number' };
  }
  
  return { isValid: true };
};

/**
 * Validate camp name
 */
export const validateCampName = (name: string): ValidationResult => {
  if (!name?.trim()) {
    return { isValid: false, message: 'Camp name is required' };
  }
  
  if (name.trim().length < 2) {
    return { isValid: false, message: 'Camp name must be at least 2 characters long' };
  }
  
  if (name.trim().length > 100) {
    return { isValid: false, message: 'Camp name must be less than 100 characters' };
  }
  
  return { isValid: true };
};

/**
 * Validate required text field
 */
export const validateRequired = (value: string, fieldName: string): ValidationResult => {
  if (!value?.trim()) {
    return { isValid: false, message: `${fieldName} is required` };
  }
  
  return { isValid: true };
};

/**
 * Validate numeric value within range
 */
export const validateNumericRange = (
  value: number, 
  min: number, 
  max: number, 
  fieldName: string
): ValidationResult => {
  if (isNaN(value)) {
    return { isValid: false, message: `${fieldName} must be a number` };
  }
  
  if (value < min || value > max) {
    return { 
      isValid: false, 
      message: `${fieldName} must be between ${min} and ${max}` 
    };
  }
  
  return { isValid: true };
};

/**
 * Sanitize input to prevent XSS
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  return input
    .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
    .trim();
};

/**
 * Validate and sanitize text input
 */
export const validateAndSanitizeText = (
  input: string, 
  fieldName: string,
  required: boolean = false,
  maxLength: number = 1000
): { value: string; validation: ValidationResult } => {
  const sanitized = sanitizeInput(input);
  
  if (required && !sanitized) {
    return {
      value: sanitized,
      validation: { isValid: false, message: `${fieldName} is required` }
    };
  }
  
  if (sanitized.length > maxLength) {
    return {
      value: sanitized.substring(0, maxLength),
      validation: { isValid: false, message: `${fieldName} must be less than ${maxLength} characters` }
    };
  }
  
  return {
    value: sanitized,
    validation: { isValid: true }
  };
};
