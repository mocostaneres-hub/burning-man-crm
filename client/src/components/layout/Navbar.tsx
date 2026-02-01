import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui';
import api from '../../services/api';
import {
  Menu as MenuIcon,
  User as AccountCircle,
  LayoutDashboard as Dashboard,
  Search as SearchIcon,
  Shield as AdminPanelSettings,
  LogOut as Logout,
  Home as HomeIcon,
  HelpCircle as Help,
  Book,
  Users as People,
  ClipboardList as Assignment,
  Calendar,
  Square as Task,
} from 'lucide-react';

const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [campSlug, setCampSlug] = useState<string | null>(null);
  const [campSlugLoading, setCampSlugLoading] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // ============================================================================
  // CRITICAL: Fetch Camp Slug from Camp Entity, Never from User
  // ============================================================================
  // Camp pages MUST use the Camp's slug, not the User's slug.
  // 
  // WHY users and camps must remain separate routing entities:
  // 1. Users are NOT camps - they are accounts that may own/admin a camp
  // 2. A user (like mauricio@camp.com) owns a Camp entity (like "Mudskippers")
  // 3. The Camp entity has the authoritative slug (generated from camp name)
  // 4. User entities don't have (and shouldn't have) urlSlug or camp slugs
  // 
  // INCORRECT (old logic):
  // - Using user.urlSlug → creates /camps/:userSlug (WRONG)
  // - Generating slug from user.campName → inconsistent, not authoritative
  // 
  // CORRECT (new logic):
  // - Fetch actual Camp entity via /api/camps/my-camp
  // - Use camp.slug from the Camp model
  // - Camp slug is authoritative and consistent
  // 
  // This ensures:
  // - No camp pages are created for users
  // - Routing uses correct Camp slug
  // - Works for login, impersonation, and mobile
  // ============================================================================
  useEffect(() => {
    const fetchCampSlug = async () => {
      // Only fetch for camp and admin users with a camp
      if ((user?.accountType === 'camp' || (user?.accountType === 'admin' && user?.campId)) && !campSlug && !campSlugLoading) {
        setCampSlugLoading(true);
        try {
          // Fetch the ACTUAL camp entity to get its slug
          const response = await api.get('/camps/my-camp');
          if (response.slug) {
            console.log('✅ [Navbar] Fetched camp slug:', response.slug);
            setCampSlug(response.slug);
          } else {
            console.warn('⚠️ [Navbar] Camp found but has no slug:', response);
          }
        } catch (error) {
          console.error('❌ [Navbar] Error fetching camp slug:', error);
        } finally {
          setCampSlugLoading(false);
        }
      }
    };
    fetchCampSlug();
  }, [user, campSlug, campSlugLoading]);

  // Define navigation items based on user type
  const getNavItems = () => {
    if (!isAuthenticated) return [];

    // Debug logging
    console.log('Navbar - User data:', user);
    console.log('Navbar - Account type:', user?.accountType);
    console.log('Navbar - Is Camp Lead:', user?.isCampLead);
    console.log('Navbar - Camp Lead Camp:', user?.campLeadCampName);
    console.log('Navbar - Camp name:', user?.campName);
    console.log('Navbar - Is authenticated:', isAuthenticated);

    // ============================================================================
    // CAMP LEAD NAVIGATION
    // Camp Leads are personal accounts with delegated admin permissions for a camp
    // They should see camp management navigation (Roster, Applications, etc.)
    // but NOT member discovery navigation (My Applications, Discover Camps)
    // ============================================================================
    if (user?.isCampLead && user?.campLeadCampId && user?.campLeadCampSlug) {
      const campIdentifier = user.campLeadCampId;
      const campSlug = user.campLeadCampSlug;
      
      console.log('✅ [Navbar] User is Camp Lead, showing camp management navigation');
      
      return [
        { label: 'My Profile', path: '/user/profile', icon: <AccountCircle size={18} /> },
        { label: 'Camp Profile', path: `/camps/${campSlug}`, icon: <HomeIcon size={18} /> },
        { label: 'Roster', path: `/camp/${campIdentifier}/roster`, icon: <People size={18} /> },
        { label: 'Applications', path: `/camp/${campIdentifier}/applications`, icon: <Assignment size={18} /> },
        { label: 'Tasks', path: `/camp/${campIdentifier}/tasks`, icon: <Task size={18} /> },
        { label: 'Events', path: `/camp/${campIdentifier}/events`, icon: <Calendar size={18} /> },
        { label: 'Help', path: '/member/help', icon: <Help size={18} /> }
      ];
    }

    // Camp/Admin accounts navigation (ordered as requested)
    // Note: Camp Leads are handled separately above
    if (user?.accountType === 'camp' || (user?.accountType === 'admin' && user?.campId)) {
      // Get camp identifier for profile edit URL
      const campIdentifier = user?.campId?.toString() || user?._id?.toString() || '';
      
      // ============================================================================
      // CRITICAL: Camp Public Profile Path Must Use Camp Slug, Not User Data
      // ============================================================================
      // ALWAYS source the camp slug from the Camp entity (fetched via useEffect above).
      // NEVER use user properties (user.urlSlug, user.campName) for camp URLs.
      // 
      // Defensive checks:
      // - If campSlug exists: Use it (correct)
      // - If campSlug is loading/missing: Disable or hide "My Camp" link
      // - DO NOT generate slug from user data (creates wrong URLs)
      // ============================================================================
      let campPublicProfilePath: string | null = null;
      
      if (campSlug) {
        // ✅ CORRECT: Use the camp's authoritative slug from Camp entity
        campPublicProfilePath = `/camps/${campSlug}`;
        console.log('✅ [Navbar] Using camp slug for My Camp link:', campSlug);
      } else {
        // ⚠️ Camp slug not yet loaded - link will be disabled
        console.warn('⚠️ [Navbar] Camp slug not loaded yet, My Camp link disabled');
        campPublicProfilePath = null;
      }
      
      // Profile edit path with identifier
      const campProfileEditPath = campIdentifier ? `/camp/${campIdentifier}/profile` : '/camp/profile';
      
      const navItems = [];
      
      // Only add "My Camp" link if we have a valid camp slug
      if (campPublicProfilePath) {
        navItems.push({ label: 'My Camp', path: campPublicProfilePath, icon: <AccountCircle size={18} /> });
      }
      
      // Add other nav items
      navItems.push(
        { label: 'Roster', path: campIdentifier ? `/camp/${campIdentifier}/roster` : '/camp/rosters', icon: <People size={18} /> }
      );
      navItems.push(
        { label: 'Applications', path: campIdentifier ? `/camp/${campIdentifier}/applications` : '/camp/applications', icon: <Assignment size={18} /> }
      );
      navItems.push(
        { label: 'Tasks', path: campIdentifier ? `/camp/${campIdentifier}/tasks` : '/camp/tasks', icon: <Task size={18} /> }
      );
      navItems.push(
        { label: 'Events', path: campIdentifier ? `/camp/${campIdentifier}/events` : '/camp/shifts', icon: <Calendar size={18} /> }
      );
      navItems.push(
        { label: 'Dashboard', path: campIdentifier ? `/camp/${campIdentifier}/dashboard` : '/dashboard', icon: <Dashboard size={18} /> }
      );
      navItems.push(
        { label: 'Help', path: '/camp/help', icon: <Help size={18} /> }
      );
      
      if (user?.accountType === 'admin') {
        navItems.push({ label: 'Admin', path: '/admin', icon: <AdminPanelSettings size={18} /> });
      }
      
      return navItems;
    }

    // Personal accounts navigation
    if (user?.accountType === 'personal') {
      return [
        { label: 'My Profile', path: '/user/profile', icon: <AccountCircle size={18} /> },
        { label: 'My Applications', path: '/applications', icon: <Assignment size={18} /> },
        { label: 'My Tasks', path: '/tasks', icon: <Task size={18} /> },
        { label: 'Discover Camps', path: '/camps', icon: <SearchIcon size={18} /> },
        { label: 'Principles', path: '/principles', icon: <Book size={18} /> },
        { label: 'Help', path: '/member/help', icon: <Help size={18} /> }
      ];
    }

    // System admin accounts (without camp)
    if (user?.accountType === 'admin') {
      return [
        { label: 'Dashboard', path: '/dashboard', icon: <Dashboard size={18} /> },
        { label: 'Admin', path: '/admin', icon: <AdminPanelSettings size={18} /> },
        { label: 'Help', path: '/help', icon: <Help size={18} /> }
      ];
    }

    return [];
  };

  const navItems = getNavItems();

  return (
    <nav className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="text-h2 font-lato-bold text-custom-primary hover:text-custom-primary/80 transition-colors"
            >
              G8Road
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-custom-primary text-white'
                    : 'text-custom-text hover:text-custom-primary hover:bg-custom-primary/10'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}

            {/* Auth Links for Non-Authenticated Users */}
            {!isAuthenticated && (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/login')}
                  className="flex items-center space-x-1"
                >
                  <span>Log In</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/register')}
                  className="flex items-center space-x-1"
                >
                  <span>Sign Up</span>
                </Button>
              </div>
            )}

            {/* User Menu */}
            {isAuthenticated && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-custom-text-secondary">
                  {user?.firstName || 'User'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center space-x-1"
                >
                  <Logout size={16} />
                  <span>Logout</span>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-custom-text hover:text-custom-primary p-2"
            >
              <MenuIcon size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
            {navItems.map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center space-x-2 w-full px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isActive(item.path)
                    ? 'bg-custom-primary text-white'
                    : 'text-custom-text hover:text-custom-primary hover:bg-custom-primary/10'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}

            {/* Mobile Auth Links for Non-Authenticated Users */}
            {!isAuthenticated && (
              <div className="border-t border-gray-200 pt-4">
                <div className="px-3 space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigate('/login');
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 w-full"
                  >
                    <span>Log In</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      navigate('/register');
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center space-x-2 w-full"
                  >
                    <span>Sign Up</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Mobile User Menu */}
            {isAuthenticated && (
              <div className="border-t border-gray-200 pt-4">
                <div className="px-3 py-2">
                  <span className="text-sm text-custom-text-secondary">
                    {user?.firstName || 'User'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-2 w-full mx-3"
                >
                  <Logout size={16} />
                  <span>Logout</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;