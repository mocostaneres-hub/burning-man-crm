import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, Card, Badge } from '../../components/ui';
import { Search as SearchIcon, MapPin, Users, Calendar, Facebook, Instagram, Filter as FilterIcon, Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  const [camps, setCamps] = useState<Camp[]>([]);
  const [filteredCamps, setFilteredCamps] = useState<Camp[]>([]);
  const [campCategories, setCampCategories] = useState<CampCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'members' | 'burningSince'>('name');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchCamps();
    loadCategories();
  }, []);

  useEffect(() => {
    filterAndSortCamps();
  }, [camps, searchTerm, selectedCategories, sortBy]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCampCategories(response.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
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
      
      return matchesSearch && matchesCategories;
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
  }, [camps, searchTerm, selectedCategories, sortBy]);

  const handleCategoryToggle = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategories([]);
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sort Options */}
              <div>
                <label className="block text-label font-medium text-custom-text mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                >
                  <option value="name">Name (A-Z)</option>
                  <option value="members">Member Count</option>
                  <option value="burningSince">Years Burning</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-label font-medium text-custom-text mb-2">
                  Categories
                </label>
                <div className="max-h-32 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-1">
                    {campCategories.map((category) => (
                      <label key={category._id} className="flex items-center space-x-2 cursor-pointer">
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
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={clearFilters}
                size="sm"
              >
                Clear Filters
              </Button>
              <span className="text-sm text-custom-text-secondary">
                {filteredCamps.length} camp{filteredCamps.length !== 1 ? 's' : ''} found
              </span>
            </div>
          </Card>
        )}
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCamps.map((camp) => {
          // Simple fallback slug generation
          const campSlug = camp.slug || camp._id;
          
          return (
            <Card
              key={camp._id}
              className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
              onClick={() => navigate(`/camps/${campSlug}`)}
            >
              <div className="p-6">
              {/* Camp Photo */}
              {camp.photos && camp.photos.length > 0 && (
                <div className="mb-4">
                  <img
                    src={camp.photos[Math.min(camp.primaryPhotoIndex || 0, camp.photos.length - 1)]}
                    alt={camp.campName || 'Camp Photo'}
                    className="w-full h-48 object-cover rounded-lg"
                    onError={(e) => {
                      console.error('🖼️ [CampDiscovery] Image failed to load:', e.currentTarget.src);
                    }}
                    onLoad={() => {
                      console.log('✅ [CampDiscovery] Image loaded successfully');
                    }}
                  />
                </div>
              )}

              {/* Camp Info */}
              <div className="space-y-3">
                <h3 className="text-h3 font-lato-bold text-custom-text">
                  {camp.campName}
                </h3>

                {camp.description && (
                  <p className="text-body text-custom-text-secondary line-clamp-3">
                    {camp.description}
                  </p>
                )}

                {/* Camp Details */}
                <div className="space-y-2">
                  {camp.hometown && (
                    <div className="flex items-center gap-2 text-sm text-custom-text-secondary">
                      <MapPin className="w-4 h-4" />
                      {camp.hometown}
                    </div>
                  )}

                  {camp.burningSince && (
                    <div className="flex items-center gap-2 text-sm text-custom-text-secondary">
                      <Calendar className="w-4 h-4" />
                      Burning since {camp.burningSince}
                    </div>
                  )}

                  {camp.memberCount && (
                    <div className="flex items-center gap-2 text-sm text-custom-text-secondary">
                      <Users className="w-4 h-4" />
                      {camp.memberCount} member{camp.memberCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {/* Categories */}
                {camp.categories && camp.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {camp.categories.slice(0, 3).map((category) => {
                      const categoryName = typeof category === 'object' ? category.name : category;
                      const categoryId = typeof category === 'object' ? category._id : category;
                      return (
                        <Badge key={categoryId} variant="neutral" size="sm">
                          {categoryName}
                        </Badge>
                      );
                    })}
                    {camp.categories.length > 3 && (
                      <Badge variant="neutral" size="sm">
                        +{camp.categories.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Shared Amenities */}
                {camp.selectedPerks && camp.selectedPerks.filter(sp => sp.isOn && sp.offering).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-custom-text mb-2">Shared Amenities</h4>
                    <div className="space-y-1.5">
                      {camp.selectedPerks
                        .filter(sp => sp.isOn && sp.offering)
                        .map((selectedPerk) => (
                          <div
                            key={selectedPerk.perkId}
                            className="flex items-center gap-2"
                          >
                            <div className={`flex items-center justify-center w-6 h-6 rounded ${selectedPerk.offering!.color}`}>
                              {renderIcon(selectedPerk.offering!.icon)}
                            </div>
                            <span className="text-sm text-custom-text-secondary">
                              {selectedPerk.offering!.name}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Social Links */}
                {(camp.socialMedia?.facebook || camp.socialMedia?.instagram) && (
                  <div className="flex gap-2 pt-2">
                    {camp.socialMedia.facebook && (
                      <a
                        href={camp.socialMedia.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Facebook className="w-4 h-4" />
                      </a>
                    )}
                    {camp.socialMedia.instagram && (
                      <a
                        href={camp.socialMedia.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-pink-600 hover:text-pink-800"
                      >
                        <Instagram className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}
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
    </div>
  );
};

export default CampDiscovery;