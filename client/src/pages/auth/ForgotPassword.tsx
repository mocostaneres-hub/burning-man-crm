import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, Card, Input } from '../../components/ui';
import { Loader2 } from 'lucide-react';
import apiService from '../../services/api';
import Footer from '../../components/layout/Footer';

type Status = 'idle' | 'submitting' | 'success' | 'error' | 'not_found' | 'network_error';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [emailError, setEmailError] = useState('');

  const validateEmail = (value: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (!re.test(value.trim())) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    if (!validateEmail(email)) return;

    setStatus('submitting');
    try {
      const response = await apiService.post('/auth/forgot-password', {
        email: email.trim().toLowerCase()
      });
      setStatus('success');
      setMessage(response?.message || 'Check your email for a reset link.');
    } catch (err: any) {
      const data = err.response?.data;
      const status = err.response?.status;
      if (status === 404 && data?.message) {
        setStatus('not_found');
        setMessage(data.message);
      } else if (status === 429) {
        setStatus('error');
        setMessage(data?.message || 'Too many attempts. Please try again later.');
      } else if (err.message === 'Network Error' || !err.response) {
        setStatus('network_error');
        setMessage('Network error. Please check your connection and try again.');
      } else {
        setStatus('error');
        setMessage(data?.message || 'Something went wrong. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-custom-bg flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8">
          <h1 className="text-2xl font-bold text-custom-text mb-2">Forgot Password?</h1>
          <p className="text-custom-text-secondary text-sm mb-6">
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>

          {status === 'success' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
              {message}
            </div>
          )}
          {(status === 'not_found' || status === 'error' || status === 'network_error') && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {message}
            </div>
          )}

          {status !== 'success' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                }}
                error={emailError}
                placeholder="you@example.com"
                className="w-full"
                autoComplete="email"
                disabled={status === 'submitting'}
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={status === 'submitting'}
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="animate-spin h-5 w-5 mr-2 inline" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>
          )}

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

export default ForgotPassword;
