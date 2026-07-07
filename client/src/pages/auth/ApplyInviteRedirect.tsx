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
      const campIdentifier = searchParams.get('camp') || searchParams.get('camp_id');

      if (campIdentifier) {
        try {
          const camp = await api.get(`/camps/public/${encodeURIComponent(campIdentifier)}`);
          const resolvedCampIdentifier = camp?.slug || camp?._id || campIdentifier;
          const target = `/camps/${encodeURIComponent(resolvedCampIdentifier)}?apply=1&source=camp_invite`;

          if (!isMounted) return;
          navigate(target, { replace: true });
        } catch (err: any) {
          if (!isMounted) return;
          setError(err?.response?.data?.message || err?.message || 'Invalid camp application link.');
        }
        return;
      }

      if (!token) {
        setError('Missing invitation details.');
        return;
      }

      try {
        const result = await api.get(`/invites/validate/${token}`);
        const campIdentifier = result?.campSlug || result?.campId;
        if (!campIdentifier) {
          throw new Error('Invalid invitation link');
        }
        const pendingInvite = {
          token,
          campSlug: campIdentifier,
          campId: result?.campId,
          mode: result?.isShiftsOnlyInvite ? 'shifts_only' : 'standard'
        };
        localStorage.setItem('pendingInvite', JSON.stringify(pendingInvite));
        if (!isMounted) return;
        if (result?.isShiftsOnlyInvite) {
          navigate(`/register?invite_token=${token}&shifts_only=1`, { replace: true });
        } else {
          navigate(`/camps/${campIdentifier}?invite_token=${token}`, { replace: true });
        }
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
