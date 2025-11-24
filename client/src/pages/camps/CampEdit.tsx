import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * CampEdit component redirects to CampProfile
 * The camp profile page has built-in edit functionality
 * accessed via the edit button in the UI
 */
const CampEdit: React.FC = () => {
  const { user } = useAuth();
  // Get camp identifier for the profile edit URL
  const campId = user?.campId?.toString() || user?._id?.toString() || '';
  const profilePath = campId ? `/camp/${campId}/profile` : '/camp/profile';
  
  // Redirect to camp profile page with identifier
  // The profile page has comprehensive editing functionality
  return <Navigate to={profilePath} replace />;
};

export default CampEdit;
