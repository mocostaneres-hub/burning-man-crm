import React, { useEffect, useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { Button, Card } from '../components/ui';
import { Chrome, CheckCircle, X, AlertTriangle } from 'lucide-react';
import Footer from '../components/layout/Footer';

const TestGoogleOAuth: React.FC = () => {
  const [configStatus, setConfigStatus] = useState<{
    clientId: string | undefined;
    isConfigured: boolean;
    currentOrigin: string;
    error: string | null;
  }>({
    clientId: undefined,
    isConfigured: false,
    currentOrigin: '',
    error: null
  });

  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    const isConfigured = !!clientId && clientId !== 'not-configured';
    const currentOrigin = window.location.origin;
    
    setConfigStatus({
      clientId,
      isConfigured,
      currentOrigin,
      error: null
    });
  }, []);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    console.log('✅ Google OAuth Success:', credentialResponse);
    
    try {
      if (!credentialResponse.credential) {
        setConfigStatus(prev => ({ ...prev, error: 'No credential received from Google' }));
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
      console.log('🔍 Decoded Google User:', googleUser);

      // Validate required fields
      if (!googleUser.email || !googleUser.name || !googleUser.sub) {
        setConfigStatus(prev => ({ ...prev, error: 'Invalid Google user data received' }));
        return;
      }

      // Test the API call
      const response = await fetch('http://127.0.0.1:5001/api/oauth/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: googleUser.email,
          name: googleUser.name,
          googleId: googleUser.sub,
          profilePicture: googleUser.picture || ''
        })
      });

      console.log('🔍 API Response Status:', response.status);
      console.log('🔍 API Response Headers:', response.headers);

      const responseData = await response.json();
      console.log('🔍 API Response Data:', responseData);

      if (response.ok && responseData.token && responseData.user) {
        setConfigStatus(prev => ({ ...prev, error: null }));
        console.log('✅ OAuth flow completed successfully!');
      } else {
        setConfigStatus(prev => ({ 
          ...prev, 
          error: `API Error: ${responseData.message || 'Unknown error'}` 
        }));
      }
    } catch (error: any) {
      console.error('❌ OAuth Error:', error);
      setConfigStatus(prev => ({ 
        ...prev, 
        error: `Error: ${error.message || 'Unknown error occurred'}` 
      }));
    }
  };

  const handleGoogleError = () => {
    console.error('❌ Google OAuth Error');
    setConfigStatus(prev => ({ 
      ...prev, 
      error: 'Google OAuth error occurred' 
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Google OAuth Configuration Test
          </h1>
          <p className="text-gray-600">
            This page helps debug Google OAuth configuration issues
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Configuration Status */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Configuration Status
            </h2>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className={`w-4 h-4 ${configStatus.isConfigured ? 'text-green-500' : 'text-red-500'}`} />
                <span className="text-sm">
                  Client ID: {configStatus.isConfigured ? 'Configured' : 'Not configured'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-500" />
                <span className="text-sm">
                  Current Origin: {configStatus.currentOrigin}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-500" />
                <span className="text-sm">
                  Client ID: {configStatus.clientId ? `${configStatus.clientId.substring(0, 20)}...` : 'Not set'}
                </span>
              </div>
            </div>

            {configStatus.error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-700">
                    Error: {configStatus.error}
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* Google OAuth Test */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Chrome className="w-5 h-5" />
              Google OAuth Test
            </h2>
            
            {configStatus.isConfigured ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Click the button below to test Google OAuth:
                </p>
                
                <GoogleOAuthProvider clientId={configStatus.clientId!}>
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
            ) : (
              <div className="text-center py-8">
                <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-600">
                  Google OAuth is not properly configured
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Check your environment variables
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-6 p-6">
          <h2 className="text-xl font-semibold mb-4">Google Cloud Console Configuration</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Authorized JavaScript origins:</h3>
              <div className="bg-gray-100 p-3 rounded-md font-mono text-sm">
                <div>https://www.g8road.com</div>
                <div>https://g8road.com</div>
                <div>http://localhost:3000</div>
                <div>http://127.0.0.1:3000</div>
                <div>http://localhost:3001</div>
                <div>http://127.0.0.1:3001</div>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Authorized redirect URIs:</h3>
              <div className="bg-gray-100 p-3 rounded-md font-mono text-sm">
                <div>http://localhost:3000</div>
                <div>http://localhost:3000/login</div>
                <div>http://localhost:3000/register</div>
                <div>http://127.0.0.1:3000</div>
                <div>http://127.0.0.1:3000/login</div>
                <div>http://127.0.0.1:3000/register</div>
                <div>http://localhost:3001</div>
                <div>http://localhost:3001/login</div>
                <div>http://localhost:3001/register</div>
                <div>http://127.0.0.1:3001</div>
                <div>http://127.0.0.1:3001/login</div>
                <div>http://127.0.0.1:3001/register</div>
                <div>https://www.g8road.com</div>
                <div>https://www.g8road.com/login</div>
                <div>https://www.g8road.com/register</div>
                <div>https://g8road.com</div>
                <div>https://g8road.com/login</div>
                <div>https://g8road.com/register</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
      
      <Footer />
    </div>
  );
};

export default TestGoogleOAuth;
