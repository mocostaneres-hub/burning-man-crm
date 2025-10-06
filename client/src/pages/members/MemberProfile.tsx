import React from 'react';
import { Button, Card, Badge } from '../../components/ui';
import { Edit, Phone as PhoneIcon, MapPin, Calendar, Instagram, Facebook, Linkedin as LinkedinIcon, Mail, Loader2, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const MemberProfile: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-h1 font-lato-bold text-custom-text">
          My Member Profile
        </h1>
        <Button
          variant="primary"
          onClick={() => navigate('/member/edit')}
          className="flex items-center gap-2"
        >
          <Edit className="w-4 h-4" />
          Edit Profile
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Photo */}
        <Card className="p-6">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            Profile Photo
          </h2>
          <div className="flex justify-center">
            {user.profilePhoto ? (
              <img
                src={user.profilePhoto}
                alt={`${user.firstName} ${user.lastName}`}
                className="w-48 h-48 rounded-full object-cover"
              />
            ) : (
              <div className="w-48 h-48 rounded-full bg-gray-200 flex items-center justify-center">
                <UserIcon className="w-24 h-24 text-gray-400" />
              </div>
            )}
          </div>
        </Card>

        {/* Basic Information */}
        <Card className="p-6">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            Basic Information
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Name
              </label>
              <p className="text-body text-custom-text">
                {user.firstName} {user.lastName}
              </p>
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Email
              </label>
              <p className="text-body text-custom-text">{user.email}</p>
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <PhoneIcon className="w-4 h-4 inline mr-2" />
                Phone Number
              </label>
              <p className="text-body text-custom-text">
                {user.phoneNumber || 'Not provided'}
              </p>
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <MapPin className="w-4 h-4 inline mr-2" />
                City
              </label>
              <p className="text-body text-custom-text">
                {user.city || 'Not provided'}
              </p>
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <Calendar className="w-4 h-4 inline mr-2" />
                Burning Man Experience
              </label>
              <p className="text-body text-custom-text">
                {user.yearsBurned === 0 
                  ? 'Virgin (First time!)' 
                  : `${user.yearsBurned} ${user.yearsBurned === 1 ? 'year' : 'years'}`
                }
              </p>
            </div>
          </div>
        </Card>

        {/* Bio */}
        <Card className="p-6">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            About Me
          </h2>
          <p className="text-body text-custom-text whitespace-pre-wrap">
            {user.bio || 'No bio provided'}
          </p>
        </Card>

        {/* Social Media */}
        <Card className="p-6">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            Social Media
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <Instagram className="w-4 h-4 inline mr-2" />
                Instagram
              </label>
              <p className="text-body text-custom-text">
                {user.socialMedia?.instagram ? (
                  <a 
                    href={`https://instagram.com/${user.socialMedia.instagram.replace('@', '')}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-custom-primary hover:underline"
                  >
                    @{user.socialMedia.instagram.replace('@', '')}
                  </a>
                ) : (
                  'Not provided'
                )}
              </p>
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <Facebook className="w-4 h-4 inline mr-2" />
                Facebook
              </label>
              <p className="text-body text-custom-text">
                {user.socialMedia?.facebook ? (
                  <a 
                    href={user.socialMedia.facebook} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-custom-primary hover:underline"
                  >
                    {user.socialMedia.facebook}
                  </a>
                ) : (
                  'Not provided'
                )}
              </p>
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <LinkedinIcon className="w-4 h-4 inline mr-2" />
                LinkedIn
              </label>
              <p className="text-body text-custom-text">
                {user.socialMedia?.linkedin ? (
                  <a 
                    href={user.socialMedia.linkedin} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-custom-primary hover:underline"
                  >
                    {user.socialMedia.linkedin}
                  </a>
                ) : (
                  'Not provided'
                )}
              </p>
            </div>
          </div>
        </Card>

        {/* Skills */}
        {user.skills && user.skills.length > 0 && (
          <Card className="p-6">
            <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
              Skills
            </h2>
            <div className="flex flex-wrap gap-2">
              {user.skills.map((skill, index) => (
                <Badge key={index} variant="info">
                  {skill}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {/* Interests */}
        {user.interests && user.interests.length > 0 && (
          <Card className="p-6">
            <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
              Interests
            </h2>
            <div className="flex flex-wrap gap-2">
              {user.interests.map((interest, index) => (
                <Badge key={index} variant="success">
                  {interest}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Previous Camps */}
      {user.previousCamps && (
        <Card className="p-6 mt-6">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            Previous Camps
          </h2>
          <p className="text-body text-custom-text whitespace-pre-wrap">
            {user.previousCamps}
          </p>
        </Card>
      )}
    </div>
  );
};

export default MemberProfile;
