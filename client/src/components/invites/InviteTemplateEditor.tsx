import React, { useState, useEffect } from 'react';
import { Button, Card } from '../ui';
import { Mail, MessageSquare, Save, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

interface InviteTemplateEditorProps {
  campId?: string;
}

interface InviteTemplates {
  inviteTemplateEmail: string;
  inviteTemplateSMS: string;
}

const InviteTemplateEditor: React.FC<InviteTemplateEditorProps> = ({ campId }) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<InviteTemplates>({
    inviteTemplateEmail: '',
    inviteTemplateSMS: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Check if user is camp lead
  const isCampLead = user?.accountType === 'admin' || user?.accountType === 'camp';

  useEffect(() => {
    if (campId && isCampLead) {
      loadTemplates();
    }
  }, [campId, isCampLead]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      setAccessDenied(false);
      const response = await api.getInviteTemplates(campId!);
      setTemplates(response);
    } catch (err: any) {
      console.error('Error loading templates:', err);
      
      // If 403, user is not authorized - hide component silently
      if (err.response?.status === 403) {
        console.log('⚠️ [InviteTemplateEditor] User not authorized to view templates - component will hide');
        setAccessDenied(true);
        setError(null); // Don't show error to user
        setLoading(false);
        return;
      }
      
      // For other errors, show error message
      setError('Failed to load invite templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!campId) {
      setError('Camp ID is required');
      return;
    }

    // Validate templates contain required placeholders
    const emailValid = templates.inviteTemplateEmail.includes('{{campName}}') && 
                      templates.inviteTemplateEmail.includes('{{link}}');
    const smsValid = templates.inviteTemplateSMS.includes('{{campName}}') && 
                    templates.inviteTemplateSMS.includes('{{link}}');

    if (!emailValid || !smsValid) {
      setError('Both templates must contain {{campName}} and {{link}} placeholders');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      await api.updateInviteTemplates(campId, templates);
      
      setSuccess('Invite templates updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      console.error('Error saving templates:', err);
      setError(err.response?.data?.message || 'Failed to save templates');
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateChange = (type: 'inviteTemplateEmail' | 'inviteTemplateSMS', value: string) => {
    setTemplates(prev => ({
      ...prev,
      [type]: value
    }));
  };

  // Check if templates have required placeholders
  const emailHasPlaceholders = templates.inviteTemplateEmail.includes('{{campName}}') && 
                               templates.inviteTemplateEmail.includes('{{link}}');
  const smsHasPlaceholders = templates.inviteTemplateSMS.includes('{{campName}}') && 
                            templates.inviteTemplateSMS.includes('{{link}}');

  // Hide component if user is not camp lead or access was denied
  if (!isCampLead || accessDenied) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              Loading invite templates...
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Invite Template Editor
          </h2>
          <p className="text-gray-600 text-sm">
            Customize the messages sent when inviting new members to your camp.
          </p>
        </div>

        <div className="space-y-6">
          {/* Email Template */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-5 h-5 text-blue-600" />
              <label className="block text-sm font-medium text-gray-700">
                Email Template
              </label>
              {emailHasPlaceholders ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              )}
            </div>
            <textarea
              value={templates.inviteTemplateEmail}
              onChange={(e) => handleTemplateChange('inviteTemplateEmail', e.target.value)}
              rows={4}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                emailHasPlaceholders 
                  ? 'border-gray-300 focus:border-blue-500' 
                  : 'border-red-300 focus:border-red-500'
              }`}
              placeholder="Enter your email invitation template..."
            />
            <div className="mt-2 text-xs text-gray-500">
              Required placeholders: <code className="bg-gray-100 px-1 rounded">{'{{campName}}'}</code> and <code className="bg-gray-100 px-1 rounded">{'{{link}}'}</code>
            </div>
          </div>

          {/* SMS Template */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-green-600" />
              <label className="block text-sm font-medium text-gray-700">
                SMS Template
              </label>
              {smsHasPlaceholders ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              )}
            </div>
            <textarea
              value={templates.inviteTemplateSMS}
              onChange={(e) => handleTemplateChange('inviteTemplateSMS', e.target.value)}
              rows={3}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                smsHasPlaceholders 
                  ? 'border-gray-300 focus:border-blue-500' 
                  : 'border-red-300 focus:border-red-500'
              }`}
              placeholder="Enter your SMS invitation template..."
            />
            <div className="mt-2 text-xs text-gray-500">
              Keep SMS messages short. Required placeholders: <code className="bg-gray-100 px-1 rounded">{'{{campName}}'}</code> and <code className="bg-gray-100 px-1 rounded">{'{{link}}'}</code>
            </div>
          </div>

          {/* Preview Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Template Preview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email Preview */}
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Email Preview
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border text-sm">
                  {/* Note: This is just a preview - actual links generated by backend with CLIENT_URL */}
                  {templates.inviteTemplateEmail
                    .replace(/\{\{campName\}\}/g, user?.campName || '[Camp Name]')
                    .replace(/\{\{link\}\}/g, 
                      window.location.hostname === 'localhost'
                        ? 'http://localhost:3000/camps/[camp-slug]?invite=[token]'
                        : `${window.location.protocol}//${window.location.host}/camps/[camp-slug]?invite=[token]`
                    )}
                </div>
              </div>

              {/* SMS Preview */}
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  SMS Preview
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border text-sm">
                  {/* Note: This is just a preview - actual links generated by backend with CLIENT_URL */}
                  {templates.inviteTemplateSMS
                    .replace(/\{\{campName\}\}/g, user?.campName || '[Camp Name]')
                    .replace(/\{\{link\}\}/g,
                      window.location.hostname === 'localhost'
                        ? 'http://localhost:3000/camps/[camp-slug]?invite=[token]'
                        : `${window.location.protocol}//${window.location.host}/camps/[camp-slug]?invite=[token]`
                    )}
                </div>
              </div>
            </div>
          </div>

          {/* Warning */}
          {(!emailHasPlaceholders || !smsHasPlaceholders) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Missing Required Placeholders</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Both templates must include <code>{'{{campName}}'}</code> and <code>{'{{link}}'}</code> placeholders. 
                    These will be automatically replaced with your camp name and the application link.
                  </p>
                </div>
              </div>
            </div>
          )}

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

          {/* Save Button */}
          <div className="pt-4 border-t">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || !emailHasPlaceholders || !smsHasPlaceholders}
              className="flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Templates
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default InviteTemplateEditor;
