import React, { useState, useEffect } from 'react';
import { Button, Card, Modal, Input } from '../../components/ui';
import { Plus, Calendar, Clock, Trash2, Users, Loader2, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

interface CallSlot {
  _id: string;
  campId: string;
  date: string;
  startTime: string;
  endTime: string;
  maxParticipants: number;
  currentParticipants: number;
  isAvailable: boolean;
  bookedBy?: string[];
  notes?: string;
}

interface Applicant {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  applicationId: string;
  applicationStatus: string;
  appliedAt: string;
}

const CallSlotManagement: React.FC = () => {
  const { user } = useAuth();
  const [callSlots, setCallSlots] = useState<CallSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<CallSlot | null>(null);
  const [slotApplicants, setSlotApplicants] = useState<Applicant[]>([]);
  const [slotNotes, setSlotNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [campId, setCampId] = useState<string | number>('');
  const [newSlot, setNewSlot] = useState({
    date: '',
    startTime: '',
    endTime: '',
    maxParticipants: 1
  });

  useEffect(() => {
    fetchCampAndSlots();
  }, []);

  const fetchCampAndSlots = async () => {
    try {
      setLoading(true);
      // Get camp ID first
      const campResponse = await api.getMyCamp();
      const fetchedCampId = campResponse._id;
      setCampId(fetchedCampId);

      // Fetch call slots for this camp
      const slotsResponse = await api.get(`/call-slots/camp/${fetchedCampId}`);
      setCallSlots(slotsResponse || []);
    } catch (error) {
      console.error('Error fetching call slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSlot = async () => {
    try {
      if (!newSlot.date || !newSlot.startTime || !newSlot.endTime) {
        alert('Please fill in all required fields');
        return;
      }

      await api.post('/call-slots', {
        campId,
        date: newSlot.date,
        startTime: newSlot.startTime,
        endTime: newSlot.endTime,
        maxParticipants: newSlot.maxParticipants
      });

      // Reset form and close modal
      setNewSlot({ date: '', startTime: '', endTime: '', maxParticipants: 1 });
      setShowCreateModal(false);

      // Refresh slots
      fetchCampAndSlots();
    } catch (error) {
      console.error('Error creating call slot:', error);
      alert('Failed to create call slot');
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!window.confirm('Are you sure you want to delete this call slot?')) {
      return;
    }

    try {
      await api.delete(`/call-slots/${slotId}`);
      fetchCampAndSlots();
    } catch (error) {
      console.error('Error deleting call slot:', error);
      alert('Failed to delete call slot');
    }
  };

  const handleViewSlot = async (slot: CallSlot) => {
    try {
      setSelectedSlot(slot);
      setSlotNotes(slot.notes || '');
      
      // Fetch call slot details with applicants
      const response = await api.get(`/call-slots/${slot._id}/details`);
      setSlotApplicants(response.applicants || []);
      setShowViewModal(true);
    } catch (error) {
      console.error('Error fetching call slot details:', error);
      alert('Failed to load call slot details');
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedSlot) return;

    try {
      setSavingNotes(true);
      await api.put(`/call-slots/${selectedSlot._id}`, {
        notes: slotNotes
      });
      
      // Update local state
      setCallSlots(prev => prev.map(slot => 
        slot._id === selectedSlot._id ? { ...slot, notes: slotNotes } : slot
      ));
      
      alert('Notes saved successfully');
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-h1 font-lato-bold text-custom-text mb-2">
            Call Time Management
          </h1>
          <p className="text-body text-custom-text-secondary">
            Create and manage available call times for applicant orientation calls
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Call Time
        </Button>
      </div>

      {callSlots.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-h3 font-lato-bold text-custom-text-secondary mb-2">
            No call times scheduled yet
          </h3>
          <p className="text-body text-custom-text-secondary mb-6">
            Create call time slots for applicant orientation calls
          </p>
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            Create First Call Time
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {callSlots.map((slot) => (
            <Card key={slot._id} className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 text-gray-900 font-semibold mb-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    {formatDate(slot.date)}
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock className="w-4 h-4 text-green-600" />
                    {slot.startTime} - {slot.endTime}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteSlot(slot._id)}
                  className="text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600 mt-4 pt-4 border-t border-gray-200">
                <Users className="w-4 h-4" />
                <span>
                  {slot.currentParticipants} / {slot.maxParticipants} booked
                </span>
                <span className={`ml-auto px-2 py-1 rounded-full text-xs font-medium ${
                  slot.isAvailable && slot.currentParticipants < slot.maxParticipants
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {slot.isAvailable && slot.currentParticipants < slot.maxParticipants ? 'Available' : 'Full'}
                </span>
              </div>

              {/* View Button */}
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewSlot(slot)}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Details
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Call Slot Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Call Time Slot"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date *
            </label>
            <Input
              type="date"
              value={newSlot.date}
              onChange={(e) => setNewSlot(prev => ({ ...prev, date: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time *
              </label>
              <Input
                type="time"
                value={newSlot.startTime}
                onChange={(e) => setNewSlot(prev => ({ ...prev, startTime: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time *
              </label>
              <Input
                type="time"
                value={newSlot.endTime}
                onChange={(e) => setNewSlot(prev => ({ ...prev, endTime: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Participants
            </label>
            <Input
              type="number"
              min="1"
              value={newSlot.maxParticipants}
              onChange={(e) => setNewSlot(prev => ({ ...prev, maxParticipants: parseInt(e.target.value) || 1 }))}
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateSlot}
              className="flex-1"
            >
              Create Call Time
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Call Slot Details Modal */}
      {selectedSlot && (
        <Modal
          isOpen={showViewModal}
          onClose={() => setShowViewModal(false)}
          title="Call Slot Details"
        >
          <div className="space-y-6">
            {/* Call Slot Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Date</div>
                  <div className="font-medium text-gray-900">{formatDate(selectedSlot.date)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Time</div>
                  <div className="font-medium text-gray-900">{selectedSlot.startTime} - {selectedSlot.endTime}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Capacity</div>
                  <div className="font-medium text-gray-900">{selectedSlot.currentParticipants} / {selectedSlot.maxParticipants}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Status</div>
                  <div className={`font-medium ${
                    selectedSlot.isAvailable && selectedSlot.currentParticipants < selectedSlot.maxParticipants
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {selectedSlot.isAvailable && selectedSlot.currentParticipants < selectedSlot.maxParticipants ? 'Available' : 'Full'}
                  </div>
                </div>
              </div>
            </div>

            {/* Applicants List */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Applicants ({slotApplicants.length})
              </h3>
              {slotApplicants.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No applicants have selected this time slot yet
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {slotApplicants.map((applicant) => (
                    <div key={applicant._id} className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            {applicant.firstName} {applicant.lastName}
                          </div>
                          <div className="text-sm text-gray-600">{applicant.email}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs px-2 py-1 rounded-full ${
                            applicant.applicationStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            applicant.applicationStatus === 'approved' ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {applicant.applicationStatus}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Applied: {new Date(applicant.appliedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Internal Notes
              </label>
              <textarea
                value={slotNotes}
                onChange={(e) => setSlotNotes(e.target.value)}
                placeholder="Add notes about this call (e.g., technical issues, translator needed, etc.)"
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent resize-none"
              />
              <div className="text-sm text-gray-500 mt-1">
                These notes are only visible to camp administrators
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => setShowViewModal(false)}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="flex-1"
              >
                {savingNotes ? 'Saving...' : 'Save Notes'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CallSlotManagement;