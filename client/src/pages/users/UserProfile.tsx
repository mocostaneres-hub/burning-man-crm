import React, { useState, useEffect } from 'react';
import { Button, Input } from '../../components/ui';
import Footer from '../../components/layout/Footer';
import { Edit, Save as SaveIcon, X, User as UserIcon, Mail, Phone, MapPin, Calendar, Loader2, Instagram, Facebook, Linkedin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import PhotoUpload from '../../components/profile/PhotoUpload';
import { useSkills } from '../../hooks/useSkills';

interface UserProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  city: string;
  yearsBurned: number;
  bio: string;
  playaName?: string;
  profilePhoto?: string;
  hasTicket: boolean | null;
  hasVehiclePass: boolean | null;
  interestedInEAP: boolean;
  interestedInStrike: boolean;
  arrivalDate?: string;
  departureDate?: string;
  skills?: string[];
  socialMedia?: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
  };
}

const UserProfile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { skills: availableSkills, loading: skillsLoading } = useSkills();
  const [profileData, setProfileData] = useState<UserProfileData>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    city: '',
    yearsBurned: 0,
    bio: '',
    playaName: '',
    hasTicket: false,
    hasVehiclePass: false,
    interestedInEAP: false,
    interestedInStrike: false,
    skills: [],
    socialMedia: {}
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Helper function to convert Date to string
  const dateToString = (date: string | Date | undefined): string | undefined => {
    if (!date) return undefined;
    if (typeof date === 'string') return date;
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    return undefined;
  };

  useEffect(() => {
    if (user) {
      console.log('👤 [UserProfile] Loading user data:', user);
      console.log('👤 [UserProfile] Skills:', user.skills);
      console.log('👤 [UserProfile] Social Media:', user.socialMedia);
      console.log('👤 [UserProfile] Playa Name:', user.playaName);
      
      // Initialize profile data from user context
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        city: user.city || '',
        yearsBurned: user.yearsBurned || 0,
        bio: user.bio || '',
        playaName: user.playaName || '',
        profilePhoto: user.profilePhoto,
        hasTicket: user.hasTicket === true ? true : false,
        hasVehiclePass: user.hasVehiclePass === true ? true : false,
        interestedInEAP: user.interestedInEAP || false,
        interestedInStrike: user.interestedInStrike || false,
        arrivalDate: dateToString(user.arrivalDate),
        departureDate: dateToString(user.departureDate),
        skills: user.skills || [],
        socialMedia: user.socialMedia || {}
      });
    }
    setLoading(false);
  }, [user]);

  // Auto-enable edit mode for new users with minimal profile data
  useEffect(() => {
    if (!loading && user && profileData.firstName) {
      // Check if this is a newly created account (minimal profile data)
      const isNewUser = !profileData.bio && !profileData.playaName && profileData.yearsBurned === 0;
      if (isNewUser) {
        console.log('🔍 [UserProfile] New user detected, enabling edit mode');
        setIsEditing(true);
      }
    }
  }, [loading, profileData.firstName]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      // Update user profile via API
      console.log('🔄 [UserProfile] Saving profile data:', profileData);
      console.log('🔄 [UserProfile] Playa Name being saved:', profileData.playaName);
      const response = await api.put('/users/profile', profileData);
      console.log('✅ [UserProfile] Save response:', response);
      console.log('✅ [UserProfile] Response user object:', response.user);
      console.log('✅ [UserProfile] Response playaName:', response.user?.playaName);
      
      // Update the auth context with new data
      if (updateUser && response.user) {
        console.log('🔄 [UserProfile] Updating auth context with user:', response.user);
        updateUser(response.user);
      }
      
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original user data
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        city: user.city || '',
        yearsBurned: user.yearsBurned || 0,
        bio: user.bio || '',
        playaName: user.playaName || '',
        profilePhoto: user.profilePhoto,
        hasTicket: user.hasTicket === true ? true : false,
        hasVehiclePass: user.hasVehiclePass === true ? true : false,
        interestedInEAP: user.interestedInEAP || false,
        interestedInStrike: user.interestedInStrike || false,
        arrivalDate: dateToString(user.arrivalDate),
        departureDate: dateToString(user.departureDate),
        skills: user.skills || [],
        socialMedia: user.socialMedia || {}
      });
    }
    setIsEditing(false);
    setError('');
    setSuccess('');
  };

  const handleInputChange = (field: keyof UserProfileData, value: any) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePasswordChange = async () => {
    try {
      setPasswordError('');
      setPasswordSuccess('');

      // Validation
      if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        setPasswordError('All password fields are required');
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setPasswordError('New passwords do not match');
        return;
      }

      if (passwordData.newPassword.length < 6) {
        setPasswordError('New password must be at least 6 characters');
        return;
      }

      // Call API to change password
      await api.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      setPasswordSuccess('Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (err: any) {
      console.error('Error changing password:', err);
      setPasswordError(err.response?.data?.message || 'Failed to change password');
    }
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
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header Section - Profile Photo + Basic Info */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-6">
        {/* Cover/Banner Area */}
        <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600"></div>
        
        {/* Profile Header Content */}
        <div className="px-8 pb-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between -mt-16 mb-6">
            {/* Profile Photo Section */}
            <div className="flex flex-col md:flex-row md:items-end gap-6">
              <div className="relative flex-shrink-0">
                {profileData.profilePhoto ? (
                  <img
                    src={profileData.profilePhoto}
                    alt={`${profileData.firstName} ${profileData.lastName}`}
                    className="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover bg-white"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg bg-gray-200 flex items-center justify-center">
                    <UserIcon className="w-16 h-16 text-gray-400" />
                  </div>
                )}
                {isEditing && (
                  <div className="mt-4 max-w-[180px]">
                    <PhotoUpload
                      profilePhoto={profileData.profilePhoto}
                      onPhotoChange={(photoUrl) => handleInputChange('profilePhoto', photoUrl)}
                      isEditing={isEditing}
                    />
                  </div>
                )}
              </div>
              
              {/* Name and Basic Info */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                    <div className="min-w-0">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                        First Name
                      </label>
                      <Input
                        value={profileData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        placeholder="First name"
                        className="bg-white w-full"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                        Last Name
                      </label>
                      <Input
                        value={profileData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        placeholder="Last name"
                        className="bg-white w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                      {profileData.firstName} {profileData.lastName}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-gray-600">
                      {profileData.city && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{profileData.city}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {profileData.yearsBurned === 0 
                            ? '🔥 Virgin (First Burn!)' 
                            : `${profileData.yearsBurned} ${profileData.yearsBurned === 1 ? 'Burn' : 'Burns'}`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Edit Button */}
            {!isEditing && (
              <Button
                variant="primary"
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 mt-4 md:mt-0"
              >
                <Edit className="w-4 h-4" />
                Edit Profile
              </Button>
            )}
          </div>

          {/* Contact Info Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-gray-200">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Email
              </label>
              {isEditing ? (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span>{profileData.email}</span>
                  <span className="text-xs text-gray-400">(cannot be changed)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-900">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{profileData.email}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              {isEditing ? (
                <Input
                  value={profileData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  placeholder="Enter phone number"
                  className="bg-white"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-900">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{profileData.phoneNumber || 'Not provided'}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                City
              </label>
              {isEditing ? (
                <Input
                  value={profileData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  placeholder="Enter city"
                  className="bg-white"
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-900">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{profileData.city || 'Not provided'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Burning Man Experience */}
          {isEditing && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Years Burned
              </label>
              <Input
                type="number"
                min="0"
                value={profileData.yearsBurned}
                onChange={(e) => handleInputChange('yearsBurned', parseInt(e.target.value) || 0)}
                placeholder="0"
                className="bg-white max-w-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
          <p className="text-sm text-red-800 font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg">
          <p className="text-sm text-green-800 font-medium">{success}</p>
        </div>
      )}

      {/* About Me Section */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-blue-600" />
          About Me
        </h2>
        
        {isEditing ? (
          <textarea
            value={profileData.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            placeholder="Tell us about yourself, your Burning Man experience, what you're passionate about..."
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical min-h-[150px] text-gray-900"
          />
        ) : (
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
            {profileData.bio || (
              <span className="text-gray-400 italic">No bio provided yet. Click "Edit Profile" to add one!</span>
            )}
          </p>
        )}
      </div>

      {/* Playa Name Section */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-orange-600" />
          Playa Name
        </h2>
        
        {isEditing ? (
          <div className="max-w-md">
            <Input
              value={profileData.playaName || ''}
              onChange={(e) => handleInputChange('playaName', e.target.value)}
              placeholder="Enter your playa name (optional)"
              className="bg-white"
            />
            <p className="text-sm text-gray-500 mt-2">
              Your playa name is the name you go by at Burning Man events.
            </p>
          </div>
        ) : (
          <div className="text-gray-700">
            {profileData.playaName ? (
              <span className="text-xl font-semibold text-orange-600">
                "{profileData.playaName}"
              </span>
            ) : (
              <span className="text-gray-400 italic">No playa name set. Click "Edit Profile" to add one!</span>
            )}
          </div>
        )}
      </div>

      {/* Ticket & Vehicle Pass Section */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Ticket & Vehicle Pass
        </h2>
        
        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-3">
                Do you have a Burning Man ticket?
              </label>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="hasTicket"
                    checked={profileData.hasTicket === true}
                    onChange={() => handleInputChange('hasTicket', true)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-900">Yes</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="hasTicket"
                    checked={profileData.hasTicket === false}
                    onChange={() => handleInputChange('hasTicket', false)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-900">No</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-3">
                Do you have a Vehicle Pass?
              </label>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="hasVehiclePass"
                    checked={profileData.hasVehiclePass === true}
                    onChange={() => handleInputChange('hasVehiclePass', true)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-900">Yes</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="hasVehiclePass"
                    checked={profileData.hasVehiclePass === false}
                    onChange={() => handleInputChange('hasVehiclePass', false)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-900">No</span>
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600">Ticket: </span>
              <span className={`font-medium ${
                profileData.hasTicket === true ? 'text-green-600' : 'text-red-600'
              }`}>
                {profileData.hasTicket === true ? '✓ Yes' : '✗ No'}
              </span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Has VP: </span>
              <span className={`font-medium ${
                profileData.hasVehiclePass === true ? 'text-green-600' : 'text-red-600'
              }`}>
                {profileData.hasVehiclePass === true ? '✓ Yes' : '✗ No'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Travel Dates Section */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-600" />
          Travel Dates
        </h2>
        
        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Arrival Date
              </label>
              <Input
                type="date"
                value={profileData.arrivalDate ? profileData.arrivalDate.split('T')[0] : ''}
                onChange={(e) => handleInputChange('arrivalDate', e.target.value)}
                className="bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Departure Date
              </label>
              <Input
                type="date"
                value={profileData.departureDate ? profileData.departureDate.split('T')[0] : ''}
                onChange={(e) => handleInputChange('departureDate', e.target.value)}
                className="bg-white"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600">Arriving: </span>
              <span className="font-medium text-gray-900">
                {profileData.arrivalDate ? new Date(profileData.arrivalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
              </span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Departing: </span>
              <span className="font-medium text-gray-900">
                {profileData.departureDate ? new Date(profileData.departureDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Early Arrival & Late Departure Section */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          Early Arrival & Late Departure
        </h2>
        
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profileData.interestedInEAP}
                  onChange={(e) => handleInputChange('interestedInEAP', e.target.checked)}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <div>
                  <span className="text-gray-900 font-medium">Interested in Early Arrival Pass (EAP)</span>
                  <p className="text-sm text-gray-500">Arrive before the event officially opens</p>
                </div>
              </label>
            </div>
            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={profileData.interestedInStrike}
                  onChange={(e) => handleInputChange('interestedInStrike', e.target.checked)}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <div>
                  <span className="text-gray-900 font-medium">Interested in Late Departure (Strike Team)</span>
                  <p className="text-sm text-gray-500">Stay after the event to help with cleanup</p>
                </div>
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-600">Early Arrival: </span>
              <span className={`font-medium ${profileData.interestedInEAP ? 'text-green-600' : 'text-gray-400'}`}>
                {profileData.interestedInEAP ? '✓ Interested' : 'Not interested'}
              </span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Late Departure: </span>
              <span className={`font-medium ${profileData.interestedInStrike ? 'text-green-600' : 'text-gray-400'}`}>
                {profileData.interestedInStrike ? '✓ Interested' : 'Not interested'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Skills Section */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-green-600" />
          Skills & Interests
        </h2>
        
        {isEditing ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {profileData.skills?.map((skill, index) => (
                <div key={index} className="flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newSkills = profileData.skills?.filter((_, i) => i !== index) || [];
                      handleInputChange('skills', newSkills);
                    }}
                    className="hover:bg-green-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                Select Skills
              </label>
              <select
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                value=""
                onChange={(e) => {
                  const skill = e.target.value;
                  if (skill && !profileData.skills?.includes(skill)) {
                    handleInputChange('skills', [...(profileData.skills || []), skill].sort());
                  }
                  // Reset dropdown
                  e.target.value = '';
                }}
                disabled={skillsLoading}
              >
                <option value="">{skillsLoading ? 'Loading skills...' : 'Choose a skill to add...'}</option>
                {availableSkills.map((skill) => (
                  <option key={skill} value={skill}>{skill}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {profileData.skills && profileData.skills.length > 0 ? (
              profileData.skills.map((skill, index) => (
                <span key={index} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-gray-400 italic">No skills added yet. Click "Edit Profile" to add some!</span>
            )}
          </div>
        )}
      </div>

      {/* Social Media Section */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Instagram className="w-5 h-5 text-pink-600" />
          Social Media
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Instagram */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Instagram className="w-4 h-4 text-pink-600" />
              Instagram
            </label>
            {isEditing ? (
              <Input
                value={profileData.socialMedia?.instagram || ''}
                onChange={(e) => handleInputChange('socialMedia', {
                  ...profileData.socialMedia,
                  instagram: e.target.value
                })}
                placeholder="@username or full URL"
                className="bg-white"
              />
            ) : (
              <div className="text-sm text-gray-900">
                {profileData.socialMedia?.instagram ? (
                  <a
                    href={profileData.socialMedia.instagram.startsWith('http') 
                      ? profileData.socialMedia.instagram 
                      : `https://instagram.com/${profileData.socialMedia.instagram.replace('@', '')}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pink-600 hover:text-pink-700 flex items-center gap-1"
                  >
                    <Instagram className="w-4 h-4" />
                    {profileData.socialMedia.instagram}
                  </a>
                ) : (
                  <span className="text-gray-400">Not provided</span>
                )}
              </div>
            )}
          </div>

          {/* Facebook */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Facebook className="w-4 h-4 text-blue-600" />
              Facebook
            </label>
            {isEditing ? (
              <Input
                value={profileData.socialMedia?.facebook || ''}
                onChange={(e) => handleInputChange('socialMedia', {
                  ...profileData.socialMedia,
                  facebook: e.target.value
                })}
                placeholder="@username or full URL"
                className="bg-white"
              />
            ) : (
              <div className="text-sm text-gray-900">
                {profileData.socialMedia?.facebook ? (
                  <a
                    href={profileData.socialMedia.facebook.startsWith('http') 
                      ? profileData.socialMedia.facebook 
                      : `https://facebook.com/${profileData.socialMedia.facebook.replace('@', '')}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Facebook className="w-4 h-4" />
                    {profileData.socialMedia.facebook}
                  </a>
                ) : (
                  <span className="text-gray-400">Not provided</span>
                )}
              </div>
            )}
          </div>

          {/* LinkedIn */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-blue-700" />
              LinkedIn
            </label>
            {isEditing ? (
              <Input
                value={profileData.socialMedia?.linkedin || ''}
                onChange={(e) => handleInputChange('socialMedia', {
                  ...profileData.socialMedia,
                  linkedin: e.target.value
                })}
                placeholder="@username or full URL"
                className="bg-white"
              />
            ) : (
              <div className="text-sm text-gray-900">
                {profileData.socialMedia?.linkedin ? (
                  <a
                    href={profileData.socialMedia.linkedin.startsWith('http') 
                      ? profileData.socialMedia.linkedin 
                      : `https://linkedin.com/in/${profileData.socialMedia.linkedin.replace('@', '')}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-700 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Linkedin className="w-4 h-4" />
                    {profileData.socialMedia.linkedin}
                  </a>
                ) : (
                  <span className="text-gray-400">Not provided</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save/Cancel Buttons for Profile Edit */}
      {isEditing && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-2 px-6"
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <SaveIcon className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Change Password Section - Full Width at Bottom */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2 border-b border-gray-200 pb-4">
          <SaveIcon className="w-5 h-5 text-blue-600" />
          Change Password
        </h2>

        {passwordError && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
            <p className="text-sm text-red-800 font-medium">{passwordError}</p>
          </div>
        )}

        {passwordSuccess && (
          <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg">
            <p className="text-sm text-green-800 font-medium">{passwordSuccess}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Current Password
            </label>
            <Input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
              placeholder="Enter current password"
              className="bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              New Password
            </label>
            <Input
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
              placeholder="Enter new password"
              className="bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Confirm New Password
            </label>
            <Input
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="Confirm new password"
              className="bg-gray-50"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end pt-6 border-t border-gray-200">
          <Button
            variant="primary"
            onClick={handlePasswordChange}
            className="flex items-center gap-2 px-6"
          >
            <SaveIcon className="w-4 h-4" />
            Change Password
          </Button>
        </div>
      </div>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default UserProfile;
