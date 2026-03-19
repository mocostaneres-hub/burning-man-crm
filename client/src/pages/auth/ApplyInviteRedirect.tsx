import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { Card, Button } from '../../components/ui';

const ApplyInviteRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      const token = searchParams.get('invite_token') || searchParams.get('invite');
      if (!token) {
        setError('Missing invite token.');
        return;
      }

      try {
        const result = await api.get(`/invites/validate/${token}`);
        const campSlug = result?.campSlug;
        if (!campSlug) {
          throw new Error('Invalid invitation link');
        }
        localStorage.setItem('pendingInvite', JSON.stringify({ token, campSlug }));
        if (!isMounted) return;
        navigate(`/camps/${campSlug}?invite_token=${token}`, { replace: true });
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.response?.data?.message || err?.message || 'Invalid invitation link.');
      }
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-custom-bg p-4">
      <Card className="w-full max-w-lg p-6 text-center">
        <h1 className="text-xl font-semibold mb-3">Preparing your application link...</h1>
        {error ? (
          <>
            <p className="text-red-600 mb-4">{error}</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => navigate('/register')}>
                Create Account
              </Button>
              <Button variant="primary" onClick={() => navigate('/login')}>
                Sign In
              </Button>
            </div>
          </>
        ) : (
          <p className="text-gray-600">Please wait while we load your camp application.</p>
        )}
      </Card>
    </div>
  );
};

export default ApplyInviteRedirect;
