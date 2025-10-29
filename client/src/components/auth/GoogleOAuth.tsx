import React, { useEffect } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { Button } from '../ui';
import { Chrome } from 'lucide-react';
import api from '../../services/api';

interface GoogleOAuthProps {
  onSuccess: (user: any) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

const GoogleOAuth: React.FC<GoogleOAuthProps> = ({ onSuccess, onError, disabled = false }) => {
  // Check if Google OAuth is properly configured
  const googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const isConfigured = !!googleClientId && googleClientId !== 'not-configured';
  
  useEffect(() => {
    if (!isConfigured && process.env.NODE_ENV === 'development') {
      console.warn('Google OAuth not properly configured');
    }
  }, [isConfigured]);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      console.log('🔍 [GoogleOAuth] Credential response received:', credentialResponse);
      
      if (!credentialResponse.credential) {
        console.error('❌ [GoogleOAuth] No credential in response');
        onError('No credential received from Google');
        return;
      }

      // Decode the JWT token to get user info
      const base64Url = credentialResponse.credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      const googleUser = JSON.parse(jsonPayload);
      console.log('🔍 [GoogleOAuth] Decoded Google user:', googleUser);

      // Validate required fields
      if (!googleUser.email || !googleUser.name || !googleUser.sub) {
        console.error('❌ [GoogleOAuth] Invalid Google user data:', googleUser);
        onError('Invalid Google user data received');
        return;
      }

      console.log('🔍 [GoogleOAuth] Sending request to backend...');
      
      // Send to backend
      const response = await api.post('/oauth/google', {
        email: googleUser.email,
        name: googleUser.name,
        googleId: googleUser.sub,
        profilePicture: googleUser.picture || ''
      });

      console.log('🔍 [GoogleOAuth] Backend response:', response);
      console.log('🔍 [GoogleOAuth] Response data:', response?.data);

      if (response && response.data && response.data.token && response.data.user) {
        console.log('✅ [GoogleOAuth] Authentication successful');
        // Store token and user data
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        onSuccess(response.data.user);
      } else {
        console.error('❌ [GoogleOAuth] Invalid response structure:', response);
        onError('Failed to authenticate with Google - invalid response');
      }
    } catch (error: any) {
      console.error('❌ [GoogleOAuth] Error occurred:', error);
      console.error('❌ [GoogleOAuth] Error response:', error.response);
      console.error('❌ [GoogleOAuth] Error data:', error.response?.data);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to sign in with Google. Please try again.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors?.[0]?.msg) {
        errorMessage = error.response.data.errors[0].msg;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.error('❌ [GoogleOAuth] Final error message:', errorMessage);
      onError(errorMessage);
    }
  };

  const handleGoogleError = () => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Google OAuth error occurred');
    }
    onError('Google sign-in was cancelled or failed. Please try again.');
  };

  if (!isConfigured) {
    return (
      <div className="w-full">
        <Button
          variant="outline"
          size="lg"
          disabled={true}
          className="w-full"
        >
          <Chrome className="w-5 h-5 mr-2" />
          Google Sign-in (Setup Required)
        </Button>
        <p className="text-sm text-custom-text-secondary mt-2 text-center">
          Google OAuth needs to be configured
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <GoogleOAuthProvider clientId={googleClientId}>
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          useOneTap={false}
          auto_select={false}
          cancel_on_tap_outside={true}
          theme="outline"
          size="large"
          width="100%"
          text="signin_with"
          shape="rectangular"
          logo_alignment="left"
        />
      </GoogleOAuthProvider>
    </div>
  );
};

export default GoogleOAuth;
