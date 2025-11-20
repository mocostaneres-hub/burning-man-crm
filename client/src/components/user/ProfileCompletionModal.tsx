import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../ui';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({ 
  isOpen, 
  onClose,
  onComplete 
}) => {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    playaName: user?.playaName || '',
    city: user?.city || '',
    yearsBurned: user?.yearsBurned || 0,
    bio: user?.bio || '',
    phoneNumber: user?.phoneNumber || '',
    skills: user?.skills || [] as string[],
    burningPlans: 'confirmed' as 'confirmed' | 'undecided', // New field
    hasTicket: user?.hasTicket || false,
    hasVehiclePass: user?.hasVehiclePass || false,
    arrivalDate: user?.arrivalDate ? new Date(user.arrivalDate).toISOString().split('T')[0] : '',
    departureDate: user?.departureDate ? new Date(user.departureDate).toISOString().split('T')[0] : '',
    interestedInEAP: user?.interestedInEAP || false,
    interestedInStrike: user?.interestedInStrike || false
  });

  // Load available skills
  useEffect(() => {
    const loadSkills = async () => {
      try {
        setSkillsLoading(true);
        const response = await api.get('/skills');
        setAvailableSkills(Array.isArray(response) ? response : []);
      } catch (err) {
        console.error('Error loading skills:', err);
        setAvailableSkills([]);
      } finally {
        setSkillsLoading(false);
      }
    };

    if (isOpen) {
      loadSkills();
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'yearsBurned') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSkillToggle = (skillName: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skillName)
        ? prev.skills.filter(s => s !== skillName)
        : [...prev.skills, skillName]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate required fields
    if (!formData.playaName.trim()) {
      setError('Playa name is required');
      setLoading(false);
      return;
    }
    if (!formData.city.trim()) {
      setError('City is required');
      setLoading(false);
      return;
    }
    if (!formData.phoneNumber.trim()) {
      setError('Phone number is required');
      setLoading(false);
      return;
    }
    if (formData.skills.length === 0) {
      setError('Please select at least one skill');
      setLoading(false);
      return;
    }
    // Years burned validation (0 is valid for first-timers)

    try {
      // Prepare data for submission
      const submitData = {
        ...formData,
        // Convert date strings to Date objects if provided
        arrivalDate: formData.arrivalDate ? new Date(formData.arrivalDate) : undefined,
        departureDate: formData.departureDate ? new Date(formData.departureDate) : undefined
      };

      // Update user profile
      await api.put('/users/profile', submitData);
      
      // Refresh user data
      await refreshUser();
      
      console.log('✅ [ProfileCompletionModal] Profile updated successfully');
      
      // Call the onComplete callback
      onComplete();
    } catch (err: any) {
      console.error('❌ [ProfileCompletionModal] Error updating profile:', err);
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      title="Complete Your Profile"
      size="lg"
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            <strong>Welcome!</strong> Please complete your profile to apply to this camp.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* REQUIRED INFORMATION SECTION */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-red-500">*</span> Required Information
            </h3>
            
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Playa Name *"
                name="playaName"
                value={formData.playaName}
                onChange={handleChange}
                placeholder="Your playa name"
                required
              />
              
              <Input
                label="City *"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="Your city"
                required
              />
            </div>

            <Input
              label="Phone Number *"
              name="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="+1 (555) 123-4567"
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Years Burned (How many Burning Mans have you attended?) *
              </label>
              <select
                name="yearsBurned"
                value={formData.yearsBurned}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="0">0 (Virgin / First-timer)</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6+</option>
              </select>
            </div>

            {/* Burning Plans */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                What are your Burning Man plans? *
              </label>
              <div className="space-y-3">
                <label className="flex items-start space-x-3 cursor-pointer p-3 border-2 border-gray-300 rounded-lg hover:border-blue-500 transition-colors">
                  <input
                    type="radio"
                    name="burningPlans"
                    value="confirmed"
                    checked={formData.burningPlans === 'confirmed'}
                    onChange={(e) => setFormData(prev => ({ ...prev, burningPlans: 'confirmed' }))}
                    className="mt-1 w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="block text-sm font-medium text-gray-900">
                      I am going to Burning Man and would like to join the camp
                    </span>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer p-3 border-2 border-gray-300 rounded-lg hover:border-blue-500 transition-colors">
                  <input
                    type="radio"
                    name="burningPlans"
                    value="undecided"
                    checked={formData.burningPlans === 'undecided'}
                    onChange={(e) => setFormData(prev => ({ ...prev, burningPlans: 'undecided' }))}
                    className="mt-1 w-5 h-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="block text-sm font-medium text-gray-900">
                      I'm not sure if I'll make it to BM but I'd like to be on the list
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Skills Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Skills *
              </label>
              <p className="text-xs text-gray-500 mb-3">Select the skills you have (select at least one)</p>
              
              {skillsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  <span className="ml-2 text-sm text-gray-500">Loading skills...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {availableSkills.map((skill) => (
                    <label
                      key={skill._id}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={formData.skills.includes(skill.name)}
                        onChange={() => handleSkillToggle(skill.name)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{skill.name}</span>
                    </label>
                  ))}
                </div>
              )}
              {formData.skills.length > 0 && (
                <p className="text-xs text-green-600 mt-2">
                  ✓ {formData.skills.length} skill{formData.skills.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          </div>

          {/* OPTIONAL INFORMATION SECTION */}
          <div className="bg-blue-50 rounded-lg p-4 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">💡 Optional Information</h3>
              <p className="text-sm text-gray-600 mt-1">
                This information is helpful for camp planning, but you can provide specific details later in your full profile.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bio (Tell us about yourself)
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={4}
                placeholder="Share a bit about yourself, your interests, and what you bring to the playa..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Ticket & Vehicle */}
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="hasTicket"
                  checked={formData.hasTicket}
                  onChange={handleChange}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">I have a Burning Man ticket</span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="hasVehiclePass"
                  checked={formData.hasVehiclePass}
                  onChange={handleChange}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">I have a vehicle pass</span>
              </label>
            </div>

            {/* Arrival & Departure Dates */}
            <div className="space-y-4 pt-3 border-t border-blue-200">
              <h4 className="text-sm font-semibold text-gray-900">Playa Arrival & Departure</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Arrival Date"
                  name="arrivalDate"
                  type="date"
                  value={formData.arrivalDate}
                  onChange={handleChange}
                />
                
                <Input
                  label="Departure Date"
                  name="departureDate"
                  type="date"
                  value={formData.departureDate}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="interestedInEAP"
                    checked={formData.interestedInEAP}
                    onChange={handleChange}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Interested in Early Arrival Pass (EAP)</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="interestedInStrike"
                    checked={formData.interestedInStrike}
                    onChange={handleChange}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Interested in staying for Strike / Late Departure</span>
                </label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Complete Profile
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Skip for Now
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ProfileCompletionModal;

