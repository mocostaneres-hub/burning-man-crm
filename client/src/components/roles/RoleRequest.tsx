import React, { useState } from 'react';
import { Button, Modal, Badge } from '../ui';
import { Send, Loader2 } from 'lucide-react';
import api from '../../services/api';

interface RoleRequestProps {
  currentRole: 'Camp Lead' | 'Project Lead' | 'Camp Member';
  memberId: string;
  campId: string;
  onRequestSubmitted?: () => void;
}

const RoleRequest: React.FC<RoleRequestProps> = ({
  currentRole,
  memberId,
  campId,
  onRequestSubmitted,
}) => {
  const [showDialog, setShowDialog] = useState(false);
  const [requestedRole, setRequestedRole] = useState<'Camp Lead' | 'Project Lead' | 'Camp Member'>('Camp Member');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'Camp Lead':
        return 'Full camp management access, can assign roles, manage finances, and remove members';
      case 'Project Lead':
        return 'Can manage specific projects, assign tasks, and view member information';
      case 'Camp Member':
        return 'Basic camp member with limited management access';
      default:
        return '';
    }
  };

  const canRequestRole = (role: string) => {
    // Can't request the same role
    if (role === currentRole) return false;
    
    // For demo purposes, allow all role requests
    // In real app, you might have additional business logic
    return true;
  };

  const handleSubmitRequest = async () => {
    if (!reason.trim() || reason.length < 10) {
      setError('Please provide a detailed reason (at least 10 characters)');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await api.post(`/role-management/members/${memberId}/request-role-change`, {
        requestedRole: requestedRole,
        reason: reason.trim(),
      });

      if (response.data.success) {
        setSuccess('Role change request submitted successfully!');
        setReason('');
        setShowDialog(false);
        onRequestSubmitted?.();
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error: any) {
      console.error('Error submitting role request:', error);
      setError(error.response?.data?.message || 'Failed to submit role change request');
    } finally {
      setLoading(false);
    }
  };

  const availableRoles = ['Camp Lead', 'Project Lead', 'Camp Member'].filter(role => 
    canRequestRole(role)
  );

  if (availableRoles.length === 0) {
    return null; // Don't show component if no roles can be requested
  }

  return (
    <div>
      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded relative" role="alert">
          <span className="block sm:inline">{success}</span>
        </div>
      )}

      <div className="p-6 bg-gradient-to-br from-gray-800 to-gray-900 border border-orange-500 rounded-lg shadow-lg">
        <div className="text-center mb-6">
          <h3 className="text-h3 font-lato-bold text-white mb-2">
            Request Role Change
          </h3>
          <p className="text-body text-gray-300">
            Current Role: <Badge variant="neutral" className="ml-2">{currentRole}</Badge>
          </p>
        </div>

        <p className="text-body text-gray-300 mb-4">
          Want to take on more responsibility? Request a role change to help manage your camp better.
        </p>

        <Button
          variant="outline"
          onClick={() => setShowDialog(true)}
          className="w-full border-orange-500 text-orange-500 hover:bg-orange-50"
        >
          Request Role Change
        </Button>
      </div>

      {/* Role Request Dialog */}
      <Modal
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        title="Request Role Change"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded relative" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <div className="mb-4">
            <p className="text-body text-custom-text-secondary mb-2">
              Current Role: <Badge variant="neutral" className="ml-2">{currentRole}</Badge>
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-label font-medium text-custom-text mb-2">
              Requested Role
            </label>
            <select
              value={requestedRole}
              onChange={(e) => setRequestedRole(e.target.value as any)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
            >
              {availableRoles.map((role) => (
                <option key={role} value={role}>
                  {role} - {getRoleDescription(role)}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-label font-medium text-custom-text mb-2">
              Why do you want this role? (Minimum 10 characters)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you're qualified for this role and how you'll contribute to the camp..."
              rows={4}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent resize-none"
            />
          </div>

          <div className="p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded relative" role="alert">
            <p className="text-sm">
              Your request will be reviewed by the Camp Lead. You'll be notified once a decision is made.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitRequest}
              disabled={loading || !reason.trim() || reason.length < 10}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RoleRequest;
