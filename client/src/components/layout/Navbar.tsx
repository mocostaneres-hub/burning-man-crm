import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui';
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


  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  // Define navigation items based on user type
  const getNavItems = () => {
    if (!isAuthenticated) return [];

    // Debug logging
    console.log('Navbar - User data:', user);
    console.log('Navbar - Account type:', user?.accountType);
    console.log('Navbar - Camp name:', user?.campName);
    console.log('Navbar - Is authenticated:', isAuthenticated);

    // Camp/Admin accounts navigation (ordered as requested)
    if (user?.accountType === 'camp' || (user?.accountType === 'admin' && user?.campId)) {
      return [
        { label: 'My Camp', path: '/camp/profile', icon: <AccountCircle size={18} /> },
        { label: 'Roster', path: '/camp/rosters', icon: <People size={18} /> },
        { label: 'Applications', path: '/camp/applications', icon: <Assignment size={18} /> },
        { label: 'Tasks', path: '/camp/tasks', icon: <Task size={18} /> },
        { label: 'Events', path: '/camp/shifts', icon: <Calendar size={18} /> },
        { label: 'Dashboard', path: '/dashboard', icon: <Dashboard size={18} /> },
        { label: 'Help', path: '/help', icon: <Help size={18} /> },
        ...(user?.accountType === 'admin' ? [
          { label: 'Admin', path: '/admin', icon: <AdminPanelSettings size={18} /> }
        ] : [])
      ];
    }

    // Personal accounts navigation
    if (user?.accountType === 'personal') {
      return [
        { label: 'My Profile', path: '/user/profile', icon: <AccountCircle size={18} /> },
        { label: 'My Applications', path: '/applications', icon: <Assignment size={18} /> },
        { label: 'My Tasks', path: '/tasks', icon: <Task size={18} /> },
        { label: 'Discover Camps', path: '/camps', icon: <SearchIcon size={18} /> },
        { label: 'Principles', path: '/principles', icon: <Book size={18} /> },
        { label: 'Help', path: '/help', icon: <Help size={18} /> }
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