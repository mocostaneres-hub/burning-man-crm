import React, { useState, useEffect } from 'react';
import { Button, Input, Card, Badge } from '../../components/ui';
import { Edit, Save as SaveIcon, X, MapPin, Globe, Camera, Loader2, CheckCircle, Home } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import PhotoUpload from '../../components/profile/PhotoUpload';
import { InviteTemplateEditor } from '../../components/invites';

interface CampCategory {
  _id: string;
  name: string;
}

interface GlobalPerk {
  _id: string;
  name: string;
  icon: string;
  color: string;
}

interface SelectedPerk {
  perkId: string;
  isOn: boolean;
}

interface CampProfileData {
  campName: string;
  burningSince: number;
  hometown: string;
  contactEmail: string;
  website: string;
  description: string;
  categories: string[]; // Array of category IDs
  selectedPerks: SelectedPerk[]; // Array of selected perks
  acceptingNewMembers: boolean;
  showApplyNow: boolean;
  // Legacy offerings object for backward compatibility
  offerings: {
    water: boolean;
    fullPower: boolean;
    partialPower: boolean;
    rvPower: boolean;
    acceptsRVs: boolean;
    shadeForTents: boolean;
    showers: boolean;
    communalKitchen: boolean;
    storage: boolean;
    wifi: boolean;
    ice: boolean;
    food: boolean;
    coffee: boolean;
    bar: boolean;
    snacks: boolean;
    music: boolean;
    art: boolean;
    workshops: boolean;
    performances: boolean;
    games: boolean;
    yoga: boolean;
    meditation: boolean;
    bikeRepair: boolean;
    massage: boolean;
    hairStyling: boolean;
    facePainting: boolean;
    costumeRental: boolean;
    sharedSpace: boolean;
    campfire: boolean;
    socialEvents: boolean;
    welcomeNewbies: boolean;
  };
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
  visibility: 'public' | 'private';
}

