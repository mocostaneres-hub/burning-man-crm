import React, { useState, useEffect } from 'react';
import { Button, Card, Badge } from '../../components/ui';
import { Users, Mail, MessageSquare, RefreshCw, Loader2, AlertTriangle, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatDate } from '../../utils/dateFormatters';
import InviteMembersModal from '../../components/invites/InviteMembersModal';

interface Invite {
  _id: string;
  recipient: string;
  method: 'email' | 'sms';
  status: 'pending' | 'sent' | 'applied' | 'expired';
  createdAt: string;
  expiresAt: string;
  sender?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

const InviteTrackingPage: React.FC = () => {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Get camp ID from user context
  const campId = user?._id?.toString(); // For camp accounts, the user ID is the camp ID

  // Check if user is camp lead
  const isCampLead = user?.accountType === 'admin' || user?.accountType === 'camp';

  useEffect(() => {
    if (campId && isCampLead) {
      loadInvites();
    }
  }, [campId, isCampLead, statusFilter]);

  const loadInvites = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filterParam = statusFilter === 'all' ? undefined : statusFilter;
      const response = await api.getCampInvites(campId!, filterParam);
      
      setInvites(response.invites || []);
    } catch (err: any) {
      console.error('Error loading invites:', err);
      setError('Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
    switch (status) {
      case 'sent': return 'success';
      case 'pending': return 'warning';
      case 'applied': return 'info';
      case 'expired': return 'error';
      default: return 'neutral';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'sent': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'applied': return 'text-blue-600 bg-blue-50';
      case 'expired': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatExpirationDate = (expiresAt: string) => {
    const expireDate = new Date(expiresAt);
    const now = new Date();
    const isExpired = expireDate < now;
    
    return (
      <span className={isExpired ? 'text-red-600' : 'text-gray-600'}>
        {formatDate(expiresAt)}
        {isExpired && ' (Expired)'}
      </span>
    );
  };

  const getFilteredInvites = () => {
    if (statusFilter === 'all') {
      return invites;
    }
    return invites.filter(invite => invite.status === statusFilter);
  };

  const filteredInvites = getFilteredInvites();

  // Status counts for filter badges
  const statusCounts = {
    all: invites.length,
    pending: invites.filter(i => i.status === 'pending').length,
    sent: invites.filter(i => i.status === 'sent').length,
    applied: invites.filter(i => i.status === 'applied').length,
    expired: invites.filter(i => i.status === 'expired').length,
  };

  if (!isCampLead) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <div className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">Only Camp Leads can view invite tracking.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              Invite Tracking
            </h1>
            <p className="text-gray-600 mt-2">
              Monitor and manage member invitations for your camp.
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={loadInvites}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            <Button
              variant="primary"
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Send Invites
            </Button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)} ({count})
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-700">{error}</div>
        </div>
      )}

      <Card>
        {loading ? (
          <div className="p-8 text-center">
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              Loading invites...
            </div>
          </div>
        ) : filteredInvites.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {statusFilter === 'all' ? 'No Invites Yet' : `No ${statusFilter} Invites`}
            </h3>
            <p className="text-gray-600 mb-4">
              {statusFilter === 'all' 
                ? 'Start inviting members to your camp by sending your first invite.'
                : `There are no invites with ${statusFilter} status.`}
            </p>
            {statusFilter === 'all' && (
              <Button
                variant="primary"
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Send First Invite
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sender
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvites.map((invite) => (
                  <tr key={invite._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {invite.recipient}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {invite.method === 'email' ? (
                          <Mail className="w-4 h-4 text-blue-500" />
                        ) : (
                          <MessageSquare className="w-4 h-4 text-green-500" />
                        )}
                        <span className="text-sm text-gray-700 capitalize">
                          {invite.method}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={getStatusVariant(invite.status)}>
                        {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(invite.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {formatExpirationDate(invite.expiresAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {invite.sender 
                          ? `${invite.sender.firstName} ${invite.sender.lastName}`
                          : 'Unknown'
                        }
                      </div>
                      {invite.sender && (
                        <div className="text-xs text-gray-500">
                          {invite.sender.email}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteMembersModal
          isOpen={showInviteModal}
          onClose={() => {
            setShowInviteModal(false);
            loadInvites(); // Refresh the list after sending invites
          }}
          campId={campId}
        />
      )}
    </div>
  );
};

export default InviteTrackingPage;
