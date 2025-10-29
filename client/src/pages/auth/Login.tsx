import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import GoogleOAuth from '../../components/auth/GoogleOAuth';
import AppleOAuth from '../../components/auth/AppleOAuth';
import { Button, Input, Card } from '../../components/ui';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Footer from '../../components/layout/Footer';

const schema = yup.object({
  email: yup.string().email('Invalid email').required('Email is required'),
  password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
}).required();

type FormData = {
  email: string;
  password: string;
};

const Login: React.FC = () => {
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: yupResolver(schema),
  });

  // Redirect authenticated users away from login page
  useEffect(() => {
    console.log('🔍 [Login useEffect] authLoading:', authLoading, 'user:', user);
    
    // Wait for auth to finish loading before checking user status
    if (authLoading) {
      console.log('🔍 [Login] Auth still loading, waiting...');
      return;
    }
    
    if (user) {
      console.log('🔍 [Login] User already authenticated, redirecting...');
      console.log('🔍 [Login] User data:', user);
      console.log('🔍 [Login] User role:', user.role);
      console.log('🔍 [Login] User accountType:', user.accountType);
      
      // Check if user needs onboarding
      if (user.role === 'unassigned' || !user.role) {
        console.log('✅ [Login] Redirecting to onboarding...');
        navigate('/onboarding/select-role', { replace: true });
        return;
      }
      
      // Redirect based on account type
      if (user.accountType === 'camp') {
        console.log('✅ [Login] Redirecting to camp dashboard...');
        navigate('/dashboard', { replace: true });
      } else {
        console.log('✅ [Login] Redirecting to member dashboard...');
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');

    try {
      const result = await login(data.email, data.password);
      
      // Check if user needs onboarding
      if (result.needsOnboarding) {
        navigate('/onboarding/select-role', { replace: true });
        return;
      }
      
      // If this is a first-time login for a camp account, redirect to camp edit page
      if (result.isFirstLogin) {
        navigate('/camp/edit', { replace: true });
      } else {
        // Otherwise, redirect based on the from path or default to /dashboard
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSuccess = (userData: any) => {
    console.log('🔍 [Login] OAuth success callback triggered with userData:', userData);
    
    // Extract user object from the response (GoogleOAuth passes the full API response)
    const user = userData.user || userData;
    
    console.log('🔍 [Login] Extracted user:', user);
    console.log('🔍 [Login] User role:', user.role);
    console.log('🔍 [Login] Needs onboarding?', user.role === 'unassigned' || !user.role);
    
    setOauthLoading(false);
    setError('');
    
    // Check if user needs onboarding
    if (user.role === 'unassigned' || !user.role) {
      console.log('✅ [Login] Redirecting to onboarding...');
      navigate('/onboarding/select-role', { replace: true });
      return;
    }
    
    // Check if this is a new camp account (no lastLogin)
    if (user.accountType === 'camp' && !user.lastLogin) {
      console.log('✅ [Login] Redirecting to camp edit...');
      navigate('/camp/edit', { replace: true });
    } else {
      const from = location.state?.from?.pathname || '/dashboard';
      console.log('✅ [Login] Redirecting to:', from);
      navigate(from, { replace: true });
    }
  };

  const handleOAuthError = (error: string) => {
    setOauthLoading(false);
    setError(error);
  };

  return (
    <div className="min-h-screen bg-custom-bg flex flex-col">
      <div className="flex-1 flex items-center justify-center py-8 px-4">
        <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="mb-4">
            <img 
              src="/logo-small.svg" 
              alt="G8Road Logo" 
              className="h-12 mx-auto"
            />
          </div>
          
          <h1 className="text-h1 font-lato-bold text-custom-text mb-2">
            Welcome Back
          </h1>
          <p className="text-body text-custom-text-secondary">
            Sign in to your G8Road CRM account
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* OAuth Section */}
        <div className="mb-6">
          <p className="text-body text-custom-text-secondary mb-4 text-center">
            Or sign in with
          </p>
          <div className="flex flex-col gap-3">
            <GoogleOAuth
              onSuccess={handleOAuthSuccess}
              onError={handleOAuthError}
              disabled={oauthLoading || loading}
            />
            <AppleOAuth
              onSuccess={handleOAuthSuccess}
              onError={handleOAuthError}
              disabled={oauthLoading || loading}
            />
          </div>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-custom-text-secondary">Or continue with email</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Input
            {...register('email')}
            label="Email Address"
            type="email"
            error={errors.email?.message}
            className="w-full"
          />

          <div className="relative">
            <Input
              {...register('password')}
              label="Password"
              type={showPassword ? 'text' : 'password'}
              error={errors.password?.message}
              className="w-full pr-10"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-custom-text-secondary" />
              ) : (
                <Eye className="h-5 w-5 text-custom-text-secondary" />
              )}
            </button>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </Button>

          <div className="text-center">
            <RouterLink
              to="/forgot-password"
              className="text-custom-primary hover:text-green-700 text-sm font-medium"
            >
              Forgot your password?
            </RouterLink>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-custom-text-secondary">OR</span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-body text-custom-text-secondary mb-4">
              Don't have an account?
            </p>
            <RouterLink
              to="/register"
              className="block"
            >
              <Button
                variant="outline"
                size="lg"
                className="w-full"
              >
                Create Account
              </Button>
            </RouterLink>
          </div>
        </form>
      </Card>
      </div>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Login;
