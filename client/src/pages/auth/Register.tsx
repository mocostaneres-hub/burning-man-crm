import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AppleOAuth from '../../components/auth/AppleOAuth';
import { Button, Input, Card } from '../../components/ui';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Footer from '../../components/layout/Footer';

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const schema: yup.ObjectSchema<FormData> = yup
  .object({
    firstName: yup.string().required('First name is required'),
    lastName: yup.string().required('Last name is required'),
    email: yup.string().email('Invalid email').required('Email is required'),
    password: yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref('password')], 'Passwords must match')
      .required('Confirm password is required'),
  })
  .required();

const Register: React.FC = () => {
  const { register: registerUser, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMatch, setPasswordMatch] = useState(true);
  const [oauthLoading, setOauthLoading] = useState(false);
  
  // Capture invitation context from URL
  const inviteToken = searchParams.get('invite');
  const campSlug = searchParams.get('camp');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {},
  });

  // Store invite context on component mount
  useEffect(() => {
    if (inviteToken && campSlug) {
      console.log('🎟️ [Register] Storing invitation context:', { inviteToken, campSlug });
      localStorage.setItem('pendingInvite', JSON.stringify({ token: inviteToken, campSlug }));
    }
  }, [inviteToken, campSlug]);

  // Redirect authenticated users away from register page
  useEffect(() => {
    console.log('🔍 [Register useEffect] authLoading:', authLoading, 'user:', user);
    
    // Wait for auth to finish loading before checking user status
    if (authLoading) {
      console.log('🔍 [Register] Auth still loading, waiting...');
      return;
    }
    
    if (user) {
      console.log('🔍 [Register] User already authenticated, redirecting...');
      
      // Check if user needs onboarding
      if (user.role === 'unassigned' || !user.role) {
        console.log('✅ [Register] Redirecting to onboarding...');
        navigate('/onboarding/select-role', { replace: true });
        return;
      }
      
      // Redirect to dashboard
      console.log('✅ [Register] Redirecting to dashboard...');
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const password = watch('password');
  const confirmPassword = watch('confirmPassword');

  // Check password match in real-time
  React.useEffect(() => {
    if (confirmPassword && password !== confirmPassword) {
      setPasswordMatch(false);
    } else if (confirmPassword && password === confirmPassword && password.length >= 6) {
      setPasswordMatch(true);
    } else {
      setPasswordMatch(true);
    }
  }, [password, confirmPassword]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError('');

    try {
      // Check password match first
      if (data.password !== data.confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      const { confirmPassword, ...registerData } = data;
      
      // Always create personal account - role will be selected during onboarding
      const userData = {
        ...registerData,
        accountType: 'personal' as const
      };
      
      const result = await registerUser(userData);
      
      // Small delay to ensure auth context is fully updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check for pending invitation
      const pendingInvite = localStorage.getItem('pendingInvite');
      if (pendingInvite) {
        try {
          const { campSlug, token } = JSON.parse(pendingInvite);
          console.log('🎟️ [Register] Redirecting to camp profile with invite:', { campSlug, token });
          // Don't clear the invite yet - we'll need it for the profile completion modal
          navigate(`/camps/${campSlug}?invite=${token}`, { replace: true });
          return;
        } catch (err) {
          console.error('❌ [Register] Error parsing pending invite:', err);
          localStorage.removeItem('pendingInvite');
        }
      }
      
      // Check if user needs onboarding
      if (result.needsOnboarding) {
        navigate('/onboarding/select-role', { replace: true });
        return;
      }
      
      // Fallback redirect (should not happen with new users)
      navigate('/user/profile');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSuccess = (user: any) => {
    setOauthLoading(false);
    setError('');
    
    // Check if user needs onboarding (only truly new users with unassigned role and no lastLogin)
    if ((user.role === 'unassigned' || !user.role) && !user.lastLogin) {
      navigate('/onboarding/select-role', { replace: true });
      return;
    }
    
    // Redirect based on account type
    if (user.accountType === 'camp') {
      navigate('/camp/edit');
    } else {
      navigate('/user/profile');
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
            Join the Community
          </h1>
          <p className="text-body text-custom-text-secondary">
            Create your G8Road CRM account
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
              Or sign up with
            </p>
            <div className="flex flex-col gap-3">
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
            {/* Personal Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  {...register('firstName')}
                  label="First Name"
                  error={errors.firstName?.message}
                  className="w-full"
                />
                <p className="text-gray-500 text-xs mt-1 ml-1">or your camp's name</p>
              </div>
              <Input
                {...register('lastName')}
                label="Last Name"
                error={errors.lastName?.message}
                className="w-full"
              />
            </div>

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

            <div className="relative">
              <Input
                {...register('confirmPassword')}
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                error={errors.confirmPassword?.message || (!passwordMatch ? 'Passwords do not match' : '')}
                className="w-full pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
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
                  Creating Account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>

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
                Already have an account?
              </p>
              <RouterLink
                to="/login"
                className="block"
              >
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                >
                  Sign In
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

export default Register;