import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, Badge, Modal } from '../../components/ui';
import { 
  MapPin, Globe, Facebook, Instagram, Twitter, Calendar, 
  Users, ArrowLeft, Send, Loader2, CheckCircle, AlertTriangle,
  Home, Edit
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import Footer from '../../components/layout/Footer';
import ProfileCompletionModal from '../../components/user/ProfileCompletionModal';

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
  offering?: GlobalPerk; // Populated perk data
}

interface Camp {
  _id: string;
  campName: string;
  slug: string;
  description?: string;
  bio?: string;
  theme?: string;
  hometown?: string;
  burningSince?: number;
  contactEmail?: string;
  website?: string;
  acceptingApplications?: boolean;
  categories?: CampCategory[]; // Updated to include full category objects
  selectedPerks?: SelectedPerk[]; // Array of selected perks with populated data
  // Legacy offerings object for backward compatibility
  offerings?: {
    water?: boolean;
    fullPower?: boolean;
    partialPower?: boolean;
    rvPower?: boolean;
    acceptsRVs?: boolean;
    shadeForTents?: boolean;
    showers?: boolean;
    communalKitchen?: boolean;
    storage?: boolean;
    wifi?: boolean;
    ice?: boolean;
    food?: boolean;
    coffee?: boolean;
    bar?: boolean;
    snacks?: boolean;
    music?: boolean;
    art?: boolean;
    workshops?: boolean;
    performances?: boolean;
    games?: boolean;
    yoga?: boolean;
    meditation?: boolean;
    bikeRepair?: boolean;
    massage?: boolean;
    hairStyling?: boolean;
    facePainting?: boolean;
    costumeRental?: boolean;
    sharedSpace?: boolean;
    campfire?: boolean;
    socialEvents?: boolean;
    welcomeNewbies?: boolean;
  };
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    tiktok?: string;
  };
  location?: {
    street?: string;
    crossStreet?: string;
    time?: string;
    description?: string;
  };
  photos?: string[];
  primaryPhotoIndex?: number;
  stats?: {
    totalMembers?: number;
  };
}

// Helper function to dynamically render Lucide icons
const renderIcon = (iconName: string) => {
  const IconComponent = (LucideIcons as any)[iconName];
  if (IconComponent) {
    return <IconComponent className="w-4 h-4" />;
  }
  return null;
};

