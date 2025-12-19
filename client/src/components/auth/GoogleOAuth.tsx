import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../ui';
import api from '../../services/api';

// Google Identity Services type definitions
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          prompt: () => void;
          renderButton: (
            element: HTMLElement,
            config: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

interface GoogleOAuthProps {
  onSuccess: (user: any) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  mode?: 'signin' | 'signup'; // For different button text
}

/**
 * GoogleOAuth Component
 * 
 * Implements Google Sign-In using Google Identity Services (GIS)
 * 
 * Mobile Compatibility:
 * - Web: Uses Google Identity Services JavaScript library
 * - iOS: Will use Google Sign-In SDK (native) - calls same backend endpoint
 * - Android: Will use Google Sign-In SDK (native) - calls same backend endpoint
 * 
 * The backend endpoint (/api/oauth/google) accepts ID tokens from any platform
 * and verifies them server-side, making this implementation platform-agnostic.
 * 
 * Common Failure Points:
 * - Missing GOOGLE_CLIENT_ID in environment variables
 * - Google Identity Services script not loaded
 * - Network errors during token verification
 * - Invalid or expired ID tokens
 */
const GoogleOAuth: React.FC<GoogleOAuthProps> = ({ 
  onSuccess, 
  onError, 
  disabled = false,
  mode = 'signin'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  // Load Google OAuth configuration from backend
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await api.get('/oauth/config');
        const clientId = config.google?.clientId;
        const enabled = config.google?.enabled;

        if (enabled && clientId) {
          setGoogleClientId(clientId);
          setIsConfigured(true);
        } else {
          console.warn('⚠️ [GoogleOAuth] Google OAuth not configured on server');
          setIsConfigured(false);
        }
      } catch (error) {
        console.error('❌ [GoogleOAuth] Failed to load OAuth config:', error);
        setIsConfigured(false);
      }
    };

    loadConfig();
  }, []);

  // Load Google Identity Services script
  useEffect(() => {
    if (!isConfigured || !googleClientId) return;

    // Check if script is already loaded
    if (window.google?.accounts?.id) {
      initializeGoogleSignIn();
      return;
    }

    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('✅ [GoogleOAuth] Google Identity Services loaded');
      initializeGoogleSignIn();
    };
    script.onerror = () => {
      console.error('❌ [GoogleOAuth] Failed to load Google Identity Services');
      onError('Failed to load Google Sign-In. Please refresh the page.');
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup: remove script if component unmounts
      const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [isConfigured, googleClientId]);

  // Initialize Google Sign-In
  const initializeGoogleSignIn = () => {
    if (!window.google?.accounts?.id || !googleClientId || isInitialized.current) {
      return;
    }

    try {
      // Initialize Google Identity Services
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleCredentialResponse,
      });

      // Render the button
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          text: mode === 'signup' ? 'signup_with' : 'signin_with',
          width: 300,
        });
      }

      isInitialized.current = true;
      console.log('✅ [GoogleOAuth] Google Sign-In initialized');
    } catch (error) {
      console.error('❌ [GoogleOAuth] Failed to initialize Google Sign-In:', error);
      onError('Failed to initialize Google Sign-In');
    }
  };

  // Handle Google credential response (ID token)
  const handleCredentialResponse = async (response: { credential: string }) => {
    if (!response.credential) {
      onError('No credential received from Google');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔄 [GoogleOAuth] Sending ID token to backend for verification...');

      // Send ID token to backend for verification
      // Backend will verify the token and create/update user account
      const apiResponse = await api.post('/oauth/google', {
        idToken: response.credential,
      });

      if (apiResponse.token && apiResponse.user) {
        // Store token and user data
        localStorage.setItem('token', apiResponse.token);
        localStorage.setItem('user', JSON.stringify(apiResponse.user));

        console.log('✅ [GoogleOAuth] Authentication successful');
        onSuccess(apiResponse.user);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error('❌ [GoogleOAuth] Authentication failed:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to sign in with Google';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      onError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Manual trigger (for testing or custom button)
  const handleManualSignIn = () => {
    if (!window.google?.accounts?.id || disabled || isLoading) {
      return;
    }

    try {
      window.google.accounts.id.prompt();
    } catch (error) {
      console.error('❌ [GoogleOAuth] Failed to trigger sign-in:', error);
      onError('Failed to trigger Google Sign-In');
    }
  };

  // Don't render if not configured
  if (!isConfigured) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Google's official button will be rendered here */}
      <div 
        ref={buttonRef} 
        className="w-full flex justify-center"
        style={{ minHeight: '40px' }}
      />
      
      {/* Loading state */}
      {isLoading && (
        <div className="mt-2 text-sm text-center text-gray-600">
          Verifying with Google...
        </div>
      )}
    </div>
  );
};

export default GoogleOAuth;

