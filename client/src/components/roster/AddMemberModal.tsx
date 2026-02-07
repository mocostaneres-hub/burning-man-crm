import React, { useState } from 'react';
import { Modal, Button, Input } from '../ui';
import { X } from 'lucide-react';
import apiService from '../../services/api';
import { useSkills } from '../../hooks/useSkills';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  rosterId: string;
  onMemberAdded: () => void;
}

interface MemberFormData {
  firstName: string;
  lastName: string;
  email: string;
  playaName: string;
  city: string;
  yearsBurned: number;
  hasTicket: boolean | null;
  hasVehiclePass: boolean | null;
  arrivalDate: string;
  departureDate: string;
  skills: string[];
  duesPaid: boolean;
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  rosterId,
  onMemberAdded,
}) => {
  const { skills: SKILLS_OPTIONS, loading: skillsLoading } = useSkills();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<MemberFormData>({
    firstName: '',
    lastName: '',
    email: '',
    playaName: '',
    city: '',
    yearsBurned: 0,
    hasTicket: null,
    hasVehiclePass: null,
    arrivalDate: '',
    departureDate: '',
    skills: [],
    duesPaid: false,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'yearsBurned') {
      setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleTicketChange = (value: boolean | null) => {
    setFormData(prev => ({ ...prev, hasTicket: value }));
  };

  const handleVPChange = (value: boolean | null) => {
    setFormData(prev => ({ ...prev, hasVehiclePass: value }));
  };

  const handleSkillSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSkill = e.target.value;
    if (selectedSkill && !formData.skills.includes(selectedSkill)) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, selectedSkill].sort() // Keep skills alphabetically sorted
      }));
      // Reset dropdown to placeholder
      e.target.value = '';
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic validation
    if (!formData.firstName || !formData.lastName || !formData.email) {
      setError('First name, last name, and email are required');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      await apiService.post(`/rosters/${rosterId}/members`, formData);
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        playaName: '',
        city: '',
        yearsBurned: 0,
        hasTicket: null,
        hasVehiclePass: null,
        arrivalDate: '',
        departureDate: '',
        skills: [],
        duesPaid: false,
      });
      
      onMemberAdded();
      onClose();
    } catch (err: any) {
      console.error('Error adding member:', err);
      setError(err.response?.data?.message || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Member to Roster">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name *"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              required
            />
            <Input
              label="Last Name *"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              required
            />
          </div>

          <Input
            label="Email *"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            required
          />

          <Input
            label="Playa Name"
            name="playaName"
            value={formData.playaName}
            onChange={handleInputChange}
          />

          <Input
            label="City"
            name="city"
            value={formData.city}
            onChange={handleInputChange}
          />

          <Input
            label="Years Burned"
            name="yearsBurned"
            type="number"
            min="0"
            value={formData.yearsBurned}
            onChange={handleInputChange}
          />
        </div>

        {/* Ticket & VP Status */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Logistics</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Has Ticket?
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="hasTicket"
                  checked={formData.hasTicket === true}
                  onChange={() => handleTicketChange(true)}
                  className="mr-2"
                />
                Yes
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="hasTicket"
                  checked={formData.hasTicket === false}
                  onChange={() => handleTicketChange(false)}
                  className="mr-2"
                />
                No
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="hasTicket"
                  checked={formData.hasTicket === null}
                  onChange={() => handleTicketChange(null)}
                  className="mr-2"
                />
                Not Informed
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Has VP?
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="hasVehiclePass"
                  checked={formData.hasVehiclePass === true}
                  onChange={() => handleVPChange(true)}
                  className="mr-2"
                />
                Yes
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="hasVehiclePass"
                  checked={formData.hasVehiclePass === false}
                  onChange={() => handleVPChange(false)}
                  className="mr-2"
                />
                No
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="hasVehiclePass"
                  checked={formData.hasVehiclePass === null}
                  onChange={() => handleVPChange(null)}
                  className="mr-2"
                />
                Not Informed
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Arrival Date"
              name="arrivalDate"
              type="date"
              value={formData.arrivalDate}
              onChange={handleInputChange}
            />
            <Input
              label="Departure Date"
              name="departureDate"
              type="date"
              value={formData.departureDate}
              onChange={handleInputChange}
            />
          </div>
        </div>

        {/* Skills */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Skills</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Skills
            </label>
            <select
              onChange={handleSkillSelect}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              defaultValue=""
              disabled={skillsLoading}
            >
              <option value="" disabled>{skillsLoading ? 'Loading skills...' : 'Choose a skill to add...'}</option>
              {SKILLS_OPTIONS.filter(skill => !formData.skills.includes(skill)).map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
          </div>

          {formData.skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    className="hover:text-blue-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Dues Status */}
        <div className="space-y-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              name="duesPaid"
              checked={formData.duesPaid}
              onChange={handleInputChange}
              className="mr-2"
            />
            <span className="text-sm font-medium text-gray-700">Dues Paid</span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
          >
            {loading ? 'Adding Member...' : 'Add Member'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddMemberModal;

