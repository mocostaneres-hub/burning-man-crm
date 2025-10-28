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
                : (
                  <>
                    <span className="font-bold text-lg">Burners:</span> find amazing camps to join, discover events and experiences, and connect with the burner community.
                    <br /><br />
                    <span className="font-bold text-lg">Camps:</span> manage your roster, orientation calls, projects and volunteer shifts - all in one place. No more copy and paste and endless forms and Google Docs!
                  </>
                )
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
              Your Playa Week Awaits
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6">
                <h3 className="text-2xl font-lato font-bold text-custom-primary mb-4">
                  🏕️ Find Your Camp
                </h3>
                <p className="text-gray-600">
                  Discover amazing camps that match your interests, values, and principles. Browse profiles, read about their mission, and find your perfect fit.
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
                  Discover events at camps, volunteer opportunities and everything else happening in the Playa.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Section */}
      <FAQ />

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="col-span-1 md:col-span-2">
              <h3 className="text-2xl font-bold mb-4">G8Road CRM</h3>
              <p className="text-gray-300 mb-4">
                Connecting burners with theme camps and facilitating camp management 
                for the Burning Man community.
              </p>
            </div>
            
            {/* Quick Links */}
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <a href="/" className="text-gray-300 hover:text-white transition-colors">
                    Home
                  </a>
                </li>
                <li>
                  <a href="/camps" className="text-gray-300 hover:text-white transition-colors">
                    Find Camps
                  </a>
                </li>
                <li>
                  <a href="/help" className="text-gray-300 hover:text-white transition-colors">
                    Help & Support
                  </a>
                </li>
              </ul>
            </div>
            
            {/* Legal */}
            <div>
              <h4 className="text-lg font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <a href="/privacy" className="text-gray-300 hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/terms" className="text-gray-300 hover:text-white transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="mailto:info@g8road.com" className="text-gray-300 hover:text-white transition-colors">
                    Contact Us
                  </a>
                </li>
              </ul>
            </div>
          </div>
          
          {/* Bottom Bar */}
          <div className="border-t border-gray-700 mt-8 pt-8 text-center">
            <p className="text-gray-400">
              © {new Date().getFullYear()} G8Road CRM. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default Home;