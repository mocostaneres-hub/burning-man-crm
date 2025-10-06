/**
 * Environment configuration utilities
 */

interface EnvironmentConfig {
  API_URL: string;
  GOOGLE_CLIENT_ID?: string;
  NODE_ENV: string;
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;
}

/**
 * Get and validate environment configuration
 */
export const getEnvironmentConfig = (): EnvironmentConfig => {
  const API_URL = process.env.REACT_APP_API_URL;
  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const NODE_ENV = process.env.NODE_ENV || 'development';

  // Validate required environment variables
  if (!API_URL) {
    throw new Error('REACT_APP_API_URL environment variable is required');
  }

  // Validate API URL format
  try {
    new URL(API_URL);
  } catch (error) {
    throw new Error(`Invalid REACT_APP_API_URL format: ${API_URL}`);
  }

  return {
    API_URL,
    GOOGLE_CLIENT_ID,
    NODE_ENV,
    isProduction: NODE_ENV === 'production',
    isDevelopment: NODE_ENV === 'development',
    isTest: NODE_ENV === 'test',
  };
};

/**
 * Check if OAuth is properly configured
 */
export const isOAuthConfigured = (): boolean => {
  const config = getEnvironmentConfig();
  return !!config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_ID !== 'not-configured';
};

/**
 * Get safe environment info for logging (no secrets)
 */
export const getSafeEnvironmentInfo = () => {
  const config = getEnvironmentConfig();
  
  return {
    NODE_ENV: config.NODE_ENV,
    hasAPIURL: !!config.API_URL,
    hasGoogleClientID: !!config.GOOGLE_CLIENT_ID,
    isProduction: config.isProduction,
    isDevelopment: config.isDevelopment,
  };
};
