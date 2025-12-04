import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const Impersonate: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    // Call the backend impersonation endpoint
    const handleImpersonation = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://api.g8road.com'}/api/auth/impersonate?token=${token}`, {
          method: 'GET',
          credentials: 'include'
        });

        if (response.ok) {
          // The backend returns HTML that sets localStorage and redirects
          // We'll handle it by reading the HTML response
          const html = await response.text();
          
          // Extract token and redirect URL from the HTML
          const tokenMatch = html.match(/localStorage\.setItem\('token', '([^']+)'\)/);
          const redirectMatch = html.match(/window\.location\.href = '([^']+)'/);
          
          if (tokenMatch && redirectMatch) {
            const userToken = tokenMatch[1];
            const redirectUrl = redirectMatch[1];
            
            // Set token in localStorage
            localStorage.setItem('token', userToken);
            
            // Reload the page to trigger auth context update
            window.location.href = redirectUrl;
          } else {
            // Fallback: if we can't parse, just redirect to the HTML response
            document.open();
            document.write(html);
            document.close();
          }
        } else {
          const error = await response.json();
          alert(error.message || 'Invalid or expired impersonation token');
          navigate('/login', { replace: true });
        }
      } catch (error) {
        console.error('Impersonation error:', error);
        alert('Failed to complete impersonation. Please try again.');
        navigate('/login', { replace: true });
      }
    };

    handleImpersonation();
  }, [token, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-custom-primary mx-auto mb-4" />
        <p className="text-custom-text">Logging in...</p>
      </div>
    </div>
  );
};

export default Impersonate;