const PublicCampProfile: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [camp, setCamp] = useState<Camp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [applicationSuccess, setApplicationSuccess] = useState(false);
  const [availableCallSlots, setAvailableCallSlots] = useState<any[]>([]);
  const [showProfileCompletionModal, setShowProfileCompletionModal] = useState(false);
  
  // Capture invite token from URL if present
  const inviteToken = searchParams.get('invite');
  
  // Application form state
  const [applicationData, setApplicationData] = useState({
    motivation: '',
    experience: '',
    skills: [] as string[],
    selectedCallSlotId: ''
  });

  useEffect(() => {
    if (slug) {
      fetchCamp();
    }
  }, [slug]);
  
  // Log invite token detection for debugging
  useEffect(() => {
    if (inviteToken) {
      console.log('🎟️ [PublicCampProfile] Invite token detected:', inviteToken);
    }
  }, [inviteToken]);
  
  // Check if profile completion modal should be shown
  useEffect(() => {
    if (!user || !inviteToken) return;
    
    // Check if user has a pending invite in localStorage
    const pendingInvite = localStorage.getItem('pendingInvite');
    if (!pendingInvite) return;
    
    // Check if profile is incomplete (required fields: playaName, city, phoneNumber, skills, yearsBurned)
    const isProfileIncomplete = !user.playaName || !user.city || !user.phoneNumber || 
                                !user.skills || user.skills.length === 0 || user.yearsBurned === undefined;
    
    if (isProfileIncomplete) {
      console.log('🎟️ [PublicCampProfile] Showing profile completion modal');
      setShowProfileCompletionModal(true);
    }
  }, [user, inviteToken]);

  const fetchCamp = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🔍 [PublicCampProfile] Fetching camp with slug:', slug);
      const response = await api.get(`/camps/public/${slug}`);
      console.log('✅ [PublicCampProfile] Camp API response:', JSON.stringify(response, null, 2));
      console.log('🔍 [PublicCampProfile] Camp name:', response.campName);
      console.log('🔍 [PublicCampProfile] Camp photos:', response.photos);
      console.log('🔍 [PublicCampProfile] Primary photo index:', response.primaryPhotoIndex);
      console.log('🔍 [PublicCampProfile] Photo at index:', response.photos?.[response.primaryPhotoIndex || 0]);
      console.log('🔍 [PublicCampProfile] Accepting applications:', response.acceptingApplications);
      setCamp(response);
    } catch (err: any) {
      console.error('❌ [PublicCampProfile] Error fetching camp:', err);
      setError(err.response?.data?.message || 'Failed to load camp profile');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileComplete = () => {
    console.log('✅ [PublicCampProfile] Profile completed');
    setShowProfileCompletionModal(false);
    // Clear the pending invite from localStorage
    localStorage.removeItem('pendingInvite');
    // Optionally show a success message
    alert('Profile completed! You can now apply to this camp.');
  };
  
  const handleApplyNow = async () => {
    if (!user) {
      // Redirect non-authenticated users to registration page with camp context
      const currentUrl = new URL(window.location.href);
      const campSlug = currentUrl.pathname.split('/').pop();
      const inviteParam = inviteToken ? `&invite=${inviteToken}` : '';
      window.location.href = `https://www.g8road.com/register?camp=${campSlug}${inviteParam}`;
      return;
    }
    
    if (user.accountType !== 'personal') {
      alert('Only personal accounts can apply to camps');
      return;
    }
    
    // Check if profile is incomplete (required fields: playaName, city, phoneNumber, skills, yearsBurned)
    const isProfileIncomplete = !user.playaName || !user.city || !user.phoneNumber || 
                                !user.skills || user.skills.length === 0 || user.yearsBurned === undefined;
    if (isProfileIncomplete) {
      setShowProfileCompletionModal(true);
      return;
    }
    
    // Fetch available call slots
    try {
      const slots = await api.get(`/call-slots/available/${camp?._id}`);
      setAvailableCallSlots(slots || []);
    } catch (error) {
      console.error('Error fetching call slots:', error);
      setAvailableCallSlots([]);
    }
    
    setShowApplicationModal(true);
  };

  const handleSubmitApplication = async () => {
    if (!applicationData.motivation.trim()) {
      alert('Please provide your motivation for joining this camp');
      return;
    }

    try {
      setApplicationLoading(true);
      console.log('🔄 [PublicCampProfile] Submitting application to camp:', camp?._id);
      if (inviteToken) {
        console.log('🎟️ [PublicCampProfile] Application includes invite token:', inviteToken);
      }
      
      const response = await api.post('/applications/apply', {
        campId: camp?._id,
        applicationData: {
          motivation: applicationData.motivation,
          experience: applicationData.experience,
          skills: applicationData.skills,
          selectedCallSlotId: applicationData.selectedCallSlotId || undefined
        },
        inviteToken: inviteToken || undefined // Pass invite token if present
      });
      
      console.log('✅ [PublicCampProfile] Application submitted successfully:', response);
      
      setApplicationSuccess(true);
      
      // Auto-close modal after showing success message
      setTimeout(() => {
        setShowApplicationModal(false);
        setApplicationSuccess(false);
        setApplicationData({ motivation: '', experience: '', skills: [], selectedCallSlotId: '' });
      }, 3500);
      
    } catch (err: any) {
      console.error('❌ [PublicCampProfile] Application error:', err);
      console.error('❌ [PublicCampProfile] Error response:', err.response?.data);
      
      const errorMessage = err.response?.data?.message || 'Failed to submit application';
      alert(errorMessage);
    } finally {
      setApplicationLoading(false);
    }
  };

  const getOfferingIcon = (iconName: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      CheckCircle: <CheckCircle className="w-4 h-4" />,
      Home: <Home className="w-4 h-4" />,
      Coffee: <CheckCircle className="w-4 h-4" />,
      Wifi: <CheckCircle className="w-4 h-4" />,
      Music: <CheckCircle className="w-4 h-4" />,
      Dumbbell: <CheckCircle className="w-4 h-4" />,
      Waves: <CheckCircle className="w-4 h-4" />,
      Zap: <CheckCircle className="w-4 h-4" />
    };
    return iconMap[iconName] || <CheckCircle className="w-4 h-4" />;
  };

  const formatOfferingName = (key: string) => {
    return key.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .trim();
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

  if (error || !camp) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-16">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-h3 font-lato-bold text-custom-text-secondary mb-2">
            {error || 'Camp not found'}
          </h2>
          <Button onClick={() => navigate('/camps')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Camps
          </Button>
        </div>
      </div>
    );
  }


  // Check if current user is the camp owner
  // For admin accounts, compare campId with camp._id
  // For camp accounts, generate slug from campName if urlSlug not available
  const isCampOwner = (() => {
    if (user?.accountType === 'admin' && user?.campId) {
      // Admin accounts: compare campId with camp's _id
      return camp?._id === user.campId;
    } else if (user?.accountType === 'camp') {
      // Camp accounts: compare slug
      const currentUserSlug = user.urlSlug || (user.campName ? user.campName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : null);
      return currentUserSlug === slug;
    }
    return false;
  })();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button and Edit Button */}
      <div className="mb-6 flex justify-between items-center">
        <Button 
          onClick={() => navigate('/camps')} 
          variant="outline"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Camps
        </Button>
        
        {isCampOwner && (
          <Button 
            onClick={() => navigate('/camp/profile', { state: { editMode: true } })} 
            className="flex items-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit Camp
          </Button>
        )}
      </div>

      {/* Hero Section */}
      <Card className="mb-8">
        <div className="p-8">
          {/* Camp Photo */}
          {camp.photos && camp.photos.length > 0 && (
            <div className="mb-6">
              <img
                src={camp.photos[Math.min(camp.primaryPhotoIndex || 0, camp.photos.length - 1)]}
                alt={camp.campName || 'Camp Photo'}
                className="w-full h-64 object-cover rounded-lg"
                onError={(e) => {
                  console.error('🖼️ [PublicCampProfile] Image failed to load:', e.currentTarget.src);
                }}
                onLoad={() => {
                  console.log('✅ [PublicCampProfile] Image loaded successfully:', camp.photos[Math.min(camp.primaryPhotoIndex || 0, camp.photos.length - 1)]);
                }}
              />
            </div>
          )}

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              {/* 1. Title */}
              <h1 className="text-h1 font-lato-bold text-custom-text mb-4">
                {camp.campName}
              </h1>
              
              {/* 2. Camp Hometown, Burning Since, Number of Members */}
              <div className="flex flex-wrap gap-3 mb-6">
                {camp.hometown && (
                  <Badge variant="neutral" className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {camp.hometown}
                  </Badge>
                )}
                {camp.burningSince && (
                  <Badge variant="neutral" className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Burning since {camp.burningSince}
                  </Badge>
                )}
                {camp.stats?.totalMembers && (
                  <Badge variant="neutral" className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {camp.stats.totalMembers} members
                  </Badge>
                )}
              </div>

              {/* 3. Socials & Website */}
              {(camp.website || camp.socialMedia?.facebook || camp.socialMedia?.instagram || camp.socialMedia?.twitter || camp.socialMedia?.tiktok) && (
                <div className="mb-6">
                  <div className="flex flex-wrap items-center gap-3">
                    {camp.website && (
                      <a
                        href={camp.website.startsWith('http://') || camp.website.startsWith('https://') ? camp.website : `https://${camp.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-custom-primary/10 hover:bg-custom-primary/20 text-custom-primary transition-colors"
                        title="Website"
                      >
                        <Globe className="w-5 h-5" />
                      </a>
                    )}
                    {camp.socialMedia?.facebook && (
                      <a
                        href={camp.socialMedia.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                        title="Facebook"
                      >
                        <Facebook className="w-5 h-5" />
                      </a>
                    )}
                    {camp.socialMedia?.instagram && (
                      <a
                        href={camp.socialMedia.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-pink-100 text-pink-600 hover:bg-pink-200 transition-colors"
                        title="Instagram"
                      >
                        <Instagram className="w-5 h-5" />
                      </a>
                    )}
                    {camp.socialMedia?.twitter && (
                      <a
                        href={camp.socialMedia.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-blue-400 hover:bg-blue-100 transition-colors"
                        title="Twitter"
                      >
                        <Twitter className="w-5 h-5" />
                      </a>
                    )}
                    {camp.socialMedia?.tiktok && (
                      <a
                        href={camp.socialMedia.tiktok}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        title="TikTok"
                      >
                        <Globe className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Playa Location */}
              {camp.location && (camp.location.street || camp.location.time || camp.location.description) && (
                <div className="mb-6">
                  <h3 className="text-h3 font-lato-bold text-custom-text mb-3">Playa Location</h3>
                  <div className="space-y-2">
                    {(camp.location.time || camp.location.street) && (
                      <div className="flex items-start gap-2">
                        <Home className="w-5 h-5 text-custom-text-secondary mt-0.5" />
                        <div>
                          {camp.location.time && <p className="text-body text-custom-text">{camp.location.time}</p>}
                          {camp.location.street && <p className="text-body text-custom-text">{camp.location.street}</p>}
                          {camp.location.crossStreet && (
                            <p className="text-sm text-custom-text-secondary">Near: {camp.location.crossStreet}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {camp.location.description && (
                      <p className="text-sm text-custom-text-secondary ml-7">{camp.location.description}</p>
                    )}
                  </div>
                </div>
              )}

              {/* 5. Categories */}
              {camp.categories && camp.categories.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-h3 font-lato-bold text-custom-text mb-3">Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {camp.categories.map((category) => (
                      <Badge key={category._id} variant="neutral" className="px-3 py-1">
                        {category.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. About */}
              {camp.description && (
                <div className="mb-6">
                  <h3 className="text-h3 font-lato-bold text-custom-text mb-2">About</h3>
                  <p className="text-body text-custom-text-secondary">{camp.description}</p>
                </div>
              )}

              {/* 7. Shared Amenities */}
              {camp.selectedPerks && camp.selectedPerks.filter(sp => sp.isOn && sp.offering).length > 0 && (
                <div className="mb-6">
                  <h3 className="text-h3 font-lato-bold text-custom-text mb-3">Shared Amenities</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {camp.selectedPerks
                      .filter(sp => sp.isOn && sp.offering)
                      .map((selectedPerk) => (
                        <div
                          key={selectedPerk.perkId}
                          className="flex items-center gap-2"
                        >
                          <div className={`flex items-center justify-center w-8 h-8 rounded ${selectedPerk.offering!.color}`}>
                            {renderIcon(selectedPerk.offering!.icon)}
                          </div>
                          <span className="font-medium text-sm text-custom-text">{selectedPerk.offering!.name}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Apply Button - Only show for personal accounts or non-logged in users */}
            <div className="lg:ml-8">
              {isCampOwner ? (
                // Camp owner viewing their own profile
                <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-custom-text font-medium mb-3">
                    This is your camp's public facing profile
                  </p>
                  <Button 
                    onClick={() => navigate('/camp/profile', { state: { editMode: true } })} 
                    size="lg"
                    className="w-full lg:w-auto"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Camp
                  </Button>
                </div>
              ) : camp.acceptingApplications ? (
                // Show Apply Now button only for personal accounts or non-logged in users
                (user?.accountType === 'personal' || !user) ? (
                  <Button 
                    onClick={handleApplyNow}
                    size="lg"
                    className="w-full lg:w-auto"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Apply Now
                  </Button>
                ) : null
              ) : (
                // Camp is not accepting applications
                user?.accountType === 'personal' || !user ? (
                  <div className="text-center p-4 bg-gray-100 rounded-lg">
                    <p className="text-custom-text-secondary">
                      Not currently accepting applications
                    </p>
                  </div>
                ) : null
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Application Modal */}
      <Modal
        isOpen={showApplicationModal}
        onClose={() => setShowApplicationModal(false)}
        title={`Apply to ${camp.campName}`}
        size="lg"
      >
        {applicationSuccess ? (
          <div className="text-center py-8">
            <div className="mb-4 animate-bounce">
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto" />
            </div>
            <h3 className="text-2xl font-lato-bold text-custom-text mb-3">
              🎉 Application Submitted Successfully!
            </h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 max-w-md mx-auto">
              <p className="text-custom-text mb-2">
                <strong>Great news!</strong> Your application to join <strong>{camp.campName}</strong> has been received.
              </p>
              <p className="text-sm text-custom-text-secondary">
                The camp leads will review your application and get back to you soon. You'll receive an email notification when there's an update.
              </p>
            </div>
            <p className="text-xs text-custom-text-secondary mt-4">
              This modal will close automatically in a few seconds...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pre-populated user info */}
            {user && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-custom-text mb-2">Your Information</h4>
                <p className="text-sm text-custom-text-secondary">
                  {user.firstName} {user.lastName} • {user.email}
                </p>
              </div>
            )}

            {/* Motivation */}
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Why do you want to join {camp.campName}? *
              </label>
              <textarea
                value={applicationData.motivation}
                onChange={(e) => setApplicationData(prev => ({ ...prev, motivation: e.target.value }))}
                placeholder="Tell us about your motivation, what you can contribute, and why you'd be a good fit..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent resize-none"
                rows={5}
                required
              />
            </div>

            {/* Experience */}
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Burning Man Experience (Optional)
              </label>
              <textarea
                value={applicationData.experience}
                onChange={(e) => setApplicationData(prev => ({ ...prev, experience: e.target.value }))}
                placeholder="Tell us about your Burning Man experience, previous camps, or relevant skills..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent resize-none"
                rows={3}
              />
            </div>

            {/* Call Time Selection */}
            {availableCallSlots.length > 0 && (
              <div>
                <label className="block text-label font-medium text-custom-text mb-2">
                  Preferred Orientation Call Time (Optional)
                </label>
                <select
                  value={applicationData.selectedCallSlotId}
                  onChange={(e) => setApplicationData(prev => ({ ...prev, selectedCallSlotId: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent text-gray-900"
                >
                  <option value="">Select a call time...</option>
                  {availableCallSlots.map((slot) => (
                    <option key={slot._id} value={slot._id}>
                      {new Date(slot.date).toLocaleDateString('en-US', { 
                        weekday: 'short', 
                        month: 'short', 
                        day: 'numeric' 
                      })} • {slot.startTime} - {slot.endTime}
                      {slot.currentParticipants >= slot.maxParticipants ? ' (Full)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-2">
                  Select a time for your orientation call with the camp leadership
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowApplicationModal(false)}
                className="flex-1"
                disabled={applicationLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitApplication}
                className="flex-1"
                disabled={applicationLoading || !applicationData.motivation.trim()}
              >
                {applicationLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Application
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      
      {/* Profile Completion Modal */}
      <ProfileCompletionModal
        isOpen={showProfileCompletionModal}
        onClose={() => setShowProfileCompletionModal(false)}
        onComplete={handleProfileComplete}
      />
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default PublicCampProfile;