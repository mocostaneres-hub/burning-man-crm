import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Badge } from '../../components/ui';
import { MapPin, Calendar, Instagram, Facebook, Linkedin as LinkedinIcon, Ticket as TicketIcon, Car as CarIcon, Clock, User, Share as ShareIcon, ArrowLeft as ArrowLeftIcon, Loader2 } from 'lucide-react';
import apiService from '../../services/api';

interface MemberProfileData {
  _id: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  city?: string;
  yearsBurned?: number;
  previousCamps?: string;
  bio?: string;
  profilePhoto?: string;
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
  };
  skills?: string[];
  hasTicket?: boolean;
  hasVehiclePass?: boolean;
  arrivalDate?: string;
  departureDate?: string;
}

const PublicMemberProfile: React.FC = () => {
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<MemberProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (identifier) {
      fetchProfile();
    }
  }, [identifier]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/users/public/${identifier}`);
      setProfileData(response.member);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
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

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <h2 className="text-h2 font-lato-bold text-red-600 mb-4">
            Error Loading Profile
          </h2>
          <p className="text-body text-custom-text-secondary mb-6">
            {error}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="text-custom-primary hover:underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <h2 className="text-h2 font-lato-bold text-custom-text-secondary mb-4">
            Profile Not Found
          </h2>
          <p className="text-body text-custom-text-secondary mb-6">
            This member profile could not be found or is not public.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="text-custom-primary hover:underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-custom-text-secondary hover:text-custom-text transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-h1 font-lato-bold text-custom-text">
            {profileData.firstName} {profileData.lastName}
          </h1>
        </div>
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: `${profileData.firstName} ${profileData.lastName} - Burning Man Profile`,
                url: window.location.href
              });
            } else {
              navigator.clipboard.writeText(window.location.href);
              // You could add a toast notification here
            }
          }}
          className="p-2 text-custom-text-secondary hover:text-custom-text transition-colors"
        >
          <ShareIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Photo and Basic Info */}
        <div className="lg:col-span-1">
          <Card className="p-6 text-center">
            <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              {profileData.profilePhoto ? (
                <img
                  src={profileData.profilePhoto}
                  alt={`${profileData.firstName} ${profileData.lastName}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-16 h-16 text-gray-400" />
              )}
            </div>
            
            <h2 className="text-h2 font-lato-bold text-custom-text mb-2">
              {profileData.firstName} {profileData.lastName}
            </h2>

            {profileData.city && (
              <div className="flex items-center justify-center gap-2 text-sm text-custom-text-secondary mb-2">
                <MapPin className="w-4 h-4" />
                {profileData.city}
              </div>
            )}

            {profileData.yearsBurned && (
              <div className="flex items-center justify-center gap-2 text-sm text-custom-text-secondary mb-4">
                <Calendar className="w-4 h-4" />
                {profileData.yearsBurned} year{profileData.yearsBurned !== 1 ? 's' : ''} burned
              </div>
            )}

            {/* Social Media Links */}
            {profileData.socialMedia && (
              <div className="flex justify-center gap-3">
                {profileData.socialMedia.instagram && (
                  <a
                    href={`https://instagram.com/${profileData.socialMedia.instagram.replace('@', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pink-600 hover:text-pink-800 transition-colors"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {profileData.socialMedia.facebook && (
                  <a
                    href={profileData.socialMedia.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <Facebook className="w-5 h-5" />
                  </a>
                )}
                {profileData.socialMedia.linkedin && (
                  <a
                    href={profileData.socialMedia.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:text-blue-900 transition-colors"
                  >
                    <LinkedinIcon className="w-5 h-5" />
                  </a>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bio */}
          {profileData.bio && (
            <Card className="p-6">
              <h3 className="text-h3 font-lato-bold text-custom-text mb-4">
                About
              </h3>
              <p className="text-body text-custom-text-secondary">
                {profileData.bio}
              </p>
            </Card>
          )}

          {/* Skills */}
          {profileData.skills && profileData.skills.length > 0 && (
            <Card className="p-6">
              <h3 className="text-h3 font-lato-bold text-custom-text mb-4">
                Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {profileData.skills.map((skill) => (
                  <Badge key={skill} variant="neutral">
                    {skill}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* Previous Camps */}
          {profileData.previousCamps && (
            <Card className="p-6">
              <h3 className="text-h3 font-lato-bold text-custom-text mb-4">
                Previous Camps
              </h3>
              <p className="text-body text-custom-text-secondary">
                {profileData.previousCamps}
              </p>
            </Card>
          )}

          {/* Event Details */}
          <Card className="p-6">
            <h3 className="text-h3 font-lato-bold text-custom-text mb-4">
              Event Details
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Ticket Status */}
              <div className="flex items-center gap-3">
                <TicketIcon className="w-5 h-5 text-custom-primary" />
                <div>
                  <p className="text-sm font-medium text-custom-text">Ticket</p>
                  <p className="text-sm text-custom-text-secondary">
                    {profileData.hasTicket ? 'Has ticket' : 'No ticket'}
                  </p>
                </div>
              </div>

              {/* VP */}
              <div className="flex items-center gap-3">
                <CarIcon className="w-5 h-5 text-custom-primary" />
                <div>
                  <p className="text-sm font-medium text-custom-text">Has VP</p>
                  <p className="text-sm text-custom-text-secondary">
                    {profileData.hasVehiclePass ? 'Has VP' : 'No VP'}
                  </p>
                </div>
              </div>

              {/* Arrival Date */}
              {profileData.arrivalDate && (
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-custom-primary" />
                  <div>
                    <p className="text-sm font-medium text-custom-text">Arrival</p>
                    <p className="text-sm text-custom-text-secondary">
                      {formatDate(profileData.arrivalDate)}
                    </p>
                  </div>
                </div>
              )}

              {/* Departure Date */}
              {profileData.departureDate && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-custom-primary" />
                  <div>
                    <p className="text-sm font-medium text-custom-text">Departure</p>
                    <p className="text-sm text-custom-text-secondary">
                      {formatDate(profileData.departureDate)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PublicMemberProfile;