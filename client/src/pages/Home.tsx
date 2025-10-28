import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui';
import FAQ from '../components/FAQ';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  return (
    <div>
      {/* Hero Section */}
      <div
        className="relative min-h-[80vh] flex items-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #FF6B35 0%, #E64A19 50%, #FFD700 100%)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="text-center py-16">
            {/* Logo */}
            <div className="mb-8">
              <img 
                src="/logo.svg" 
                alt="G8Road Logo" 
                className="max-w-xs mx-auto h-auto"
                style={{ filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))' }}
              />
            </div>
            
            <h1
              className="text-3xl md:text-4xl lg:text-5xl font-lato font-bold text-white mb-8"
              style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}
            >
              Your Playa Journey Starts Here
            </h1>
            <p
              className="text-xl text-white mb-8 max-w-4xl mx-auto"
              style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }}
            >
              {user?.accountType === 'camp' 
                ? 'Manage your roster, recruit members, and build your community with our comprehensive CRM platform.'
                : 'Burners: find amazing camps to join, discover events and experiences, and connect with the burner community.\nCamps: manage your roster, orientation calls, projects and volunteer shifts - all in one place. No more copy and paste and endless forms and Google Docs!'
              }
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              {!isAuthenticated ? (
                <>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/register')}
                    className="border-white text-white hover:bg-white hover:text-custom-primary"
                  >
                    Get Started
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/camps')}
                    className="border-white text-white hover:bg-white hover:text-custom-primary"
                  >
                    Discover Camps
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate(user?.accountType === 'personal' ? '/user/profile' : '/dashboard')}
                    className="border-white text-white hover:bg-white hover:text-custom-primary"
                  >
                    {user?.accountType === 'personal' ? 'My Profile' : 'Go to Dashboard'}
                  </Button>
                  {user?.accountType !== 'camp' && (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => navigate('/camps')}
                      className="border-white text-white hover:bg-white hover:text-custom-primary"
                    >
                      Find Your Camp
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-custom-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-lato font-bold text-custom-text text-center mb-12">
            {user?.accountType === 'camp' 
              ? 'Everything You Need to Manage Your Camp'
              : 'Discover Your Perfect Theme Camp Experience'
            }
          </h2>
          <div className="text-center py-8">
            <p className="text-lg text-gray-600">
              {user?.accountType === 'camp' 
                ? '🏕️ Camp Management • 👥 Member Recruitment • 📊 Analytics • 💬 Communication • ⏰ Volunteer Shifts • 🚨 EAP Assignments • 📞 Orientation Calls • 🗺️ Mapping • 🛒 Shopping Lists'
                : '🔍 Find Camps • 📝 Apply to Join • 🎪 Discover Events • 🌟 Connect with The Burner Community'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Member Experience Section */}
      {user?.accountType === 'personal' && (
        <div className="py-16 bg-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2
              className="text-3xl font-lato font-bold text-center mb-12"
              style={{ color: '#FFD700' }}
            >
              Your Burning Man Week Awaits
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6">
                <h3 className="text-2xl font-lato font-bold text-custom-primary mb-4">
                  🏕️ Find Your Camp
                </h3>
                <p className="text-gray-600">
                  Discover amazing camps that match your interests, values, and Burning Man principles. Browse profiles, read about their mission, and find your perfect fit.
                </p>
              </div>
              <div className="text-center p-6">
                <h3 className="text-2xl font-lato font-bold text-custom-primary mb-4">
                  📝 Apply & Join
                </h3>
                <p className="text-gray-600">
                  Apply to join camps directly through our platform. Share your skills, interests, and what you can contribute to make your application stand out.
                </p>
              </div>
              <div className="text-center p-6">
                <h3 className="text-2xl font-lato font-bold text-custom-primary mb-4">
                  🎪 Events & Experiences
                </h3>
                <p className="text-gray-600">
                  Discover events at camps, deep playa and everything else happening at Black Rock City.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Section */}
      <FAQ />

      {/* CTA Section */}
      <div
        className="py-16"
        style={{
          background: 'linear-gradient(135deg, #2D2D2D 0%, #3D3D3D 100%)',
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-lato font-bold text-white mb-6">
              {user?.accountType === 'camp' 
                ? 'Ready to Build Your Camp Community?'
                : 'Ready to Find Your G8Road Family?'
              }
            </h2>
            <p className="text-lg text-gray-300 mb-8">
              {user?.accountType === 'camp' 
                ? 'Join thousands of burners who are already using our platform to create amazing camp experiences.'
                : 'Connect with camps, discover events, and create unforgettable memories during your G8Road week.'
              }
            </p>
            {!isAuthenticated && (
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/register')}
                className="bg-custom-primary hover:bg-custom-primary-hover"
              >
                Start Your Journey
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;