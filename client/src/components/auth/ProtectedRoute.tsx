import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireCampAccount?: boolean;
  requirePersonalAccount?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false, 
  requireCampAccount = false, 
  requirePersonalAccount = false 
}) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="w-15 h-15 animate-spin text-custom-primary" />
        <h3 className="text-h3 text-custom-text-secondary">
          Loading...
        </h3>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && user?.accountType !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <h1 className="text-h1 text-red-600">
          Access Denied
        </h1>
        <p className="text-body text-custom-text-secondary">
          You need admin privileges to access this page.
        </p>
        <p className="text-sm text-custom-text-secondary">
          Current account type: {user?.accountType || 'None'}
        </p>
      </div>
    );
  }

  // Allow access to camp management pages for:
  // 1. Camp accounts (accountType === 'camp')
  // 2. Admin accounts with campId
  // 3. Camp Leads (personal accounts with isCampLead === true)
  const hasCampAccess = user?.accountType === 'camp' 
    || (user?.accountType === 'admin' && user?.campId)
    || (user?.isCampLead === true && user?.campLeadCampId);

  if (requireCampAccount && !hasCampAccess) {
    console.log('🔍 [ProtectedRoute] Camp account access denied');
    console.log('🔍 [ProtectedRoute] User account type:', user?.accountType);
    console.log('🔍 [ProtectedRoute] User isCampLead:', user?.isCampLead);
    console.log('🔍 [ProtectedRoute] User campLeadCampId:', user?.campLeadCampId);
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <h1 className="text-h1 text-red-600">
          Access Denied
        </h1>
        <p className="text-body text-custom-text-secondary">
          This page is only accessible to camp accounts and camp leads.
        </p>
        <p className="text-sm text-custom-text-secondary">
          Current account type: {user?.accountType || 'None'}
          {user?.isCampLead && ' (Camp Lead)'}
        </p>
      </div>
    );
  }

  if (requirePersonalAccount && user?.accountType !== 'personal') {
    console.log('🔍 [ProtectedRoute] Personal account access denied');
    console.log('🔍 [ProtectedRoute] User account type:', user?.accountType);
    console.log('🔍 [ProtectedRoute] User data:', user);
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center">
        <h1 className="text-h1 text-red-600">
          Access Denied
        </h1>
        <p className="text-body text-custom-text-secondary">
          This page is only accessible to personal accounts.
        </p>
        <p className="text-sm text-custom-text-secondary">
          Current account type: {user?.accountType || 'None'}
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
