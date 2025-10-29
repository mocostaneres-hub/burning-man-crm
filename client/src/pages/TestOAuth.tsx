import React, { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import Footer from '../components/layout/Footer';

const TestOAuth: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSuccess = (credentialResponse: any) => {
    console.log('Success:', credentialResponse);
    setResult(JSON.stringify(credentialResponse, null, 2));
    setError('');
    
    // Try to decode the JWT token
    if (credentialResponse.credential) {
      try {
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
        setResult(prev => prev + '\n\nDecoded user data:\n' + JSON.stringify(googleUser, null, 2));
      } catch (e) {
        console.error('Error decoding JWT:', e);
        setError('Error decoding JWT token: ' + e);
      }
    }
  };

  const handleError = () => {
    console.error('Google OAuth error occurred');
    setError('Google sign-in failed. Please try again.');
    setResult('');
  };

  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Google OAuth Test</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          <p><strong>Client ID:</strong> {clientId || 'Not configured'}</p>
          <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Google OAuth</h2>
          {clientId ? (
            <GoogleOAuthProvider clientId={clientId}>
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={handleError}
                useOneTap={false}
                auto_select={false}
                theme="outline"
                size="large"
                width="100%"
                text="signin_with"
                shape="rectangular"
                logo_alignment="left"
              />
            </GoogleOAuthProvider>
          ) : (
            <p className="text-red-500">Google Client ID not configured</p>
          )}
        </div>

        {result && (
          <div className="bg-green-50 p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4 text-green-800">Success Result</h2>
            <pre className="bg-white p-4 rounded border overflow-auto text-sm">
              {result}
            </pre>
          </div>
        )}

        {error && (
          <div className="bg-red-50 p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4 text-red-800">Error Result</h2>
            <pre className="bg-white p-4 rounded border overflow-auto text-sm">
              {error}
            </pre>
          </div>
        )}

        <div className="bg-blue-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-blue-800">Troubleshooting Steps</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>Check browser console for detailed error messages</li>
            <li>Verify Google Client ID is correct</li>
            <li>Ensure your domain is authorized in Google Console</li>
            <li>Check that the Google OAuth script is loaded</li>
            <li>Try in an incognito window to avoid cached issues</li>
          </ol>
        </div>
      </div>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default TestOAuth;
