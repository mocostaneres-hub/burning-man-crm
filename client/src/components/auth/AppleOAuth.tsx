import React from 'react';
import { Button } from '../ui';
import { Apple } from 'lucide-react';
import AppleSignin from 'react-apple-signin-auth';
import api from '../../services/api';

interface AppleOAuthProps {
  onSuccess: (user: any) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  /**
   * Optional invite token (SOR or standard). Forwarded to
   * POST /api/oauth/apple so the backend can link the just-created User
   * to the camp's pre-existing Member document. See GoogleOAuthProps.inviteToken
   * for full rationale.
   */
  inviteToken?: string | null;
  signupIntent?: 'member_application' | null;
  applicationCampIdentifier?: string | null;
}

const AppleOAuth: React.FC<AppleOAuthProps> = ({
  onSuccess,
  onError,
  disabled = false,
  inviteToken = null,
  signupIntent = null,
  applicationCampIdentifier = null
}) => {
  // Check if Apple OAuth is properly configured
  const appleClientId = process.env.REACT_APP_APPLE_CLIENT_ID;
  const isConfigured = appleClientId && appleClientId !== 'your-apple-client-id-here';

  const handleAppleSuccess = (response: any) => {
    try {
      console.log('Apple OAuth response:', response);

      // Extract user info from Apple response
      const { email, fullName, user } = response;
      
      // Send to backend (forward inviteToken when present so SOR roster
      // can bind the new User → existing Member; see GoogleOAuth handler
      // for full rationale).
      api.post('/oauth/apple', {
        email: email || user,
        name: fullName ? `${fullName.givenName || ''} ${fullName.familyName || ''}` : '',
        appleId: user,
        profilePicture: '', // Apple doesn't provide profile pictures
        ...(inviteToken ? { inviteToken } : {}),
        ...(signupIntent && applicationCampIdentifier
          ? { signupIntent, applicationCampIdentifier }
          : {})
      }).then((apiResponse: any) => {
        if (apiResponse.token && apiResponse.user) {
          // Store token and user data
          localStorage.setItem('token', apiResponse.token);
          localStorage.setItem('user', JSON.stringify(apiResponse.user));
          onSuccess(apiResponse);
        } else {
          onError('Failed to authenticate with Apple');
        }
      }).catch((error) => {
        console.error('Apple OAuth API error:', error);
        onError('Failed to authenticate with Apple');
      });
    } catch (error: any) {
      console.error('Apple OAuth error:', error);
      onError(error.response?.data?.message || 'Failed to sign in with Apple');
    }
  };

  const handleAppleError = (error: any) => {
    console.error('Apple OAuth error:', error);
    onError('Apple sign-in was cancelled or failed');
  };

  if (!isConfigured) {
    return (
      <div className="w-full">
        <Button
          variant="outline"
          size="lg"
          disabled={true}
          className="w-full bg-black text-white border-black hover:bg-gray-800 hover:border-gray-800 disabled:bg-gray-300 disabled:text-gray-600 disabled:border-gray-300"
        >
          <Apple className="w-5 h-5 mr-2" />
          Apple Sign-in (Setup Required)
        </Button>
        <p className="text-sm text-custom-text-secondary mt-2 text-center">
          Apple OAuth needs to be configured
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <AppleSignin
        authOptions={{
          clientId: appleClientId,
          scope: 'email name',
          redirectURI: window.location.origin,
          state: 'state',
          nonce: 'nonce',
          usePopup: true,
        }}
        onSuccess={handleAppleSuccess}
        onError={handleAppleError}
        uiType="dark"
        render={(props: any) => (
          <Button
            {...props}
            variant="outline"
            size="lg"
            disabled={disabled}
            className="w-full bg-black text-white border-black hover:bg-gray-800 hover:border-gray-800 disabled:bg-gray-300 disabled:text-gray-600 disabled:border-gray-300"
          >
            <Apple className="w-5 h-5 mr-2" />
            Continue with Apple
          </Button>
        )}
      />
    </div>
  );
};

export default AppleOAuth;
