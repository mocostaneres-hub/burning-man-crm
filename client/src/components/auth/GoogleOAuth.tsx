import React from 'react';
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
  
  if (!isConfigured) {
    console.warn('Google OAuth not properly configured');
  }

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      console.log('Google OAuth response:', credentialResponse);
      
      if (!credentialResponse.credential) {
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
      console.log('Decoded Google user:', googleUser);

      // Send to backend
      const response = await api.post('/oauth/google', {
        email: googleUser.email,
        name: googleUser.name,
        googleId: googleUser.sub,
        profilePicture: googleUser.picture
      });

      if (response.data.token && response.data.user) {
        // Store token and user data
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        onSuccess(response.data.user);
      } else {
        onError('Failed to authenticate with Google');
      }
    } catch (error: any) {
      console.error('Google OAuth error:', error);
      console.error('Error details:', error.response?.data);
      onError(error.response?.data?.message || 'Failed to sign in with Google');
    }
  };

  const handleGoogleError = () => {
    console.error('Google OAuth error occurred');
    onError('Google sign-in failed. Please try again.');
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
