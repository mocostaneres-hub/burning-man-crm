import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Modal } from '../ui';
import { Loader2, Mail, RefreshCw, Send, Users, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatDate } from '../../utils/dateFormatters';

interface InviteMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  campId?: string;
}

interface InviteTemplates {
  inviteTemplateEmail: string;
  inviteTemplateSMS: string;
}

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

const InviteMembersModal: React.FC<InviteMembersModalProps> = ({ isOpen, onClose, campId }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'invite' | 'pending'>('invite');
  const [recipients, setRecipients] = useState('');
  const [templates, setTemplates] = useState<InviteTemplates | null>(null);
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'applied' | 'expired'>('pending');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [campName, setCampName] = useState<string>('');

  const parseRecipients = (text: string): string[] => {
    return text
      .split(/[,\n\s]+/)
      .map((recipient) => recipient.trim().toLowerCase())
      .filter((recipient) => recipient.length > 0);
  };

  const loadTemplates = useCallback(async () => {
    try {
      setTemplatesLoading(true);
      setError(null);

      const templatesResponse = await api.getInviteTemplates(campId!);
      setTemplates(templatesResponse);

      let resolvedCampName = user?.campName || 'Your Camp';
      try {
        const isCurrentCampContext = user?.accountType === 'camp' && user?.campId?.toString() === campId;
        if (isCurrentCampContext) {
          const myCamp: any = await api.getMyCamp();
          resolvedCampName = myCamp?.name || myCamp?.campName || resolvedCampName;
        } else {
          const campResponse = await api.getCamp(campId!);
          const camp: any = campResponse?.camp || campResponse;
          resolvedCampName = camp?.name || camp?.campName || resolvedCampName;
        }
      } catch (campErr: any) {
        console.warn('Invite modal camp name fallback:', campErr?.response?.data || campErr?.message);
      }

      setCampName(resolvedCampName);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to load invite templates. Please try again.';
      setError(errorMessage);
      setTemplates({
        inviteTemplateEmail: "Hello! You've been personally invited to apply to join our camp, {{campName}}, for Burning Man. Click here to start your application: {{link}}",
        inviteTemplateSMS: "You're invited to {{campName}}! Apply here: {{link}}"
      });
      setCampName(user?.campName || 'Your Camp');
    } finally {
      setTemplatesLoading(false);
    }
  }, [campId, user?.accountType, user?.campId, user?.campName]);

  const loadInvites = useCallback(async () => {
    if (!campId) return;
    try {
      setInvitesLoading(true);
      setInvitesError(null);
      const response = await api.getCampInvites(campId, undefined);
      setInvites(response?.invites || []);
    } catch (err: any) {
      console.error('Error loading invites in modal:', err);
      setInvitesError(err.response?.data?.message || 'Failed to load pending invites');
    } finally {
      setInvitesLoading(false);
    }
  }, [campId]);

  useEffect(() => {
    if (isOpen && campId) {
      loadTemplates();
      loadInvites();
    }
  }, [isOpen, campId, loadTemplates, loadInvites]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!campId) {
      setError('Camp ID is required');
      return;
    }

    const recipientList = parseRecipients(recipients);
    if (recipientList.length === 0) {
      setError('Please enter at least one recipient');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipientList.filter((email) => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      setError(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await api.sendInvites({
        recipients: recipientList,
        method: 'email',
        campId
      });

      const { summary } = response;
      if (summary.failed > 0) {
        setError(`${summary.sent} invites sent successfully, ${summary.failed} skipped/failed`);
      } else {
        setSuccess(`Successfully sent ${summary.sent} email invites.`);
      }

      if (summary.sent > 0) {
        setRecipients('');
      }

      await loadInvites();
      setActiveTab('pending');
    } catch (err: any) {
      console.error('Error sending invites:', err);
      setError(err.response?.data?.message || 'Failed to send invites');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRecipients('');
    setError(null);
    setSuccess(null);
    setInvitesError(null);
    setActiveTab('invite');
    onClose();
  };

  const getCurrentTemplate = () => {
    if (!templates) return '';
    const exampleLink =
      window.location.hostname === 'localhost'
        ? 'http://localhost:3000/camps/[camp-slug]?invite=[unique-token]'
        : `${window.location.protocol}//${window.location.host}/camps/[camp-slug]?invite=[unique-token]`;

    return templates.inviteTemplateEmail
      .replace(/\{\{campName\}\}/g, campName || '[Camp Name]')
      .replace(/\{\{link\}\}/g, exampleLink);
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
    switch (status) {
      case 'sent':
        return 'success';
      case 'pending':
        return 'warning';
      case 'applied':
        return 'info';
      case 'expired':
        return 'error';
      default:
        return 'neutral';
    }
  };

  const filteredInvites = useMemo(() => {
    if (statusFilter === 'pending') {
      return invites.filter((invite) => invite.status === 'pending' || invite.status === 'sent');
    }
    return invites.filter((invite) => invite.status === statusFilter);
  }, [invites, statusFilter]);

  const statusCounts = useMemo(
    () => ({
      pending: invites.filter((invite) => invite.status === 'pending' || invite.status === 'sent').length,
      applied: invites.filter((invite) => invite.status === 'applied').length,
      expired: invites.filter((invite) => invite.status === 'expired').length
    }),
    [invites]
  );

  const recipientCount = parseRecipients(recipients).length;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Invite Members
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close invite modal">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex gap-2 border-b mb-6">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-t-md ${
              activeTab === 'invite' ? 'bg-blue-50 text-blue-700 border border-blue-200 border-b-transparent' : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setActiveTab('invite')}
          >
            Send Invites
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium rounded-t-md ${
              activeTab === 'pending' ? 'bg-blue-50 text-blue-700 border border-blue-200 border-b-transparent' : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setActiveTab('pending')}
          >
            Pending Invites
          </button>
        </div>

        {activeTab === 'invite' ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="recipients" className="block text-sm font-medium text-gray-700 mb-2">
                Recipients {recipientCount > 0 && <span className="text-blue-600">({recipientCount} emails)</span>}
              </label>
              <textarea
                id="recipients"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder={'Enter email addresses separated by commas, spaces, or new lines\n\nExample:\njohn@example.com, mary@example.com\nuser@domain.com'}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message Preview</label>
              {templatesLoading ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading template...
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-2">This message will be sent to each recipient:</div>
                  <div className="bg-white p-3 rounded border text-sm text-gray-900 whitespace-pre-wrap">{getCurrentTemplate()}</div>
                  {templates && (
                    <div className="text-xs text-gray-500 mt-2">
                      Placeholders like <code>{'{{campName}}'}</code> and <code>{'{{link}}'}</code> will be automatically replaced.
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="text-red-700 text-sm">{error}</div>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="text-green-700 text-sm">{success}</div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t">
              <Button type="button" variant="secondary" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>

              <Button type="submit" variant="primary" disabled={loading || recipientCount === 0 || templatesLoading} className="flex items-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send {recipientCount > 0 ? `${recipientCount} ` : ''}Invites
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    statusFilter === 'pending' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-gray-100 text-gray-700 border-gray-300'
                  }`}
                >
                  Pending ({statusCounts.pending})
                </button>
                <button
                  onClick={() => setStatusFilter('applied')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    statusFilter === 'applied' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-gray-100 text-gray-700 border-gray-300'
                  }`}
                >
                  Applied ({statusCounts.applied})
                </button>
                <button
                  onClick={() => setStatusFilter('expired')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                    statusFilter === 'expired' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-gray-100 text-gray-700 border-gray-300'
                  }`}
                >
                  Expired ({statusCounts.expired})
                </button>
              </div>
              <Button variant="outline" onClick={loadInvites} disabled={invitesLoading} className="flex items-center gap-2" title="Refresh pending invites">
                <RefreshCw className={`w-4 h-4 ${invitesLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {invitesError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">{invitesError}</div>
            )}

            {invitesLoading ? (
              <div className="p-8 text-center text-gray-500">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading invites...
                </div>
              </div>
            ) : filteredInvites.length === 0 ? (
              <div className="p-8 text-center text-gray-600 border rounded-lg bg-gray-50">
                No invites found for this status.
              </div>
            ) : (
              <div className="overflow-auto border rounded-lg max-h-[420px]">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipient</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sender</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInvites.map((invite) => {
                      const isExpired = invite.expiresAt ? new Date(invite.expiresAt) < new Date() : false;
                      return (
                        <tr key={invite._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{invite.recipient}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-4 h-4 text-blue-500" />
                              Email
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant={getStatusVariant(invite.status)}>
                              {invite.status.charAt(0).toUpperCase() + invite.status.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{formatDate(invite.createdAt)}</td>
                          <td className={`px-4 py-3 text-sm ${isExpired ? 'text-red-600' : 'text-gray-700'}`}>
                            {formatDate(invite.expiresAt)}
                            {isExpired ? ' (Expired)' : ''}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {invite.sender ? `${invite.sender.firstName} ${invite.sender.lastName}` : 'Unknown'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default InviteMembersModal;
