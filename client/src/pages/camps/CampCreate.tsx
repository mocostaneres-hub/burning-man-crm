import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const CampCreate: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Get camp identifier for the profile edit URL
    const campId = user?.campId?.toString() || user?._id?.toString() || '';
    const profilePath = campId ? `/camp/${campId}/profile` : '/camp/profile';
    
    // Redirect to camp profile page with identifier since that's where camp creation/editing happens
    navigate(profilePath, { replace: true });
  }, [navigate, user]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-custom-primary mx-auto mb-4" />
        <h3 className="text-h3 text-custom-text-secondary">
          Redirecting to camp profile...
        </h3>
      </div>
    </div>
  );
};

export default CampCreate;
