import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input } from '../../components/ui';
import Footer from '../../components/layout/Footer';
import { Users, Building, Loader2, ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

type CampLeadStep = 'choose' | 'enter_name';

const SelectRole: React.FC = () => {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [campName, setCampName] = useState('');
  const [campLeadStep, setCampLeadStep] = useState<CampLeadStep>('choose');
  const campNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (campLeadStep === 'enter_name') {
      campNameInputRef.current?.focus();
    }
  }, [campLeadStep]);

  const handleCampLeadContinue = () => {
    if (!campName.trim()) {
      setError('Please enter your camp name to continue.');
      return;
    }
    handleRoleSelection('camp_lead');
  };

  const handleRoleSelection = async (role: 'member' | 'camp_lead') => {
    if (role === 'camp_lead' && !campName.trim()) {
      setError('Please enter your camp name to continue.');
      return;
    }
    try {
      setLoading(true);
      setError('');

      const payload: { role: 'member' | 'camp_lead'; campName?: string } = { role };
      if (role === 'camp_lead') {
        payload.campName = campName.trim();
      }
      const response = await api.post('/onboarding/select-role', payload);
      
      if (response.message === 'Role selected successfully') {
        // Update the user in AuthContext with the new data from backend
        console.log('🔍 [SelectRole] Updating user with response:', response.user);
        updateUser(response.user);
        
        // Redirect based on the role selected
        const redirectTo = response.redirectTo;
        navigate(redirectTo, { replace: true });
      } else {
        setError('Failed to select role. Please try again.');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to select role. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to G8Road!
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Let's get you set up. How would you like to use G8Road?
            </p>
          </div>

          {/* Role Selection Cards - Centered */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Camp Lead Role */}
          <Card 
            hover 
            padding="lg" 
            className={`text-center transition-all duration-300 hover:shadow-xl group ${campLeadStep === 'enter_name' ? 'border-custom-primary ring-2 ring-custom-primary/20' : 'hover:border-custom-primary'}`}
          >
            <div className="flex flex-col items-center space-y-6">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <Building className="w-10 h-10 text-orange-600" />
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Lead a Camp
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Create and manage your theme camp, recruit members, organize shifts, 
                  and build your Burning Man community. Perfect for camp organizers.
                </p>
              </div>

              {campLeadStep === 'choose' ? (
                <>
                  <div className="space-y-3 text-sm text-gray-500">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                      <span>Create and manage your camp</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                      <span>Recruit and manage members</span>
                    </div>
                    <div className="flex items-center justify-center space-x-2">
                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                      <span>Organize shifts and tasks</span>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    disabled={loading}
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setError('');
                      setCampLeadStep('enter_name');
                    }}
                  >
                    Sign up as Camp Lead
                  </Button>
                </>
              ) : (
                <>
                  <div className="w-full space-y-2 text-left">
                    <label htmlFor="camp-name" className="block text-sm font-medium text-gray-700">
                      Camp name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      ref={campNameInputRef}
                      id="camp-name"
                      type="text"
                      placeholder="e.g. Mudskippers"
                      value={campName}
                      onChange={(e) => { setCampName(e.target.value); setError(''); }}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCampLeadContinue())}
                      className="w-full"
                      maxLength={120}
                      required
                      aria-required="true"
                    />
                    <p className="text-xs text-gray-500">
                      Your camp URL will be based on this name (e.g. g8road.com/camps/mudskippers). It will be carried over to the next page and can only be changed by a system admin.
                    </p>
                  </div>

                  <div className="flex gap-3 w-full">
                    <Button
                      variant="outline"
                      size="lg"
                      disabled={loading}
                      className="flex-1"
                      onClick={() => {
                        setCampLeadStep('choose');
                        setCampName('');
                        setError('');
                      }}
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      size="lg"
                      disabled={loading || !campName.trim()}
                      className="flex-1"
                      onClick={(e) => { e.stopPropagation(); handleCampLeadContinue(); }}
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        'Continue'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Member Role */}
          <Card 
            hover 
            padding="lg" 
            className="text-center transition-all duration-300 hover:shadow-xl hover:border-custom-primary group"
          >
            <div className="flex flex-col items-center space-y-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <Users className="w-10 h-10 text-blue-600" />
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Join as a Member
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Discover amazing camps, apply to join communities, and connect with fellow burners. 
                  Perfect for individuals looking to find their Burning Man family.
                </p>
              </div>

              <div className="space-y-3 text-sm text-gray-500">
                <div className="flex items-center justify-center space-x-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>Find and apply to camps</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>Connect with other members</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>Manage your profile</span>
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                disabled={loading}
                className="w-full"
                onClick={() => handleRoleSelection('member')}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Sign up as Member'
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        )}

          {/* Footer Info */}
          <div className="text-center text-sm text-gray-500 mb-8">
            <p>
              Don't worry, you can always change your role later in your profile settings.
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer - At bottom */}
      <Footer />
    </div>
  );
};

export default SelectRole;
