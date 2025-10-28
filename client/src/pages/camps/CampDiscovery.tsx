import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, Card, Badge } from '../../components/ui';
import Footer from '../../components/layout/Footer';
import { Search as SearchIcon, MapPin, Users, Calendar, Facebook, Instagram, Filter as FilterIcon, Loader2, Globe, Twitter, Home, UserPlus } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

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
  offering?: GlobalPerk;
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
  categories?: Array<CampCategory | string>; // Can be populated objects or just IDs
  selectedPerks?: SelectedPerk[]; // Shared amenities
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
  visibility?: 'public' | 'private';
  memberCount?: number;
  applicationsEnabled?: boolean;
  showApplyNow?: boolean;
}

// Helper function to dynamically render Lucide icons
const renderIcon = (iconName: string) => {
  const IconComponent = (LucideIcons as any)[iconName];
  if (IconComponent) {
    return <IconComponent className="w-4 h-4" />;
  }
  return null;
};

const CampDiscovery: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [camps, setCamps] = useState<Camp[]>([]);
  const [filteredCamps, setFilteredCamps] = useState<Camp[]>([]);
  const [campCategories, setCampCategories] = useState<CampCategory[]>([]);
  const [globalPerks, setGlobalPerks] = useState<GlobalPerk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'members' | 'burningSince'>('name');
  const [showFilters, setShowFilters] = useState(false);

  // Handle Apply Now button click
  const handleApplyNow = (camp: Camp) => {
    if (!user) {
      // Redirect to registration page for unauthenticated users
      window.location.href = 'https://www.g8road.com/register';
    } else {
      // For authenticated users, navigate to camp profile or application page
      navigate(`/camps/${camp.slug}`);
    }
  };

  useEffect(() => {
    fetchCamps();
    loadCategories();
    loadPerks();
  }, []);

  useEffect(() => {
    filterAndSortCamps();
  }, [camps, searchTerm, selectedCategories, selectedAmenities, sortBy]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCampCategories(response.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadPerks = async () => {
    try {
      const response = await api.get('/perks');
      setGlobalPerks(response.perks || []);
    } catch (error) {
      console.error('Failed to load perks:', error);
    }
  };

  const fetchCamps = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('🏕️ [CampDiscovery] Fetching camps...');
      
      const response = await api.get('/camps');
      console.log('🏕️ [CampDiscovery] Response:', response);
      
      if (response && response.camps) {
        console.log('🔍 [CampDiscovery] First camp:', response.camps[0]);
        console.log('🔍 [CampDiscovery] First camp name:', response.camps[0]?.campName);
        console.log('🔍 [CampDiscovery] First camp photos:', response.camps[0]?.photos);
        setCamps(response.camps);
        console.log('✅ [CampDiscovery] Set camps:', response.camps.length);
      } else {
        console.warn('⚠️ [CampDiscovery] No camps in response');
        setCamps([]);
      }
    } catch (err: any) {
      console.error('❌ [CampDiscovery] Error:', err);
      setError('Failed to load camps');
      setCamps([]);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCamps = useCallback(() => {
    if (!camps || camps.length === 0) {
      setFilteredCamps([]);
      return;
    }

    let filtered = camps.filter(camp => {
      if (!camp) return false;
      
      const matchesSearch = !searchTerm || 
        (camp.campName && camp.campName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (camp.description && camp.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (camp.hometown && camp.hometown.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategories = selectedCategories.length === 0 ||
        (camp.categories && selectedCategories.some(selectedCatId => {
          // Handle both category objects and IDs
          return camp.categories!.some(campCat => {
            const catId = typeof campCat === 'object' ? campCat._id : campCat;
            return catId === selectedCatId;
          });
        }));
      
      const matchesAmenities = selectedAmenities.length === 0 ||
        (camp.selectedPerks && selectedAmenities.every(selectedPerkId => {
          // Check if camp has this amenity enabled
          return camp.selectedPerks!.some(sp => 
            sp.perkId === selectedPerkId && sp.isOn
          );
        }));
      
      return matchesSearch && matchesCategories && matchesAmenities;
    });

    // Sort camps
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.campName || '').localeCompare(b.campName || '');
        case 'members':
          return (b.memberCount || 0) - (a.memberCount || 0);
        case 'burningSince':
          return (b.burningSince || 0) - (a.burningSince || 0);
        default:
          return 0;
      }
    });

    setFilteredCamps(filtered);
  }, [camps, searchTerm, selectedCategories, selectedAmenities, sortBy]);

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const handleAmenityToggle = (amenityId: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenityId)
        ? prev.filter(a => a !== amenityId)
        : [...prev, amenityId]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategories([]);
    setSelectedAmenities([]);
    setSortBy('name');
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
          Discover Camps
        </h1>
        <p className="text-body text-custom-text-secondary">
          Explore and connect with Burning Man camps from around the world
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search camps by name, description, or location..."
                className="pl-10"
              />
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <FilterIcon className="w-4 h-4" />
            Filters
          </Button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card className="p-6 mb-4">
            <div className="space-y-6">
              {/* Sort Options */}
              <div>
                <label className="block text-sm font-semibold text-custom-text mb-3">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent bg-white"
                >
                  <option value="name">Name (A-Z)</option>
                  <option value="members">Most Members</option>
                  <option value="burningSince">Most Experienced</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-semibold text-custom-text mb-3">
                  Filter by Categories
                  {selectedCategories.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-custom-primary">
                      ({selectedCategories.length} selected)
                    </span>
                  )}
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {campCategories.map((category) => (
                      <label key={category._id} className="flex items-center space-x-2 cursor-pointer hover:bg-white p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category._id)}
                          onChange={() => handleCategoryToggle(category._id)}
                          className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                        />
                        <span className="text-sm text-custom-text">{category.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Amenity Filter */}
              <div>
                <label className="block text-sm font-semibold text-custom-text mb-3">
                  Filter by Shared Amenities
                  {selectedAmenities.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-custom-primary">
                      ({selectedAmenities.length} selected)
                    </span>
                  )}
                </label>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {globalPerks.map((perk) => (
                      <label key={perk._id} className="flex items-center space-x-2 cursor-pointer hover:bg-white p-2 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedAmenities.includes(perk._id)}
                          onChange={() => handleAmenityToggle(perk._id)}
                          className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                        />
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center justify-center w-5 h-5 rounded ${perk.color}`}>
                            {renderIcon(perk.icon)}
                          </div>
                          <span className="text-sm text-custom-text">{perk.name}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-custom-text-secondary mt-2">
                  Showing camps that have all selected amenities
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={clearFilters}
                size="sm"
              >
                Clear All Filters
              </Button>
              <span className="text-sm font-medium text-custom-text">
                {filteredCamps.length} camp{filteredCamps.length !== 1 ? 's' : ''} found
              </span>
            </div>
          </Card>
        )}
      </div>

      {/* Results - Horizontal Full-Width Cards */}
      <div className="space-y-4">
        {filteredCamps.map((camp) => {
          // Simple fallback slug generation
          const campSlug = camp.slug || camp._id;
          
          return (
            <Card
              key={camp._id}
              className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
              onClick={() => navigate(`/camps/${campSlug}`)}
            >
              <div className="flex flex-col md:flex-row">
                {/* Camp Photo - Left Side */}
                {camp.photos && camp.photos.length > 0 && (
                  <div className="md:w-1/3 lg:w-1/4">
                    <img
                      src={camp.photos[Math.min(camp.primaryPhotoIndex || 0, camp.photos.length - 1)]}
                      alt={camp.campName || 'Camp Photo'}
                      className="w-full h-64 md:h-full object-cover md:rounded-l-lg"
                      onError={(e) => {
                        console.error('🖼️ [CampDiscovery] Image failed to load:', e.currentTarget.src);
                      }}
                      onLoad={() => {
                        console.log('✅ [CampDiscovery] Image loaded successfully');
                      }}
                    />
                  </div>
                )}

                {/* Camp Info - Right Side */}
                <div className={`flex-1 p-6 ${camp.photos && camp.photos.length > 0 ? '' : 'w-full'}`}>
                  <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="mb-4">
                      <h3 className="text-h2 font-lato-bold text-custom-text mb-2">
                        {camp.campName}
                      </h3>
                      
                      {camp.description && (
                        <p className="text-body text-custom-text-secondary line-clamp-2">
                          {camp.description}
                        </p>
                      )}
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                      {/* Location */}
                      {camp.hometown && (
                        <div className="flex items-center gap-2 text-sm text-custom-text-secondary">
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{camp.hometown}</span>
                        </div>
                      )}

                      {/* Playa Location */}
                      {camp.location && (camp.location.street || camp.location.time) && (
                        <div className="flex items-center gap-2 text-sm text-custom-text-secondary">
                          <Home className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">
                            {camp.location.time && `${camp.location.time}`}
                            {camp.location.time && camp.location.street && ' & '}
                            {camp.location.street && camp.location.street}
                          </span>
                        </div>
                      )}

                      {/* Burning Since */}
                      {camp.burningSince && (
                        <div className="flex items-center gap-2 text-sm text-custom-text-secondary">
                          <Calendar className="w-4 h-4 flex-shrink-0" />
                          <span>Burning since {camp.burningSince}</span>
                        </div>
                      )}

                      {/* Members */}
                      {camp.memberCount && (
                        <div className="flex items-center gap-2 text-sm text-custom-text-secondary">
                          <Users className="w-4 h-4 flex-shrink-0" />
                          <span>{camp.memberCount} member{camp.memberCount !== 1 ? 's' : ''}</span>
                        </div>
                      )}

                      {/* Social Links */}
                      {(camp.website || camp.socialMedia?.facebook || camp.socialMedia?.instagram || camp.socialMedia?.twitter) && (
                        <div className="flex items-center gap-3 text-sm">
                          {camp.website && (
                            <a
                              href={camp.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-custom-primary hover:text-custom-primary-dark"
                              title="Visit Website"
                            >
                              <Globe className="w-4 h-4" />
                            </a>
                          )}
                          {camp.socialMedia?.facebook && (
                            <a
                              href={camp.socialMedia.facebook}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:text-blue-800"
                              title="Facebook"
                            >
                              <Facebook className="w-4 h-4" />
                            </a>
                          )}
                          {camp.socialMedia?.instagram && (
                            <a
                              href={camp.socialMedia.instagram}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-pink-600 hover:text-pink-800"
                              title="Instagram"
                            >
                              <Instagram className="w-4 h-4" />
                            </a>
                          )}
                          {camp.socialMedia?.twitter && (
                            <a
                              href={camp.socialMedia.twitter}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-400 hover:text-blue-600"
                              title="Twitter"
                            >
                              <Twitter className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Categories and Amenities Row */}
                    <div className="mt-auto pt-4 border-t border-gray-200">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        {/* Categories */}
                        {camp.categories && camp.categories.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {camp.categories.slice(0, 4).map((category) => {
                              const categoryName = typeof category === 'object' ? category.name : category;
                              const categoryId = typeof category === 'object' ? category._id : category;
                              return (
                                <Badge key={categoryId} variant="neutral" size="sm">
                                  {categoryName}
                                </Badge>
                              );
                            })}
                            {camp.categories.length > 4 && (
                              <Badge variant="neutral" size="sm">
                                +{camp.categories.length - 4}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Shared Amenities */}
                        {camp.selectedPerks && camp.selectedPerks.filter(sp => sp.isOn && sp.offering).length > 0 && (
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-custom-text-secondary">Amenities:</span>
                            <div className="flex items-center gap-3 flex-wrap">
                              {camp.selectedPerks
                                .filter(sp => sp.isOn && sp.offering)
                                .slice(0, 6)
                                .map((selectedPerk) => (
                                  <div
                                    key={selectedPerk.perkId}
                                    className="flex items-center gap-1.5"
                                  >
                                    <div className={`flex items-center justify-center w-5 h-5 rounded ${selectedPerk.offering!.color}`}>
                                      {renderIcon(selectedPerk.offering!.icon)}
                                    </div>
                                    <span className="text-xs text-custom-text">
                                      {selectedPerk.offering!.name}
                                    </span>
                                  </div>
                                ))}
                              {camp.selectedPerks.filter(sp => sp.isOn && sp.offering).length > 6 && (
                                <span className="text-xs text-custom-text-secondary font-medium">
                                  +{camp.selectedPerks.filter(sp => sp.isOn && sp.offering).length - 6} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Apply Now Button */}
                        {(camp.applicationsEnabled || camp.showApplyNow) && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApplyNow(camp);
                              }}
                              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <UserPlus className="w-4 h-4" />
                              Apply Now
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {filteredCamps.length === 0 && !loading && (
        <div className="text-center py-16">
          <h3 className="text-h3 font-lato-bold text-custom-text-secondary mb-2">
            No camps found
          </h3>
          <p className="text-body text-custom-text-secondary">
            Try adjusting your search criteria or filters
          </p>
        </div>
      )}
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default CampDiscovery;