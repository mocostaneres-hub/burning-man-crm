import React, { useState, useEffect } from 'react';
import { Button, Card, Badge } from '../../components/ui';
import { CheckCircle as CheckCircleIcon, X, Clock, Eye, MapPin, Calendar, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';

interface CampPhoto {
  url: string;
  caption: string;
  isPrimary: boolean;
}

interface Camp {
  _id: string;
  campName: string;
  theme?: string;
  hometown?: string;
  photos?: (string | CampPhoto)[]; // Support both legacy and new photo formats
  primaryPhotoIndex?: number;
}

interface MyApplication {
  _id: string;
  camp: Camp;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
  applicationData: {
    motivation: string;
    experience: string;
    skills: string[];
    availability: {
      arriveDate: string;
      departDate: string;
      workShifts: string;
    };
  };
}

const MyApplications: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      fetchApplications();
    }
  }, [user]);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/applications/my-applications');
      setApplications(response.data);
    } catch (err) {
      console.error('Error fetching applications:', err);
      setError('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <X className="w-5 h-5 text-red-600" />;
      case 'pending':
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="error">Rejected</Badge>;
      case 'pending':
      default:
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-custom-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-h1 font-lato-bold text-custom-text mb-4">
          My Applications
        </h1>
        <p className="text-body text-custom-text-secondary">
          Track the status of your camp applications
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {applications.length === 0 ? (
        <div className="text-center py-16">
          <h3 className="text-h3 font-lato-bold text-custom-text-secondary mb-4">
            No applications yet
          </h3>
          <p className="text-body text-custom-text-secondary mb-6">
            Start exploring camps and apply to join them!
          </p>
          <Button
            variant="primary"
            onClick={() => navigate('/camps/discovery')}
          >
            Discover Camps
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {applications.map((application) => (
            <Card key={application._id} className="p-6">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Camp Photo */}
                {application.camp.photos && application.camp.photos.length > 0 && (() => {
                  const photo = application.camp.photos[application.camp.primaryPhotoIndex || 0];
                  const photoUrl = typeof photo === 'string' ? photo : photo.url;
                  return (
                    <div className="lg:w-48 flex-shrink-0">
                      <img
                        src={photoUrl}
                        alt={application.camp.campName}
                        className="w-full h-32 lg:h-full object-cover rounded-lg"
                      />
                    </div>
                  );
                })()}

                {/* Application Details */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-h3 font-lato-bold text-custom-text mb-1">
                        {application.camp.campName}
                      </h3>
                      {application.camp.theme && (
                        <p className="text-body text-custom-text-secondary mb-2">
                          {application.camp.theme}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(application.status)}
                      {getStatusBadge(application.status)}
                    </div>
                  </div>

                  {/* Camp Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {application.camp.hometown && (
                      <div className="flex items-center gap-2 text-sm text-custom-text-secondary">
                        <MapPin className="w-4 h-4" />
                        {application.camp.hometown}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-custom-text-secondary">
                      <Calendar className="w-4 h-4" />
                      Applied {formatDate(application.appliedAt)}
                    </div>
                    {application.reviewedAt && (
                      <div className="flex items-center gap-2 text-sm text-custom-text-secondary">
                        <CheckCircleIcon className="w-4 h-4" />
                        Reviewed {formatDate(application.reviewedAt)}
                      </div>
                    )}
                  </div>

                  {/* Application Motivation */}
                  <div className="mb-4">
                    <h4 className="text-label font-medium text-custom-text mb-2">
                      Your Motivation
                    </h4>
                    <p className="text-body text-custom-text-secondary">
                      {application.applicationData.motivation}
                    </p>
                  </div>

                  {/* Review Notes */}
                  {application.reviewNotes && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-label font-medium text-custom-text mb-2">
                        Review Notes
                      </h4>
                      <p className="text-body text-custom-text-secondary">
                        {application.reviewNotes}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/camps/${application.camp._id}`)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Camp
                    </Button>
                    {application.status === 'pending' && (
                      <Button
                        variant="outline"
                        onClick={() => navigate(`/applications/${application._id}/edit`)}
                      >
                        Edit Application
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyApplications;