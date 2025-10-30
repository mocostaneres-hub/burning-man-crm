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
      console.log('🔍 [GoogleOAuth] Response itself:', response);

      // The API service might return data directly or wrapped in .data
      const responseData = response?.data || response;
      console.log('🔍 [GoogleOAuth] Extracted response data:', responseData);
      console.log('🔍 [GoogleOAuth] Checking conditions...');
      console.log('🔍 [GoogleOAuth] responseData exists?', !!responseData);
      console.log('🔍 [GoogleOAuth] responseData.token exists?', !!responseData?.token);
      console.log('🔍 [GoogleOAuth] responseData.user exists?', !!responseData?.user);

      if (responseData && responseData.token && responseData.user) {
        console.log('✅ [GoogleOAuth] Authentication successful');
        console.log('🔍 [GoogleOAuth] About to store token and call onSuccess...');
        
        // Store token and user data
        localStorage.setItem('token', responseData.token);
        localStorage.setItem('user', JSON.stringify(responseData.user));
        
        console.log('🔍 [GoogleOAuth] Token stored, now calling onSuccess with:', responseData.user);
        console.log('🔍 [GoogleOAuth] onSuccess function:', onSuccess);
        
        onSuccess(responseData.user);
        
        console.log('🔍 [GoogleOAuth] onSuccess called successfully');
      } else {
        console.error('❌ [GoogleOAuth] Invalid response structure:', response);
        console.error('❌ [GoogleOAuth] Response data was:', responseData);
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

  // If not configured, don't render anything (hide Google OAuth completely)
  if (!isConfigured) {
    return null;
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
