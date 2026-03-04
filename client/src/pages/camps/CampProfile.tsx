import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, Input, Card, Badge } from '../../components/ui';
import { Edit, Save as SaveIcon, X, MapPin, Globe, Camera, Loader2, CheckCircle, Home, Mail, Shield, AlertTriangle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import PhotoUpload from '../../components/profile/PhotoUpload';
import { InviteTemplateEditor } from '../../components/invites';
import CityAutocomplete from '../../components/location/CityAutocomplete';
import { StructuredLocation } from '../../types';

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

interface CampPhoto {
  url: string;
  caption: string;
  isPrimary: boolean;
}

interface CampProfileData {
  campName: string;
  burningSince: number;
  contactEmail: string;
  website: string;
  description: string;
  categories: string[]; // Array of category IDs
  selectedPerks: SelectedPerk[]; // Array of selected perks
  isPubliclyVisible: boolean;
  acceptingApplications: boolean;
  applicationInstructions: string;
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
    city?: string;
    state?: string;
    country?: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
    placeId?: string;
    street: string;
    crossStreet: string;
    time: string;
    description: string;
  };
  photos: (string | CampPhoto)[]; // Support both legacy string format and new object format
  visibility: 'public' | 'private';
}

const toStructuredLocationOrNull = (location: CampProfileData['location'] | any): StructuredLocation | null => {
  if (!location) return null;
  if (!location.city || !location.country || !location.countryCode) return null;
  if (location.lat === undefined || location.lng === undefined) return null;
  return {
    city: location.city,
    state: location.state,
    country: location.country,
    countryCode: location.countryCode,
    lat: Number(location.lat),
    lng: Number(location.lng),
    placeId: location.placeId
  };
};

const mergeStructuredLocation = (
  existing: CampProfileData['location'],
  selected: StructuredLocation | null
): CampProfileData['location'] => {
  if (!selected) {
    return {
      ...existing,
      city: undefined,
      state: undefined,
      country: undefined,
      countryCode: undefined,
      lat: undefined,
      lng: undefined,
      placeId: undefined
    };
  }

  return {
    ...existing,
    city: selected.city,
    state: selected.state,
    country: selected.country,
    countryCode: selected.countryCode,
    lat: selected.lat,
    lng: selected.lng,
    placeId: selected.placeId
  };
};

// Helper function to dynamically render Lucide icons
const renderIcon = (iconName: string) => {
  const IconComponent = (LucideIcons as any)[iconName];
  if (IconComponent) {
    return <IconComponent className="w-4 h-4" />;
  }
  return null;
};

