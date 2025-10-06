import React from 'react';
import { Card, Badge } from '../../components/ui';
import { MapPin, Mail, Globe, Facebook, Instagram, Twitter, Calendar, Edit } from 'lucide-react';

interface CampProfileDisplayProps {
  camp: {
    campName: string;
    burningSince: number;
    hometown: string;
    contactEmail: string;
    website: string;
    socialMedia: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
      tiktok?: string;
    };
    location: {
      street: string;
      crossStreet: string;
      time: string;
      description: string;
    };
    photos: string[];
  };
  onEdit?: () => void;
}

const CampProfileDisplay: React.FC<CampProfileDisplayProps> = ({ camp, onEdit }) => {
  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header Card */}
      <Card className="mb-6">
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-custom-primary flex items-center justify-center text-white text-2xl font-bold">
                {camp.campName.charAt(0)}
              </div>
              <div>
                <h1 className="text-h1 font-lato-bold text-custom-text mb-2">
                  {camp.campName}
                </h1>
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="neutral" className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Burning Since {camp.burningSince}
                  </Badge>
                  <Badge variant="neutral" className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {camp.hometown}
                  </Badge>
                </div>
              </div>
            </div>
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2 text-custom-primary hover:bg-custom-primary hover:text-white rounded-lg transition-colors"
              >
                <Edit className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Photos */}
        {camp.photos.length > 0 && (
          <div className="lg:col-span-2">
            <Card>
              <div className="p-6">
                <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
                  Photos
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {camp.photos.map((photo, index) => (
                    <div
                      key={index}
                      className="h-48 rounded-lg overflow-hidden border border-gray-200"
                    >
                      <img
                        src={photo}
                        alt={`Camp photo ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Contact Information */}
        <Card>
          <div className="p-6">
            <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
              Contact Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center mb-1">
                  <Mail className="w-4 h-4 text-custom-text-secondary mr-2" />
                  <p className="text-sm text-custom-text-secondary">Email</p>
                </div>
                <p className="text-body text-custom-text">{camp.contactEmail}</p>
              </div>

              {camp.website && (
                <div>
                  <div className="flex items-center mb-1">
                    <Globe className="w-4 h-4 text-custom-text-secondary mr-2" />
                    <p className="text-sm text-custom-text-secondary">Website</p>
                  </div>
                  <p className="text-body text-custom-text">
                    <a 
                      href={camp.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-custom-primary hover:underline"
                    >
                      {camp.website}
                    </a>
                  </p>
                </div>
              )}

              {/* Social Media */}
              {(camp.socialMedia.facebook || camp.socialMedia.instagram) && (
                <div>
                  <p className="text-sm text-custom-text-secondary mb-2">
                    Social Media
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {camp.socialMedia.facebook && (
                      <Badge
                        variant="info"
                        className="flex items-center gap-1 cursor-pointer hover:bg-blue-600"
                        onClick={() => window.open(camp.socialMedia.facebook, '_blank')}
                      >
                        <Facebook className="w-4 h-4" />
                        Facebook
                      </Badge>
                    )}
                    {camp.socialMedia.instagram && (
                      <Badge
                        variant="info"
                        className="flex items-center gap-1 cursor-pointer hover:bg-blue-600"
                        onClick={() => window.open(camp.socialMedia.instagram, '_blank')}
                      >
                        <Instagram className="w-4 h-4" />
                        Instagram
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* G8Road Location */}
        <Card>
          <div className="p-6">
            <h2 className="text-h2 font-lato-bold text-custom-text mb-4 flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              G8Road Location
            </h2>

            {camp.location.street && (
              <div>
                <p className="text-sm text-custom-text-secondary mb-1">
                  Location
                </p>
                <p className="text-body text-custom-text">
                  {camp.location.street}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CampProfileDisplay;