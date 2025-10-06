import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../ui';
import { Mail, MessageSquare, Send, X, Users, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

interface InviteMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  campId?: string;
}

interface InviteTemplates {
  inviteTemplateEmail: string;
  inviteTemplateSMS: string;
}

const InviteMembersModal: React.FC<InviteMembersModalProps> = ({
  isOpen,
  onClose,
  campId
}) => {
  const { user } = useAuth();
  const [recipients, setRecipients] = useState('');
  const [method, setMethod] = useState<'email' | 'sms'>('email');
  const [templates, setTemplates] = useState<InviteTemplates | null>(null);
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [campName, setCampName] = useState<string>('');

  // Parse recipients from textarea
  const parseRecipients = (text: string): string[] => {
    return text
      .split(/[,\n\s]+/)
      .map(recipient => recipient.trim())
      .filter(recipient => recipient.length > 0);
  };

  // Load invite templates when modal opens
  useEffect(() => {
    if (isOpen && campId) {
      loadTemplates();
    }
  }, [isOpen, campId]);

  const loadTemplates = async () => {
    try {
      setTemplatesLoading(true);
      
      // Load templates and camp data in parallel
      const [templatesResponse, campResponse] = await Promise.all([
        api.get(`/camps/${campId}/invites/template`),
        api.getCamp(campId)
      ]);
      
      setTemplates(templatesResponse.data);
      // Handle both 'campName' and 'name' fields from API response
      const camp: any = campResponse.camp || campResponse;
      setCampName(camp?.campName || camp?.name || user?.campName || 'Your Camp');
    } catch (err: any) {
      console.error('Error loading templates:', err);
      setError('Failed to load invite templates');
      // Fallback camp name
      setCampName(user?.campName || 'Your Camp');
    } finally {
      setTemplatesLoading(false);
    }
  };

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

    // Basic validation
    if (method === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = recipientList.filter(email => !emailRegex.test(email));
      if (invalidEmails.length > 0) {
        setError(`Invalid email addresses: ${invalidEmails.join(', ')}`);
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/invites', {
        recipients: recipientList,
        method,
        campId
      });

      const { invitesSent, errors, summary } = response.data;
      
      if (summary.failed > 0) {
        setError(`${summary.sent} invites sent successfully, ${summary.failed} failed`);
      } else {
        setSuccess(`Successfully sent ${summary.sent} ${method} invites!`);
      }

      // Clear form on success
      if (summary.failed === 0) {
        setRecipients('');
        setTimeout(() => {
          onClose();
          setSuccess(null);
        }, 2000);
      }

    } catch (err: any) {
      console.error('Error sending invites:', err);
      setError(err.response?.data?.message || 'Failed to send invites');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRecipients('');
    setMethod('email');
    setError(null);
    setSuccess(null);
    onClose();
  };

  const getCurrentTemplate = () => {
    if (!templates) return '';
    
    const template = method === 'email' ? templates.inviteTemplateEmail : templates.inviteTemplateSMS;
    
    // Replace placeholders for preview
    return template
      .replace(/\{\{campName\}\}/g, campName || '[Camp Name]')
      .replace(/\{\{link\}\}/g, 'http://localhost:3000/apply?token=[unique-token]');
  };

  const recipientCount = parseRecipients(recipients).length;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Invite Members
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Method Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Invitation Method
            </label>
            <div className="flex gap-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="method"
                  value="email"
                  checked={method === 'email'}
                  onChange={(e) => setMethod(e.target.value as 'email' | 'sms')}
                  className="sr-only"
                />
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                  method === 'email' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}>
                  <Mail className="w-5 h-5" />
                  Email
                </div>
              </label>
              
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="method"
                  value="sms"
                  checked={method === 'sms'}
                  onChange={(e) => setMethod(e.target.value as 'email' | 'sms')}
                  className="sr-only"
                />
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                  method === 'sms' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}>
                  <MessageSquare className="w-5 h-5" />
                  SMS
                </div>
              </label>
            </div>
          </div>

          {/* Recipients Input */}
          <div>
            <label htmlFor="recipients" className="block text-sm font-medium text-gray-700 mb-2">
              Recipients {recipientCount > 0 && (
                <span className="text-blue-600">({recipientCount} {method === 'email' ? 'emails' : 'phone numbers'})</span>
              )}
            </label>
            <textarea
              id="recipients"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder={method === 'email' 
                ? 'Enter email addresses separated by commas, spaces, or new lines\n\nExample:\njohn@example.com, mary@example.com\nuser@domain.com'
                : 'Enter phone numbers separated by commas, spaces, or new lines\n\nExample:\n+1234567890, +0987654321\n+1122334455'
              }
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              required
            />
          </div>

          {/* Template Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message Preview
            </label>
            {templatesLoading ? (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading template...
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">
                  This message will be sent to each recipient:
                </div>
                <div className="bg-white p-3 rounded border text-sm text-gray-900 whitespace-pre-wrap">
                  {getCurrentTemplate()}
                </div>
                {templates && (
                  <div className="text-xs text-gray-500 mt-2">
                    Placeholders like <code>{'{{campName}}'}</code> and <code>{'{{link}}'}</code> will be automatically replaced.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-red-700 text-sm">{error}</div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="text-green-700 text-sm">{success}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>
            
            <Button
              type="submit"
              variant="primary"
              disabled={loading || recipientCount === 0 || templatesLoading}
              className="flex items-center gap-2"
            >
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
      </div>
    </Modal>
  );
};

export default InviteMembersModal;