const CampProfile: React.FC = () => {
  const { user } = useAuth();
  const [campCategories, setCampCategories] = useState<CampCategory[]>([]);
  const [globalPerks, setGlobalPerks] = useState<GlobalPerk[]>([]);
  const [campData, setCampData] = useState<CampProfileData>({
    campName: '',
    burningSince: new Date().getFullYear(),
    hometown: '',
    contactEmail: '',
    website: '',
    description: '',
    categories: [],
    selectedPerks: [],
    acceptingNewMembers: true,
    showApplyNow: true,
    offerings: {
      // Infrastructure
      water: false,
      fullPower: false,
      partialPower: false,
      rvPower: false,
      acceptsRVs: false,
      shadeForTents: false,
      showers: false,
      communalKitchen: false,
      storage: false,
      wifi: false,
      ice: false,
      // Food & Drink
      food: false,
      coffee: false,
      bar: false,
      snacks: false,
      // Activities & Entertainment
      music: false,
      art: false,
      workshops: false,
      performances: false,
      games: false,
      yoga: false,
      meditation: false,
      // Services
      bikeRepair: false,
      massage: false,
      hairStyling: false,
      facePainting: false,
      costumeRental: false,
      // Community
      sharedSpace: false,
      campfire: false,
      socialEvents: false,
      welcomeNewbies: false,
    },
    socialMedia: {},
    location: {
      street: '',
      crossStreet: '',
      time: '',
      description: ''
    },
    photos: [],
    visibility: 'public'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [campId, setCampId] = useState<string>('');

  useEffect(() => {
    if (user) {
      fetchCampProfile();
      loadCampCategories();
      loadGlobalPerks();
    }
  }, [user]);

  const fetchCampProfile = async () => {
    try {
      setLoading(true);
      const campResponse: any = await api.getMyCamp();
      
      // Store camp ID for later use
      setCampId(campResponse._id?.toString() || '');
      
      // Map API response to component's expected format
      setCampData({
        campName: campResponse.campName || campResponse.name || '',
        burningSince: campResponse.burningSince || campResponse.yearFounded || new Date().getFullYear(),
        hometown: campResponse.hometown || campResponse.location?.city || '',
        contactEmail: campResponse.contactEmail || '',
        website: campResponse.website || '',
        description: campResponse.description || '',
        categories: campResponse.categories || [],
        selectedPerks: campResponse.selectedPerks || [],
        acceptingNewMembers: campResponse.acceptingNewMembers ?? true,
        showApplyNow: campResponse.showApplyNow ?? true,
        offerings: campResponse.offerings || {
          // Infrastructure
          water: false,
          fullPower: false,
          partialPower: false,
          rvPower: false,
          acceptsRVs: false,
          shadeForTents: false,
          showers: false,
          communalKitchen: false,
          storage: false,
          wifi: false,
          ice: false,
          // Food & Drink
          food: false,
          coffee: false,
          bar: false,
          snacks: false,
          // Activities & Entertainment
          music: false,
          art: false,
          workshops: false,
          performances: false,
          games: false,
          yoga: false,
          meditation: false,
          // Services
          bikeRepair: false,
          massage: false,
          hairStyling: false,
          facePainting: false,
          costumeRental: false,
          // Community
          sharedSpace: false,
          campfire: false,
          socialEvents: false,
          welcomeNewbies: false,
        },
        socialMedia: campResponse.socialMedia || {},
        location: campResponse.location || {
          street: '',
          crossStreet: '',
          time: '',
          description: ''
        },
        photos: campResponse.photos || [],
        visibility: campResponse.isPublic ? 'public' : 'private'
      });
    } catch (err: any) {
      console.error('Error fetching camp profile:', err);
      
      // If camp doesn't exist yet (404), set up default values for new camp creation
      if (err.response?.status === 404) {
        console.log('🔍 [CampProfile] No camp found, setting up defaults for new camp creation');
        setCampId(''); // No camp ID yet
        
        // Set default values for new camp creation
        setCampData({
          campName: user?.campName || '', // Use the camp name from user registration
          burningSince: new Date().getFullYear(),
          hometown: '',
          contactEmail: user?.email || '',
          website: '',
          description: '',
          categories: [],
          selectedPerks: [],
          acceptingNewMembers: true,
          showApplyNow: true,
          offerings: {
            // Infrastructure
            water: false,
            fullPower: false,
            partialPower: false,
            rvPower: false,
            acceptsRVs: false,
            shadeForTents: false,
            showers: false,
            communalKitchen: false,
            storage: false,
            wifi: false,
            ice: false,
            // Food & Drink
            food: false,
            coffee: false,
            bar: false,
            snacks: false,
            // Activities & Entertainment
            music: false,
            art: false,
            workshops: false,
            performances: false,
            games: false,
            yoga: false,
            meditation: false,
            // Services
            bikeRepair: false,
            massage: false,
            hairStyling: false,
            facePainting: false,
            costumeRental: false,
            // Community
            sharedSpace: false,
            campfire: false,
            socialEvents: false,
            welcomeNewbies: false
          },
          socialMedia: {},
          location: {
            street: '',
            crossStreet: '',
            time: '',
            description: ''
          },
          photos: [],
          visibility: 'public'
        });
        setError(''); // Clear any error since this is expected for new camps
      } else {
        setError('Failed to load camp profile');
      }
    } finally {
      setLoading(false);
    }
  };


  const loadCampCategories = async () => {
    try {
      const response = await api.get('/categories');
      // The API service already unwraps response.data, so response IS the data
      setCampCategories(response.categories || []);
    } catch (error) {
      console.error('Failed to load camp categories:', error);
    }
  };

  const loadGlobalPerks = async () => {
    try {
      const response = await api.get('/perks');
      console.log('loadGlobalPerks response:', response);
      // The API service already unwraps response.data, so response IS the data
      const perksData = response.perks || [];
      setGlobalPerks(perksData);
    } catch (error) {
      console.error('Failed to load global perks:', error);
    }
  };

  const handleCategoryToggle = (categoryId: string) => {
    setCampData(prev => ({
      ...prev,
      categories: prev.categories.includes(categoryId)
        ? prev.categories.filter(id => id !== categoryId)
        : [...prev.categories, categoryId]
    }));
  };

  const handlePerkToggle = (perkId: string) => {
    setCampData(prev => {
      const existingPerk = prev.selectedPerks.find(p => p.perkId === perkId);
      
      if (existingPerk) {
        // Toggle isOn if exists
        return {
          ...prev,
          selectedPerks: prev.selectedPerks.map(p =>
            p.perkId === perkId ? { ...p, isOn: !p.isOn } : p
          )
        };
      } else {
        // Add new perk as ON
        return {
          ...prev,
          selectedPerks: [...prev.selectedPerks, { perkId, isOn: true }]
        };
      }
    });
  };

  const isPerkSelected = (perkId: string): boolean => {
    const perk = campData.selectedPerks.find(p => p.perkId === perkId);
    return perk ? perk.isOn : false;
  };


  const getOfferingIcon = (iconName: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      CheckCircle: <CheckCircle className="w-4 h-4" />,
      Home: <Home className="w-4 h-4" />
    };
    return iconMap[iconName] || <CheckCircle className="w-4 h-4" />;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      
      console.log('🔍 [CampProfile] Saving camp profile...');
      console.log('🔍 [CampProfile] User:', user);
      console.log('🔍 [CampProfile] Camp ID:', campId);
      
      // Prepare data for saving, including new fields
      const saveData = {
        ...campData,
        name: campData.campName, // Backend expects 'name' not 'campName'
        categories: campData.categories, // Array of category IDs
        selectedPerks: campData.selectedPerks, // Array of selected perks
        isPublic: campData.visibility === 'public'
      };

      let response;
      
      if (!campId) {
        // No camp exists yet, create a new one
        console.log('🔍 [CampProfile] Creating new camp...');
        response = await api.post('/camps', saveData);
        console.log('✅ [CampProfile] Camp created:', response);
        setCampId(response._id?.toString() || '');
      } else {
        // Update existing camp
        console.log('🔍 [CampProfile] Updating existing camp...');
        response = await api.put(`/camps/${campId}`, saveData);
        console.log('✅ [CampProfile] Camp updated:', response);
      }
      
      console.log('🔍 [CampProfile] Save data:', saveData);
      console.log('✅ [CampProfile] Save response:', response);
      setSuccess('Camp profile updated successfully!');
      setIsEditing(false);
      // Reload the profile to get updated data
      fetchCampProfile();
    } catch (err: any) {
      console.error('❌ [CampProfile] Error saving camp profile:', err);
      console.error('❌ [CampProfile] Error response:', err.response?.data);
      console.error('❌ [CampProfile] Error status:', err.response?.status);
      setError(err.response?.data?.message || 'Failed to save camp profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError('');
    fetchCampProfile();
  };

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setCampData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof CampProfileData] as any),
          [child]: value
        }
      }));
    } else {
      setCampData(prev => ({
        ...prev,
        [field]: value
      }));
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1 font-lato-bold text-custom-text">
          Camp Profile
        </h1>
        {!isEditing && (
          <Button
            variant="primary"
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card className="p-6">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            Basic Information
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Camp Name
              </label>
              {isEditing ? (
                <Input
                  value={campData.campName}
                  onChange={(e) => handleInputChange('campName', e.target.value)}
                  placeholder="Enter camp name"
                />
              ) : (
                <p className="text-body text-custom-text">{campData.campName}</p>
              )}
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Burning Since
              </label>
              {isEditing ? (
                <Input
                  type="number"
                  value={campData.burningSince}
                  onChange={(e) => handleInputChange('burningSince', parseInt(e.target.value))}
                  placeholder="Year"
                />
              ) : (
                <p className="text-body text-custom-text">{campData.burningSince}</p>
              )}
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Hometown
              </label>
              {isEditing ? (
                <Input
                  value={campData.hometown}
                  onChange={(e) => handleInputChange('hometown', e.target.value)}
                  placeholder="Enter hometown"
                />
              ) : (
                <p className="text-body text-custom-text">{campData.hometown}</p>
              )}
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Description
              </label>
              {isEditing ? (
                <textarea
                  value={campData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe your camp..."
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent resize-none"
                />
              ) : (
                <p className="text-body text-custom-text">{campData.description}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Contact Information */}
        <Card className="p-6">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            Contact Information
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <Globe className="w-4 h-4 inline mr-2" />
                Contact Email
              </label>
              {isEditing ? (
                <Input
                  type="email"
                  value={campData.contactEmail}
                  onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                  placeholder="Enter contact email"
                />
              ) : (
                <p className="text-body text-custom-text">{campData.contactEmail}</p>
              )}
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <Globe className="w-4 h-4 inline mr-2" />
                Website
              </label>
              {isEditing ? (
                <Input
                  value={campData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  placeholder="Enter website URL"
                />
              ) : (
                <p className="text-body text-custom-text">
                  {campData.website ? (
                    <a href={campData.website} target="_blank" rel="noopener noreferrer" className="text-custom-primary hover:underline">
                      {campData.website}
                    </a>
                  ) : (
                    'No website provided'
                  )}
                </p>
              )}
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <MapPin className="w-4 h-4 inline mr-2" />
                Playa Location
              </label>
              {isEditing ? (
                <Input
                  value={campData.location.street}
                  onChange={(e) => handleInputChange('location.street', e.target.value)}
                  placeholder="Enter street address"
                />
              ) : (
                <p className="text-body text-custom-text">
                  {campData.location.street || 'No location provided'}
                </p>
              )}
            </div>
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
                <Globe className="w-4 h-4 inline mr-2" />
                Facebook
              </label>
              {isEditing ? (
                <Input
                  value={campData.socialMedia.facebook || ''}
                  onChange={(e) => handleInputChange('socialMedia.facebook', e.target.value)}
                  placeholder="https://facebook.com/yourcamp"
                />
              ) : (
                <p className="text-body text-custom-text">
                  {campData.socialMedia.facebook ? (
                    <a href={campData.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="text-custom-primary hover:underline">
                      {campData.socialMedia.facebook}
                    </a>
                  ) : (
                    'Not provided'
                  )}
                </p>
              )}
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <Globe className="w-4 h-4 inline mr-2" />
                Instagram
              </label>
              {isEditing ? (
                <Input
                  value={campData.socialMedia.instagram || ''}
                  onChange={(e) => handleInputChange('socialMedia.instagram', e.target.value)}
                  placeholder="https://instagram.com/yourcamp"
                />
              ) : (
                <p className="text-body text-custom-text">
                  {campData.socialMedia.instagram ? (
                    <a href={campData.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="text-custom-primary hover:underline">
                      {campData.socialMedia.instagram}
                    </a>
                  ) : (
                    'Not provided'
                  )}
                </p>
              )}
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <Globe className="w-4 h-4 inline mr-2" />
                Twitter
              </label>
              {isEditing ? (
                <Input
                  value={campData.socialMedia.twitter || ''}
                  onChange={(e) => handleInputChange('socialMedia.twitter', e.target.value)}
                  placeholder="https://twitter.com/yourcamp"
                />
              ) : (
                <p className="text-body text-custom-text">
                  {campData.socialMedia.twitter ? (
                    <a href={campData.socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="text-custom-primary hover:underline">
                      {campData.socialMedia.twitter}
                    </a>
                  ) : (
                    'Not provided'
                  )}
                </p>
              )}
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                <Globe className="w-4 h-4 inline mr-2" />
                TikTok
              </label>
              {isEditing ? (
                <Input
                  value={campData.socialMedia.tiktok || ''}
                  onChange={(e) => handleInputChange('socialMedia.tiktok', e.target.value)}
                  placeholder="https://tiktok.com/@yourcamp"
                />
              ) : (
                <p className="text-body text-custom-text">
                  {campData.socialMedia.tiktok ? (
                    <a href={campData.socialMedia.tiktok} target="_blank" rel="noopener noreferrer" className="text-custom-primary hover:underline">
                      {campData.socialMedia.tiktok}
                    </a>
                  ) : (
                    'Not provided'
                  )}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Categories */}
        <Card className="p-6">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            Camp Categories
          </h2>
          
          {isEditing ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Select the categories that best describe your camp:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {campCategories.map((category) => (
                  <label key={category._id} className="flex items-center space-x-2 cursor-pointer p-2 rounded border hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={campData.categories.includes(category._id)}
                      onChange={() => handleCategoryToggle(category._id)}
                      className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                    />
                    <span className="text-sm text-custom-text">{category.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {campData.categories.map((categoryId) => {
                const category = campCategories.find(c => c._id === categoryId);
                return category ? (
                  <Badge key={categoryId} variant="neutral" className="px-3 py-1">
                    {category.name}
                  </Badge>
                ) : null;
              })}
              {campData.categories.length === 0 && (
                <p className="text-gray-500 italic">No categories selected</p>
              )}
            </div>
          )}
        </Card>

        {/* Camp Settings */}
        <Card className="p-6">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            Camp Settings
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-label font-medium text-custom-text mb-1">
                  Accepting New Members
                </label>
                <p className="text-sm text-gray-600">
                  Allow new people to apply to join your camp
                </p>
              </div>
              {isEditing ? (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={campData.acceptingNewMembers}
                    onChange={(e) => handleInputChange('acceptingNewMembers', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              ) : (
                <Badge variant={campData.acceptingNewMembers ? "success" : "neutral"}>
                  {campData.acceptingNewMembers ? "Yes" : "No"}
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="block text-label font-medium text-custom-text mb-1">
                  Show "Apply Now" Button
                </label>
                <p className="text-sm text-gray-600">
                  Display the apply button on your public camp page
                </p>
              </div>
              {isEditing ? (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={campData.showApplyNow}
                    onChange={(e) => handleInputChange('showApplyNow', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              ) : (
                <Badge variant={campData.showApplyNow ? "success" : "neutral"}>
                  {campData.showApplyNow ? "Yes" : "No"}
                </Badge>
              )}
            </div>
          </div>
        </Card>

        {/* Shared Amenities */}
        <Card className="p-6">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            Shared Amenities
          </h2>
          
          {isEditing ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Select the amenities your camp offers:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {globalPerks.map((perk) => (
                  <label key={perk._id} className="flex items-center space-x-2 cursor-pointer p-3 rounded border hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={isPerkSelected(perk._id)}
                      onChange={() => handlePerkToggle(perk._id)}
                      className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                    />
                    <span className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${perk.color}`}>
                      <span className="font-medium">{perk.name}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {campData.selectedPerks.filter(sp => sp.isOn).map((selectedPerk) => {
                const perk = globalPerks.find(p => p._id === selectedPerk.perkId);
                return perk ? (
                  <div key={selectedPerk.perkId} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${perk.color}`}>
                    <span className="font-medium text-sm text-gray-700">{perk.name}</span>
                  </div>
                ) : null;
              })}
              {campData.selectedPerks.filter(sp => sp.isOn).length === 0 && (
                <p className="text-gray-500 italic">No amenities selected</p>
              )}
            </div>
          )}
        </Card>

        {/* Photos */}
        <Card className="p-6">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            <Camera className="w-5 h-5 inline mr-2" />
            Photos
          </h2>
          
          <PhotoUpload
            photos={campData.photos}
            onPhotosChange={(photos: string[]) => handleInputChange('photos', photos)}
            isEditing={isEditing}
          />
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
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <SaveIcon className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}

      {/* Invite Templates Section - Only show when not editing profile */}
      {!isEditing && campId && (
        <div className="mt-8">
          <InviteTemplateEditor campId={campId} />
        </div>
      )}
    </div>
  );
};

export default CampProfile;
