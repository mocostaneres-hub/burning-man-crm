import React, { useState, useEffect } from 'react';
import { Button, Card, Modal, Input, Badge } from '../ui';
import { Edit, X, UserPlus as UserPlusIcon, Shield, Users, CheckCircle as CheckCircleIcon, Loader2, User } from 'lucide-react';
import api from '../../services/api';

interface Member {
  id: string;
  userId: string;
  campId: string;
  role: 'Camp Lead' | 'Project Lead' | 'Camp Member';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePhoto?: string;
    playaName?: string;
  };
}

interface RoleChangeRequest {
  _id: string;
  memberId: string;
  currentRole: string;
  requestedRole: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  member: Member;
}

const ROLE_DESCRIPTIONS = {
  'Camp Lead': 'Full administrative control over the camp',
  'Project Lead': 'Can manage specific projects and tasks',
  'Camp Member': 'Standard camp member with basic permissions'
};

const RoleManagement: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [roleChangeRequests, setRoleChangeRequests] = useState<RoleChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMembers(),
        loadRoleChangeRequests()
      ]);
    } catch (err) {
      console.error('Error loading role management data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const response = await api.get('/camps/members');
      console.log('🔍 [RoleManagement] Members API response:', JSON.stringify(response.data, null, 2));
      if (response.data && response.data.length > 0) {
        console.log('🔍 [RoleManagement] First member data:', JSON.stringify(response.data[0], null, 2));
        if (response.data[0].user) {
          console.log('🔍 [RoleManagement] First member user data:', JSON.stringify(response.data[0].user, null, 2));
          console.log('🔍 [RoleManagement] First member playaName:', response.data[0].user.playaName);
        }
      }
      setMembers(response.data);
    } catch (err) {
      console.error('Error loading members:', err);
    }
  };

  const loadRoleChangeRequests = async () => {
    try {
      const response = await api.get('/roles/change-requests');
      setRoleChangeRequests(response.data);
    } catch (err) {
      console.error('Error loading role change requests:', err);
    }
  };

  const handleRoleChange = (member: Member) => {
    setSelectedMember(member);
    setNewRole(member.role);
    setShowRoleModal(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedMember || !newRole) return;

    try {
      setUpdating(true);
      await api.put(`/roles/members/${selectedMember.id}`, {
        role: newRole
      });

      // Update local state
      setMembers(members.map(member => 
        member.id === selectedMember.id 
          ? { ...member, role: newRole as any }
          : member
      ));

      setShowRoleModal(false);
      setSelectedMember(null);
    } catch (err) {
      console.error('Error updating role:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleRoleRequestDecision = async (requestId: string, decision: 'approved' | 'rejected') => {
    try {
      await api.put(`/roles/change-requests/${requestId}`, {
        status: decision
      });

      // Update local state
      setRoleChangeRequests(roleChangeRequests.map(request => 
        request._id === requestId 
          ? { ...request, status: decision }
          : request
      ));

      // If approved, update member role
      if (decision === 'approved') {
        const request = roleChangeRequests.find(r => r._id === requestId);
        if (request) {
          setMembers(members.map(member => 
            member.id === request.memberId 
              ? { ...member, role: request.requestedRole as any }
              : member
          ));
        }
      }
    } catch (err) {
      console.error('Error updating role request:', err);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Camp Lead':
        return <Shield className="w-4 h-4" />;
      case 'Project Lead':
        return <Users className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'inactive': return 'error';
      default: return 'neutral';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-custom-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h2 font-lato-bold text-custom-text">
            Role Management
          </h2>
          <p className="text-body text-custom-text-secondary">
            Manage member roles and permissions
          </p>
        </div>
      </div>

      {/* Members Table */}
      <Card>
        <div className="p-6">
          <h3 className="text-h3 font-lato-bold text-custom-text mb-4">
            Camp Members
          </h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Playa Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-custom-primary flex items-center justify-center text-white mr-3">
                          {member.user.profilePhoto ? (
                            <img
                              src={member.user.profilePhoto}
                              alt={`${member.user.firstName} ${member.user.lastName}`}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <User className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {member.user.firstName} {member.user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {member.user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-orange-600 font-medium">
                        {member.user.playaName ? `"${member.user.playaName}"` : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(member.role)}
                        <span className="text-sm text-gray-900">{member.role}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={getStatusColor(member.status)}>
                        {member.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRoleChange(member)}
                        className="flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" />
                        Edit Role
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {members.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-h3 font-lato-bold text-custom-text-secondary mb-2">
                No Members Found
              </h3>
              <p className="text-body text-custom-text-secondary">
                No camp members found.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Role Change Requests */}
      {roleChangeRequests.filter(r => r.status === 'pending').length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-h3 font-lato-bold text-custom-text mb-4">
              Pending Role Change Requests
            </h3>
            
            <div className="space-y-4">
              {roleChangeRequests
                .filter(request => request.status === 'pending')
                .map((request) => (
                  <div key={request._id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full bg-custom-primary flex items-center justify-center text-white">
                            {request.member.user.profilePhoto ? (
                              <img
                                src={request.member.user.profilePhoto}
                                alt={`${request.member.user.firstName} ${request.member.user.lastName}`}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-body font-medium text-custom-text">
                              {request.member.user.firstName} {request.member.user.lastName}
                            </h4>
                            <p className="text-sm text-custom-text-secondary">
                              {request.member.user.email}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <p className="text-sm text-custom-text-secondary">
                            <span className="font-medium">Current Role:</span> {request.currentRole}
                          </p>
                          <p className="text-sm text-custom-text-secondary">
                            <span className="font-medium">Requested Role:</span> {request.requestedRole}
                          </p>
                        </div>

                        <div className="mb-3">
                          <p className="text-sm font-medium text-custom-text mb-1">Reason:</p>
                          <p className="text-sm text-custom-text-secondary bg-gray-50 p-3 rounded">
                            {request.reason}
                          </p>
                        </div>

                        <p className="text-xs text-custom-text-secondary">
                          Requested on {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRoleRequestDecision(request._id, 'approved')}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          <CheckCircleIcon className="w-3 h-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRoleRequestDecision(request._id, 'rejected')}
                          className="text-red-600 border-red-600 hover:bg-red-50"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </Card>
      )}

      {/* Role Change Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => {
          setShowRoleModal(false);
          setSelectedMember(null);
        }}
        title="Change Member Role"
      >
        {selectedMember && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-body font-medium text-custom-text mb-1">
                {selectedMember.user.firstName} {selectedMember.user.lastName}
              </h4>
              <p className="text-sm text-custom-text-secondary">
                {selectedMember.user.email}
              </p>
              <p className="text-sm text-custom-text-secondary">
                Current Role: {selectedMember.role}
              </p>
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                New Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
              >
                <option value="Camp Member">Camp Member</option>
                <option value="Project Lead">Project Lead</option>
                <option value="Camp Lead">Camp Lead</option>
              </select>
              <p className="text-sm text-custom-text-secondary mt-1">
                {ROLE_DESCRIPTIONS[newRole as keyof typeof ROLE_DESCRIPTIONS]}
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRoleModal(false);
                  setSelectedMember(null);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdateRole}
                disabled={updating || !newRole || newRole === selectedMember.role}
                className="flex-1 flex items-center justify-center gap-2"
              >
                {updating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4" />
                    Update Role
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RoleManagement;