const CampProfile: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { campIdentifier } = useParams<{ campIdentifier: string }>();
  const [campCategories, setCampCategories] = useState<CampCategory[]>([]);
  const [globalPerks, setGlobalPerks] = useState<GlobalPerk[]>([]);
  const [campData, setCampData] = useState<CampProfileData>({
    campName: '',
    burningSince: new Date().getFullYear(),
    contactEmail: '',
    website: '',
    description: '',
    categories: [],
    selectedPerks: [],
    isPubliclyVisible: false, // New camps default to private
    acceptingApplications: true,
    applicationInstructions: '',
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
  const [legacyHometown, setLegacyHometown] = useState<string>('');
  
  // Login Credentials State (for camp accounts only)
  const [loginCredentials, setLoginCredentials] = useState({
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showLoginCredentials, setShowLoginCredentials] = useState(false);
  const [credentialsSaving, setCredentialsSaving] = useState(false);
  const [credentialsSuccess, setCredentialsSuccess] = useState('');
  const [credentialsError, setCredentialsError] = useState('');

  useEffect(() => {
    if (user && campIdentifier) {
      // Security check: Verify the campIdentifier matches the user's camp
      const userCampId = user.campId?.toString() || user._id?.toString();
      const identifierMatches = campIdentifier === userCampId || 
                                campIdentifier === user.urlSlug ||
                                (user.campName && campIdentifier === user.campName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
      
      if (!identifierMatches) {
        console.error('❌ [CampProfile] Camp identifier mismatch. Redirecting...');
        // Redirect to dashboard if identifier doesn't match
        navigate('/dashboard', { replace: true });
        return;
      }
      
      fetchCampProfile();
      loadCampCategories();
      loadGlobalPerks();
    }
  }, [user, campIdentifier, navigate]);

  // Auto-enable edit mode for new camps with minimal data or when coming from public profile
  useEffect(() => {
    if (!loading && campData.campName) {
      // Check if this is a newly created camp (minimal profile data)
      const isNewCamp = !campData.description || campData.description.includes('We\'re excited to share our camp experience');
      // Check if user came from public profile with editMode flag
      const shouldEdit = location.state?.editMode;
      
      if (isNewCamp || shouldEdit) {
        console.log('🔍 [CampProfile] Enabling edit mode:', { isNewCamp, shouldEdit });
        setIsEditing(true);
      }
    }
  }, [loading, campData.campName, location.state]);

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
        contactEmail: campResponse.contactEmail || '',
        website: campResponse.website || '',
        description: campResponse.description || '',
        categories: campResponse.categories || [],
        selectedPerks: campResponse.selectedPerks || [],
        isPubliclyVisible: campResponse.isPubliclyVisible ?? false,
        acceptingApplications: campResponse.acceptingApplications ?? true,
        applicationInstructions: campResponse.applicationInstructions || '',
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
          city: '',
          state: '',
          country: '',
          countryCode: '',
          lat: undefined,
          lng: undefined,
          placeId: '',
          street: '',
          crossStreet: '',
          time: '',
          description: ''
        },
        photos: campResponse.photos || [],
        visibility: campResponse.isPublic ? 'public' : 'private'
      });
      setLegacyHometown(campResponse.hometown || '');
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
          contactEmail: user?.email || '',
          website: '',
          description: '',
          categories: [],
          selectedPerks: [],
          isPubliclyVisible: false, // New camps default to private
          acceptingApplications: true,
          applicationInstructions: '',
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
            city: '',
            state: '',
            country: '',
            countryCode: '',
            lat: undefined,
            lng: undefined,
            placeId: '',
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
      
      // Prepare data for saving. Send structured location only when complete (from CityAutocomplete selection).
      // Otherwise send hometown as string so backend accepts legacy; omit location to avoid overwriting with partial data.
      const { photos, ...campDataWithoutPhotos } = campData;
      const structuredLocation = toStructuredLocationOrNull(campData.location);
      const saveData: Record<string, unknown> = {
        ...campDataWithoutPhotos,
        name: campData.campName, // Backend expects 'name' not 'campName'
        categories: campData.categories,
        selectedPerks: campData.selectedPerks,
        isPublic: campData.visibility === 'public'
      };
      
      // Remove deprecated contactEmail from save payload for privacy
      delete saveData.contactEmail;
      if (structuredLocation) {
        saveData.location = { ...campData.location, ...structuredLocation };
        saveData.hometown = structuredLocation.city;
      } else {
        saveData.hometown = campData.location?.city?.trim() || legacyHometown || '';
        // Omit location so backend keeps existing; backend accepts legacy string hometown
        delete saveData.location;
      }

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
      
      // Extract slug from response (could be in response.camp.slug or response.slug)
      const updatedCamp = response.camp || response;
      const newSlug = updatedCamp?.slug;
      
      setSuccess('Camp profile updated successfully!');
      setIsEditing(false);
      
      // Reload the profile to get updated data
      fetchCampProfile();
      
      // If slug is available and camp name was changed, navigate to public URL
      // This allows users to see their public profile immediately after updating
      if (newSlug && saveData.name) {
        // Small delay to ensure state is updated before navigation
        setTimeout(() => {
          navigate(`/camps/${newSlug}`, { replace: false });
        }, 500);
      }
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

  const handleCredentialsUpdate = async () => {
    try {
      setCredentialsSaving(true);
      setCredentialsError('');
      setCredentialsSuccess('');

      // Validation
      if (!loginCredentials.email || !loginCredentials.currentPassword) {
        setCredentialsError('Email and current password are required');
        return;
      }

      if (loginCredentials.newPassword && loginCredentials.newPassword !== loginCredentials.confirmPassword) {
        setCredentialsError('New passwords do not match');
        return;
      }

      if (loginCredentials.newPassword && loginCredentials.newPassword.length < 6) {
        setCredentialsError('New password must be at least 6 characters');
        return;
      }

      // Prepare update payload
      const updatePayload: any = {
        email: loginCredentials.email,
        currentPassword: loginCredentials.currentPassword
      };

      if (loginCredentials.newPassword) {
        updatePayload.newPassword = loginCredentials.newPassword;
      }

      // Call API to update credentials
      const response = await api.put('/auth/update-credentials', updatePayload);

      if (response.data.success) {
        setCredentialsSuccess('Login credentials updated successfully');
        // Reset form
        setLoginCredentials({ email: loginCredentials.email, currentPassword: '', newPassword: '', confirmPassword: '' });
        
        // If email changed, they may need to log in again
        if (loginCredentials.email !== user?.email) {
          setCredentialsSuccess('Email updated successfully. Please log in again with your new email.');
        }
      } else {
        setCredentialsError(response.data.message || 'Failed to update credentials');
      }
    } catch (error: any) {
      console.error('Error updating credentials:', error);
      setCredentialsError(error.response?.data?.message || 'Failed to update credentials');
    } finally {
      setCredentialsSaving(false);
    }
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

  // Refresh only photos after upload/delete to avoid wiping unsaved form edits.
  const syncCampPhotosOnly = async () => {
    try {
      const freshCamp: any = await api.getMyCamp();
      setCampId(freshCamp?._id?.toString() || campId);
      setCampData((prev) => ({
        ...prev,
        photos: freshCamp?.photos || []
      }));
    } catch (refreshError) {
      console.error('Failed to refresh camp photos:', refreshError);
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
                (user?.accountType === 'admin' && !user?.campId) ? (
                  <Input
                    value={campData.campName}
                    onChange={(e) => handleInputChange('campName', e.target.value)}
                    placeholder="Enter camp name"
                  />
                ) : (
                  <>
                    <Input
                      value={campData.campName}
                      readOnly
                      disabled
                      className="bg-gray-100 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Camp name sets your camp URL and can only be changed by a system admin.
                    </p>
                  </>
                )
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
                <CityAutocomplete
                  value={toStructuredLocationOrNull(campData.location)}
                  onChange={(selected) => {
                    setCampData((prev) => ({
                      ...prev,
                      location: mergeStructuredLocation(prev.location, selected)
                    }));
                  }}
                  label=""
                  placeholder="Search and select camp city"
                  legacyValue={legacyHometown}
                />
              ) : (
                <p className="text-body text-custom-text">
                  {toStructuredLocationOrNull(campData.location)
                    ? [campData.location.city, campData.location.state, campData.location.country].filter(Boolean).join(', ')
                    : (legacyHometown ? `${legacyHometown} (unverified)` : '')}
                </p>
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
            {/* Contact Email field removed for privacy - no longer publicly editable */}

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
                    (() => {
                      // Display raw value, but ensure href has protocol for clickability
                      const isAbsolute = campData.website.startsWith('http://') || campData.website.startsWith('https://');
                      const hrefLink = isAbsolute ? campData.website : `https://${campData.website}`;
                      return (
                        <a href={hrefLink} target="_blank" rel="noopener noreferrer" className="text-custom-primary hover:underline">
                          {campData.website}
                        </a>
                      );
                    })()
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

        {/* Login Credentials - Only for Camp Accounts */}
        {user?.accountType === 'camp' && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h2 font-lato-bold text-custom-text flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Account Login Credentials
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowLoginCredentials(!showLoginCredentials);
                  if (!showLoginCredentials) {
                    // Initialize with current user email
                    setLoginCredentials(prev => ({ ...prev, email: user?.email || '' }));
                  }
                }}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                {showLoginCredentials ? 'Cancel' : 'Update Credentials'}
              </Button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <strong>Authentication Email Only:</strong> This email is used strictly for account login and is never displayed publicly. 
                  Visitors will contact your camp through social media links or camp applications.
                </div>
              </div>
            </div>

            {showLoginCredentials && (
              <div className="space-y-4">
                {credentialsError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <p className="text-sm text-red-800">{credentialsError}</p>
                    </div>
                  </div>
                )}

                {credentialsSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <p className="text-sm text-green-800">{credentialsSuccess}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-label font-medium text-custom-text mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Login Email *
                  </label>
                  <Input
                    type="email"
                    value={loginCredentials.email}
                    onChange={(e) => setLoginCredentials(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your login email"
                    disabled={credentialsSaving}
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    This email will be used for account authentication only
                  </p>
                </div>

                <div>
                  <label className="block text-label font-medium text-custom-text mb-2">
                    <Shield className="w-4 h-4 inline mr-2" />
                    Current Password *
                  </label>
                  <div className="relative">
                    <Input
                      type="password"
                      value={loginCredentials.currentPassword}
                      onChange={(e) => setLoginCredentials(prev => ({ ...prev, currentPassword: e.target.value }))}
                      placeholder="Enter your current password"
                      disabled={credentialsSaving}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-label font-medium text-custom-text mb-2">
                    <Shield className="w-4 h-4 inline mr-2" />
                    New Password
                  </label>
                  <div className="relative">
                    <Input
                      type="password"
                      value={loginCredentials.newPassword}
                      onChange={(e) => setLoginCredentials(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Leave blank to keep current password"
                      disabled={credentialsSaving}
                    />
                  </div>
                </div>

                {loginCredentials.newPassword && (
                    <div>
                      <label className="block text-label font-medium text-custom-text mb-2">
                        <Shield className="w-4 h-4 inline mr-2" />
                        Confirm New Password *
                      </label>
                    <div className="relative">
                      <Input
                        type="password"
                        value={loginCredentials.confirmPassword}
                        onChange={(e) => setLoginCredentials(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        placeholder="Confirm your new password"
                        disabled={credentialsSaving}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={handleCredentialsUpdate}
                    disabled={credentialsSaving || !loginCredentials.email || !loginCredentials.currentPassword}
                    className="flex items-center gap-2"
                  >
                    {credentialsSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <SaveIcon className="w-4 h-4" />
                        Update Credentials
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowLoginCredentials(false);
                      setLoginCredentials({ email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
                      setCredentialsError('');
                      setCredentialsSuccess('');
                    }}
                    disabled={credentialsSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

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
            {/* Make Profile Public Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-label font-medium text-custom-text mb-1">
                  Make Profile Public
                </label>
                <p className="text-sm text-gray-600">
                  Display your camp profile on the public discovery page
                </p>
              </div>
              {isEditing ? (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={campData.isPubliclyVisible}
                    onChange={(e) => handleInputChange('isPubliclyVisible', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              ) : (
                <Badge variant={campData.isPubliclyVisible ? "success" : "neutral"}>
                  {campData.isPubliclyVisible ? "Public" : "Private"}
                </Badge>
              )}
            </div>

            {/* Accepting Applications Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-label font-medium text-custom-text mb-1">
                  Accepting Applications
                </label>
                <p className="text-sm text-gray-600">
                  Allow new people to apply to join your camp and display the "Apply Now" button on your public page
                </p>
              </div>
              {isEditing ? (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={campData.acceptingApplications}
                    onChange={(e) => handleInputChange('acceptingApplications', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              ) : (
                <Badge variant={campData.acceptingApplications ? "success" : "neutral"}>
                  {campData.acceptingApplications ? "Open" : "Closed"}
                </Badge>
              )}
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-1">
                Application Instructions
              </label>
              <p className="text-sm text-gray-600 mb-2">
                Optional text shown in the public application modal before people submit.
              </p>
              {isEditing ? (
                <textarea
                  value={campData.applicationInstructions}
                  onChange={(e) => handleInputChange('applicationInstructions', e.target.value)}
                  placeholder="Example: Please share your relevant camp skills, arrival plan, and any prior build/strike experience."
                  rows={4}
                  maxLength={2000}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent resize-none"
                />
              ) : (
                <p className="text-body text-custom-text">
                  {campData.applicationInstructions || 'No custom instructions'}
                </p>
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
                  <div key={selectedPerk.perkId} className="flex items-center gap-2">
                    <div className={`flex items-center justify-center w-8 h-8 rounded ${perk.color}`}>
                      {renderIcon(perk.icon)}
                    </div>
                    <span className="font-medium text-sm text-custom-text">{perk.name}</span>
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
            Camp Photos
          </h2>
          
          {isEditing ? (
            <div className="space-y-4">
              <PhotoUpload
                photos={campData.photos}
                onPhotosChange={(photos: string[]) => handleInputChange('photos', photos)}
                isEditing={isEditing}
                context="camp"
                campId={campId}
                onUploadComplete={syncCampPhotosOnly}
              />
              <p className="text-sm text-gray-600 mt-2">
                Upload a photo to represent your camp. This will be displayed on your camp profile and in camp discovery.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {campData.photos && campData.photos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {campData.photos.map((photo, index) => {
                    // Handle both string (legacy) and object (new) photo formats
                    const photoUrl = typeof photo === 'string' ? photo : photo.url;
                    return (
                      <div
                        key={index}
                        className="aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <img
                          src={photoUrl}
                          alt={`Camp photo ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error('🖼️ [CampProfile] Image failed to load:', photoUrl.substring(0, 100));
                          }}
                          onLoad={() => {
                            console.log('✅ [CampProfile] Image loaded successfully:', index);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Camera className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600">No photos uploaded yet</p>
                  <p className="text-sm text-gray-500 mt-1">Click Edit to add photos</p>
                </div>
              )}
            </div>
          )}
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

      {/* Invite Templates Section - Only show when not editing profile and user is authorized */}
      {!isEditing && campId && (user?.accountType === 'camp' || user?.accountType === 'admin') && (
        <div className="mt-8">
          <InviteTemplateEditor campId={campId} />
        </div>
      )}
    </div>
  );
};

export default CampProfile;
