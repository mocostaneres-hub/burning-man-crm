import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType, RegisterData } from '../types';
import apiService from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper function to check if user needs onboarding
  const needsOnboarding = (userData: User | null): boolean => {
    // User needs onboarding only if they have unassigned role AND no lastLogin (truly new user)
    return (userData?.role === 'unassigned' || !userData?.role) && !userData?.lastLogin;
  };

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');

      if (storedToken) {
        try {
          setToken(storedToken);
          
          // Always fetch fresh user data from API (don't use stale localStorage)
          const response = await apiService.getCurrentUser();
          setUser(response.user);
          
          // Update localStorage with fresh data
          localStorage.setItem('user', JSON.stringify(response.user));
        } catch (error) {
          // Token is invalid, clear storage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<{ isFirstLogin?: boolean; needsOnboarding?: boolean }> => {
    try {
      const response = await apiService.login(email, password);
      const { token: newToken, user: userData, isFirstLogin } = response;

      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));

      // Refresh user to capture camp-lead fields (/auth/me)
      try {
        const refreshed = await apiService.getCurrentUser();
        if (refreshed?.user) {
          setUser(refreshed.user);
          localStorage.setItem('user', JSON.stringify(refreshed.user));
        }
      } catch (refreshError) {
        console.warn('⚠️ [AuthContext] Failed to refresh user after login:', refreshError);
      }
      
      return { 
        isFirstLogin,
        needsOnboarding: needsOnboarding(userData)
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const register = async (userData: RegisterData): Promise<{ needsOnboarding?: boolean }> => {
    try {
      console.log('🔍 [AuthContext] Registering user with data:', userData);
      const response = await apiService.register(userData);
      console.log('🔍 [AuthContext] Registration response:', response);
      const { token: newToken, user: newUser } = response;

      console.log('🔍 [AuthContext] Setting user:', newUser);
      console.log('🔍 [AuthContext] User account type:', newUser.accountType);
      console.log('🔍 [AuthContext] User role:', newUser.role);
      
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
      
      return { 
        needsOnboarding: needsOnboarding(newUser)
      };
    } catch (error: any) {
      console.error('❌ [AuthContext] Registration error:', error);
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  };

  const logout = (): void => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const updateUser = (userData: Partial<User>): void => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const response = await apiService.getCurrentUser();
      console.log('🔄 [AuthContext] Refresh user response:', response);
      console.log('🔄 [AuthContext] Refreshed user skills:', response.user?.skills);
      console.log('🔄 [AuthContext] Refreshed user socialMedia:', response.user?.socialMedia);
      console.log('🔄 [AuthContext] Refreshed user playaName:', response.user?.playaName);
      setUser(response.user);
      localStorage.setItem('user', JSON.stringify(response.user));
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    register,
    logout,
    loading,
    isAuthenticated: !!user && !!token,
    updateUser,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
