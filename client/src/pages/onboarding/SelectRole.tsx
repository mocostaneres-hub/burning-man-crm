import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '../../components/ui';
import Footer from '../../components/layout/Footer';
import { Users, Building, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const SelectRole: React.FC = () => {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRoleSelection = async (role: 'member' | 'camp_lead') => {
    try {
      setLoading(true);
      setError('');

      const response = await api.post('/onboarding/select-role', { role });
      
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
            className="text-center cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-custom-primary group"
            onClick={() => !loading && handleRoleSelection('camp_lead')}
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
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Sign up as Camp Lead'
                )}
              </Button>
            </div>
          </Card>

          {/* Member Role */}
          <Card 
            hover 
            padding="lg" 
            className="text-center cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-custom-primary group"
            onClick={() => !loading && handleRoleSelection('member')}
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
