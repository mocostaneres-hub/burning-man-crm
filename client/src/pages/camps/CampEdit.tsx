import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * CampEdit component redirects to CampProfile
 * The camp profile page has built-in edit functionality
 * accessed via the edit button in the UI
 */
const CampEdit: React.FC = () => {
  // Redirect to camp profile page
  // The profile page has comprehensive editing functionality
  return <Navigate to="/camp/profile" replace />;
};

export default CampEdit;
