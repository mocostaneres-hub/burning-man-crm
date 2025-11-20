import React, { useState } from 'react';
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
  
  const [formData, setFormData] = useState({
    playaName: user?.playaName || '',
    city: user?.city || '',
    yearsBurned: user?.yearsBurned || 0,
    bio: user?.bio || '',
    phoneNumber: user?.phoneNumber || '',
    hasTicket: user?.hasTicket || false,
    hasVehiclePass: user?.hasVehiclePass || false
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Update user profile
      await api.put('/users/profile', formData);
      
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Playa Name"
              name="playaName"
              value={formData.playaName}
              onChange={handleChange}
              placeholder="Your playa name"
            />
            
            <Input
              label="City"
              name="city"
              value={formData.city}
              onChange={handleChange}
              placeholder="Your city"
            />
          </div>

          <Input
            label="Phone Number"
            name="phoneNumber"
            type="tel"
            value={formData.phoneNumber}
            onChange={handleChange}
            placeholder="+1 (555) 123-4567"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Years Burned (How many Burning Mans have you attended?)
            </label>
            <select
              name="yearsBurned"
              value={formData.yearsBurned}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

