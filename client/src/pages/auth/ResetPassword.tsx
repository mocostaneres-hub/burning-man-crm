import React, { useState, useEffect } from 'react';
import { useSearchParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { Button, Card, Input } from '../../components/ui';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import apiService from '../../services/api';
import Footer from '../../components/layout/Footer';

const MIN_PASSWORD_LENGTH = 6;

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ newPassword?: string; confirm?: string }>({});

  useEffect(() => {
    if (!token.trim()) {
      setError('Invalid reset link. Request a new password reset from the login page.');
    }
  }, [token]);

  const validate = (): boolean => {
    const err: { newPassword?: string; confirm?: string } = {};
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      err.newPassword = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (newPassword !== confirmPassword) {
      err.confirm = 'Passwords do not match';
    }
    setFieldErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validate() || !token) return;

    setLoading(true);
    try {
      await apiService.post('/auth/reset-password', {
        token: token.trim(),
        newPassword
      });
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token.trim()) {
    return (
      <div className="min-h-screen bg-custom-bg flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md p-8">
            <h1 className="text-2xl font-bold text-custom-text mb-2">Invalid Link</h1>
            <p className="text-red-600 text-sm mb-6">{error}</p>
            <RouterLink to="/forgot-password" className="text-custom-primary hover:underline">
              Request a new reset link
            </RouterLink>
            <div className="mt-4">
              <RouterLink to="/login" className="text-custom-primary hover:underline text-sm">
                Back to Sign In
              </RouterLink>
            </div>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-custom-bg flex flex-col">
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md p-8">
            <h1 className="text-2xl font-bold text-custom-text mb-2">Password Reset</h1>
            <p className="text-green-700 text-sm mb-6">
              Your password has been updated. Redirecting you to sign in...
            </p>
            <RouterLink to="/login" className="text-custom-primary hover:underline text-sm">
              Go to Sign In now
            </RouterLink>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-custom-bg flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8">
          <h1 className="text-2xl font-bold text-custom-text mb-2">Set New Password</h1>
          <p className="text-custom-text-secondary text-sm mb-6">
            Enter your new password below. It must be at least {MIN_PASSWORD_LENGTH} characters.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <Input
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={fieldErrors.newPassword}
                className="w-full pr-10"
                autoComplete="new-password"
                disabled={loading}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center top-8"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-custom-text-secondary" />
                ) : (
                  <Eye className="h-5 w-5 text-custom-text-secondary" />
                )}
              </button>
            </div>
            <Input
              label="Confirm Password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={fieldErrors.confirm}
              className="w-full"
              autoComplete="new-password"
              disabled={loading}
            />
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-5 w-5 mr-2 inline" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <RouterLink
              to="/login"
              className="text-custom-primary hover:text-green-700 text-sm font-medium"
            >
              Back to Sign In
            </RouterLink>
          </div>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default ResetPassword;
