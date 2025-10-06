import React, { useState, useEffect } from 'react';
import { Button, Input, Card } from '../../components/ui';
import { Save as SaveIcon, X, Edit, Phone as PhoneIcon, MapPin, Calendar, Instagram, Facebook, Linkedin as LinkedinIcon, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';
import PhotoUpload from '../../components/profile/PhotoUpload';
import { useSkills } from '../../hooks/useSkills';

interface MemberProfileData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  city: string;
  yearsBurned: number;
  isFirstBurn: boolean;
  previousCamps: string;
  skills: string[];
  interests: string[];
  bio: string;
  profilePhoto?: string;
  socialMedia: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
  };
}

const INTERESTS_OPTIONS = [
  'Art & Music', 'Food & Drinks', 'Wellness & Healing', 'Technology & Innovation',
  'Performance & Theater', 'Community & Social', 'Spiritual & Religious',
  'LGBT/Queer', 'Sex Positive', '18+', 'Gym', 'Sauna', 'Cooking', 'Bondage',
  'Kids Friendly', 'Religion', 'Bar', 'Coffee', 'Breakfast', 'Lunch', 'Dinner',
  'Late Night', 'Other'
];

const MemberProfileEdit: React.FC = () => {
  const { user } = useAuth();
  const { skills: SKILLS_OPTIONS } = useSkills();
  const [profileData, setProfileData] = useState<MemberProfileData>({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    city: '',
    yearsBurned: 0,
    isFirstBurn: false,
    previousCamps: '',
    skills: [],
    interests: [],
    bio: '',
    socialMedia: {}
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await apiService.getUserProfile();
      const userData = response.user;
      
      // Map user data to MemberProfileData
      setProfileData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        phoneNumber: userData.phoneNumber || '',
        city: userData.city || '',
        yearsBurned: userData.yearsBurned || 0,
        isFirstBurn: userData.yearsBurned === 0,
        previousCamps: userData.previousCamps || '',
        skills: userData.skills || [],
        interests: userData.interests || [],
        bio: userData.bio || '',
        profilePhoto: userData.profilePhoto,
        socialMedia: userData.socialMedia || {}
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      await apiService.updateUserProfile(profileData);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    fetchProfile();
  };

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setProfileData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof MemberProfileData] as any),
          [child]: value
        }
      }));
    } else {
      setProfileData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleArrayToggle = (field: 'skills' | 'interests', value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(item => item !== value)
        : [...prev[field], value]
    }));
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 animate-spin text-custom-primary">
            <Loader2 />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1 font-lato-bold text-custom-text">
          Edit Profile
        </h1>
        {!isEditing && (
          <Button
            variant="primary"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2"
          >
            <div className="w-4 h-4">
              <Edit />
            </div>
            Edit Profile
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded relative" role="alert">
          <span className="block sm:inline">{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Photo */}
        <div className="lg:col-span-1">
          <Card className="p-6 text-center">
            <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
              Profile Photo
            </h2>
            <PhotoUpload
              profilePhoto={profileData.profilePhoto}
              onPhotoChange={(photo) => handleInputChange('profilePhoto', photo)}
              isEditing={isEditing}
            />
          </Card>
        </div>

        {/* Basic Information */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
              Basic Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-label font-medium text-custom-text mb-2">
                  First Name
                </label>
                {isEditing ? (
                  <Input
                    value={profileData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder="Enter first name"
                  />
                ) : (
                  <p className="text-body text-custom-text">{profileData.firstName}</p>
                )}
              </div>

              <div>
                <label className="block text-label font-medium text-custom-text mb-2">
                  Last Name
                </label>
                {isEditing ? (
                  <Input
                    value={profileData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    placeholder="Enter last name"
                  />
                ) : (
                  <p className="text-body text-custom-text">{profileData.lastName}</p>
                )}
              </div>

              <div>
                <label className="block text-label font-medium text-custom-text mb-2">
                  <div className="w-4 h-4 inline mr-2">
                    <PhoneIcon />
                  </div>
                  Phone Number
                </label>
                {isEditing ? (
                  <Input
                    value={profileData.phoneNumber}
                    onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                    placeholder="Enter phone number"
                  />
                ) : (
                  <p className="text-body text-custom-text">{profileData.phoneNumber}</p>
                )}
              </div>

              <div>
                <label className="block text-label font-medium text-custom-text mb-2">
                  <div className="w-4 h-4 inline mr-2">
                    <MapPin />
                  </div>
                  City
                </label>
                {isEditing ? (
                  <Input
                    value={profileData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="Enter city"
                  />
                ) : (
                  <p className="text-body text-custom-text">{profileData.city}</p>
                )}
              </div>

              <div>
                <label className="block text-label font-medium text-custom-text mb-2">
                  <div className="w-4 h-4 inline mr-2">
                    <Calendar />
                  </div>
                  Years Burned
                </label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={profileData.yearsBurned}
                    onChange={(e) => handleInputChange('yearsBurned', parseInt(e.target.value))}
                    placeholder="0"
                  />
                ) : (
                  <p className="text-body text-custom-text">{profileData.yearsBurned}</p>
                )}
              </div>

              <div>
                <label className="block text-label font-medium text-custom-text mb-2">
                  First Burn?
                </label>
                {isEditing ? (
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profileData.isFirstBurn}
                      onChange={(e) => handleInputChange('isFirstBurn', e.target.checked)}
                      className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                    />
                    <span className="text-sm text-custom-text">This is my first burn</span>
                  </label>
                ) : (
                  <p className="text-body text-custom-text">
                    {profileData.isFirstBurn ? 'Yes' : 'No'}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-label font-medium text-custom-text mb-2">
                Bio
              </label>
              {isEditing ? (
                <textarea
                  value={profileData.bio}
                  onChange={(e) => handleInputChange('bio', e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent resize-none"
                />
              ) : (
                <p className="text-body text-custom-text">{profileData.bio}</p>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-label font-medium text-custom-text mb-2">
                Previous Camps
              </label>
              {isEditing ? (
                <textarea
                  value={profileData.previousCamps}
                  onChange={(e) => handleInputChange('previousCamps', e.target.value)}
                  placeholder="List any previous camps you've been part of..."
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent resize-none"
                />
              ) : (
                <p className="text-body text-custom-text">{profileData.previousCamps}</p>
              )}
            </div>
          </Card>
        </div>

        {/* Skills */}
        <Card className="p-6">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            Skills
          </h2>
          
          <div className="grid grid-cols-2 gap-2">
            {SKILLS_OPTIONS.map((skill) => (
              <label key={skill} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profileData.skills.includes(skill)}
                  onChange={() => handleArrayToggle('skills', skill)}
                  disabled={!isEditing}
                  className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                />
                <span className="text-sm text-custom-text">{skill}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* Interests */}
        <Card className="p-6">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            Interests
          </h2>
          
          <div className="grid grid-cols-2 gap-2">
            {INTERESTS_OPTIONS.map((interest) => (
              <label key={interest} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profileData.interests.includes(interest)}
                  onChange={() => handleArrayToggle('interests', interest)}
                  disabled={!isEditing}
                  className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                />
                <span className="text-sm text-custom-text">{interest}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* Social Media */}
        <Card className="p-6">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            Social Media
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <div className="w-4 h-4 inline mr-2">
                  <Instagram />
                </div>
                Instagram
              </label>
              {isEditing ? (
                <Input
                  value={profileData.socialMedia.instagram || ''}
                  onChange={(e) => handleInputChange('socialMedia.instagram', e.target.value)}
                  placeholder="@username"
                />
              ) : (
                <p className="text-body text-custom-text">
                  {profileData.socialMedia.instagram || 'Not provided'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <div className="w-4 h-4 inline mr-2">
                  <Facebook />
                </div>
                Facebook
              </label>
              {isEditing ? (
                <Input
                  value={profileData.socialMedia.facebook || ''}
                  onChange={(e) => handleInputChange('socialMedia.facebook', e.target.value)}
                  placeholder="Facebook profile URL"
                />
              ) : (
                <p className="text-body text-custom-text">
                  {profileData.socialMedia.facebook || 'Not provided'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <div className="w-4 h-4 inline mr-2">
                  <LinkedinIcon />
                </div>
                LinkedIn
              </label>
              {isEditing ? (
                <Input
                  value={profileData.socialMedia.linkedin || ''}
                  onChange={(e) => handleInputChange('socialMedia.linkedin', e.target.value)}
                  placeholder="LinkedIn profile URL"
                />
              ) : (
                <p className="text-body text-custom-text">
                  {profileData.socialMedia.linkedin || 'Not provided'}
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Action Buttons */}
      {isEditing && (
        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
          >
            <div className="w-4 h-4 mr-2">
              <X />
            </div>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 mr-2 animate-spin">
                  <Loader2 />
                </div>
                Saving...
              </>
            ) : (
              <>
                <div className="w-4 h-4 mr-2">
                  <SaveIcon />
                </div>
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default MemberProfileEdit;