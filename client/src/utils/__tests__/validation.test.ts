import {
  validateEmail,
  validatePassword,
  validateURL,
  validateSocialMediaURL,
  validatePhoneNumber,
  validateCampName,
  validateRequired,
  validateNumericRange,
  sanitizeInput,
  validateAndSanitizeText
} from '../validation';

describe('Email validation', () => {
  test('should validate correct email addresses', () => {
    expect(validateEmail('test@example.com')).toEqual({ isValid: true });
    expect(validateEmail('user.name+tag@example.co.uk')).toEqual({ isValid: true });
  });

  test('should reject invalid email addresses', () => {
    expect(validateEmail('invalid-email')).toEqual({
      isValid: false,
      message: 'Please enter a valid email address'
    });
    expect(validateEmail('')).toEqual({
      isValid: false,
      message: 'Email is required'
    });
  });
});

describe('Password validation', () => {
  test('should validate strong passwords', () => {
    expect(validatePassword('StrongPass123')).toEqual({ isValid: true });
  });

  test('should reject weak passwords', () => {
    expect(validatePassword('weak')).toEqual({
      isValid: false,
      message: 'Password must be at least 8 characters long'
    });
    expect(validatePassword('nouppercase123')).toEqual({
      isValid: false,
      message: 'Password must contain at least one uppercase letter'
    });
    expect(validatePassword('NOLOWERCASE123')).toEqual({
      isValid: false,
      message: 'Password must contain at least one lowercase letter'
    });
    expect(validatePassword('NoNumbers')).toEqual({
      isValid: false,
      message: 'Password must contain at least one number'
    });
  });
});

describe('URL validation', () => {
  test('should validate correct URLs', () => {
    expect(validateURL('https://example.com')).toEqual({ isValid: true });
    expect(validateURL('http://test.org/path')).toEqual({ isValid: true });
    expect(validateURL('')).toEqual({ isValid: true }); // Empty is valid (optional)
  });

  test('should reject invalid URLs', () => {
    expect(validateURL('not-a-url')).toEqual({
      isValid: false,
      message: 'Please enter a valid URL (must start with http:// or https://)'
    });
  });
});

describe('Social media URL validation', () => {
  test('should validate Instagram URLs', () => {
    expect(validateSocialMediaURL('https://instagram.com/username', 'instagram')).toEqual({ isValid: true });
    expect(validateSocialMediaURL('https://www.instagram.com/username', 'instagram')).toEqual({ isValid: true });
  });

  test('should validate Facebook URLs', () => {
    expect(validateSocialMediaURL('https://facebook.com/username', 'facebook')).toEqual({ isValid: true });
    expect(validateSocialMediaURL('https://www.facebook.com/username', 'facebook')).toEqual({ isValid: true });
  });

  test('should reject invalid social media URLs', () => {
    expect(validateSocialMediaURL('https://twitter.com/user', 'instagram')).toEqual({
      isValid: false,
      message: 'Please enter a valid instagram URL'
    });
  });
});

describe('Phone number validation', () => {
  test('should validate US phone numbers', () => {
    expect(validatePhoneNumber('(555) 123-4567')).toEqual({ isValid: true });
    expect(validatePhoneNumber('555-123-4567')).toEqual({ isValid: true });
    expect(validatePhoneNumber('5551234567')).toEqual({ isValid: true });
    expect(validatePhoneNumber('')).toEqual({ isValid: true }); // Empty is valid (optional)
  });

  test('should reject invalid phone numbers', () => {
    expect(validatePhoneNumber('123')).toEqual({
      isValid: false,
      message: 'Please enter a valid phone number'
    });
  });
});

describe('Camp name validation', () => {
  test('should validate camp names', () => {
    expect(validateCampName('Valid Camp Name')).toEqual({ isValid: true });
  });

  test('should reject invalid camp names', () => {
    expect(validateCampName('')).toEqual({
      isValid: false,
      message: 'Camp name is required'
    });
    expect(validateCampName('A')).toEqual({
      isValid: false,
      message: 'Camp name must be at least 2 characters long'
    });
    expect(validateCampName('A'.repeat(101))).toEqual({
      isValid: false,
      message: 'Camp name must be less than 100 characters'
    });
  });
});

describe('Input sanitization', () => {
  test('should sanitize dangerous characters', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert(xss)/script');
    expect(sanitizeInput('Normal text')).toBe('Normal text');
    expect(sanitizeInput('  Trimmed  ')).toBe('Trimmed');
  });
});

describe('Text validation and sanitization', () => {
  test('should validate and sanitize text input', () => {
    const result = validateAndSanitizeText('Valid text', 'Test Field', true);
    expect(result.value).toBe('Valid text');
    expect(result.validation.isValid).toBe(true);
  });

  test('should handle required field validation', () => {
    const result = validateAndSanitizeText('', 'Test Field', true);
    expect(result.value).toBe('');
    expect(result.validation.isValid).toBe(false);
    expect(result.validation.message).toBe('Test Field is required');
  });

  test('should enforce max length', () => {
    const longText = 'A'.repeat(50);
    const result = validateAndSanitizeText(longText, 'Test Field', false, 10);
    expect(result.value).toBe('A'.repeat(10));
    expect(result.validation.isValid).toBe(false);
    expect(result.validation.message).toBe('Test Field must be less than 10 characters');
  });
});

