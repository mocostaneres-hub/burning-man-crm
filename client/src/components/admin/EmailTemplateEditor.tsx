import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Input } from '../ui';
import { Edit, Save, X, Mail, AlertTriangle } from 'lucide-react';
import apiService from '../../services/api';

interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
  file: string;
  function: string;
  lines: string;
}

const EmailTemplateEditor: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([
    {
      id: 'new-application',
      name: 'New Application Notification',
      description: 'Sent to camp admins when someone applies to their camp',
      subject: 'New Application to {{campName}} - G8Road CRM',
      htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">🏕️ G8Road CRM</h1>
    <p style="color: white; margin: 10px 0 0 0;">New Camp Application</p>
  </div>
  
  <div style="padding: 20px; background: #f9f9f9;">
    <h2 style="color: #333; margin-top: 0;">New Application Received!</h2>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="color: #FF6B35; margin-top: 0;">Camp: {{campName}}</h3>
      
      <div style="margin-bottom: 15px;">
        <strong>Applicant:</strong> {{applicantFirstName}} {{applicantLastName}}<br>
        <strong>Email:</strong> {{applicantEmail}}<br>
        <strong>Applied:</strong> {{appliedDate}}
      </div>
      
      <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h4 style="margin-top: 0; color: #333;">Application Details:</h4>
        <p><strong>Motivation:</strong></p>
        <p style="margin-left: 20px; font-style: italic;">"{{motivation}}"</p>
      </div>
    </div>
    
    <div style="text-align: center;">
      <a href="{{reviewLink}}" 
         style="background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Review Application
      </a>
    </div>
  </div>
</div>`,
      textContent: 'New application to {{campName}} from {{applicantFirstName}} {{applicantLastName}}',
      variables: ['campName', 'applicantFirstName', 'applicantLastName', 'applicantEmail', 'appliedDate', 'motivation', 'reviewLink'],
      file: 'server/services/notifications.js',
      function: 'sendEmailNotification()',
      lines: '47-109'
    },
    {
      id: 'application-approved',
      name: 'Application Approval Email',
      description: 'Sent to applicants when their application is approved',
      subject: '🎉 Welcome to {{campName}}! - G8Road CRM',
      htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #4CAF50, #45a049); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">🎉 Congratulations!</h1>
    <p style="color: white; margin: 10px 0 0 0;">You've been accepted!</p>
  </div>
  
  <div style="padding: 20px; background: #f9f9f9;">
    <h2 style="color: #333; margin-top: 0;">Welcome to {{campName}}!</h2>
    
    <p>Dear {{firstName}},</p>
    
    <p>Great news! Your application to join <strong>{{campName}}</strong> has been approved! 
    We're excited to have you as part of our camp community.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #4CAF50; margin-top: 0;">Next Steps:</h3>
      <ul>
        <li>Check your camp dashboard for important updates</li>
        <li>Review camp guidelines and expectations</li>
        <li>Connect with fellow camp members</li>
        <li>Prepare for an amazing G8Road experience!</li>
      </ul>
    </div>
    
    <div style="text-align: center;">
      <a href="{{dashboardLink}}" 
         style="background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Go to Dashboard
      </a>
    </div>
  </div>
</div>`,
      textContent: 'Congratulations! Your application to {{campName}} has been approved.',
      variables: ['campName', 'firstName', 'dashboardLink'],
      file: 'server/services/notifications.js',
      function: 'sendApprovalNotification()',
      lines: '150-197'
    },
    {
      id: 'application-rejected',
      name: 'Application Rejection Email',
      description: 'Sent to applicants when their application is not accepted',
      subject: 'Application Update - {{campName}} - G8Road CRM',
      htmlContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #FF6B35, #F7931E); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">🏕️ G8Road CRM</h1>
    <p style="color: white; margin: 10px 0 0 0;">Application Update</p>
  </div>
  
  <div style="padding: 20px; background: #f9f9f9;">
    <h2 style="color: #333; margin-top: 0;">Application Status Update</h2>
    
    <p>Dear {{firstName}},</p>
    
    <p>Thank you for your interest in joining <strong>{{campName}}</strong>. 
    After careful consideration, we have decided not to move forward with your application at this time.</p>
    
    <p>This decision was not easy, as we received many qualified applications. 
    We encourage you to continue exploring other amazing camps in our community.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{exploreCampsLink}}" 
         style="background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
        Explore Other Camps
      </a>
    </div>
    
    <p>Thank you again for your interest, and we wish you the best in finding your perfect camp!</p>
    
    <p>Best regards,<br>
    The {{campName}} Team</p>
  </div>
</div>`,
      textContent: 'Thank you for your application to {{campName}}. After careful consideration, we have decided not to move forward at this time.',
      variables: ['campName', 'firstName', 'exploreCampsLink'],
      file: 'server/services/notifications.js',
      function: 'sendRejectionNotification()',
      lines: '202-247'
    }
  ]);

  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [editedTemplate, setEditedTemplate] = useState<EmailTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setEditedTemplate({ ...template });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!editedTemplate) return;

    setSaving(true);
    try {
      // TODO: Implement API call to save template
      // For now, we'll just update locally
      console.log('Saving template:', editedTemplate);
      
      setTemplates(templates.map(t => 
        t.id === editedTemplate.id ? editedTemplate : t
      ));

      alert('Template saved successfully! Note: To apply changes to production, you need to update the file manually or deploy the changes.');
      setShowEditor(false);
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderPreview = () => {
    if (!editedTemplate) return null;

    // Replace variables with sample data
    let preview = editedTemplate.htmlContent;
    editedTemplate.variables.forEach(variable => {
      const sampleData: Record<string, string> = {
        campName: 'Camp Example',
        applicantFirstName: 'John',
        applicantLastName: 'Doe',
        firstName: 'John',
        applicantEmail: 'john@example.com',
        appliedDate: new Date().toLocaleDateString(),
        motivation: 'Sample motivation text...',
        reviewLink: 'https://g8road.com/applications/123',
        dashboardLink: 'https://g8road.com/dashboard',
        exploreCampsLink: 'https://g8road.com/camps'
      };
      preview = preview.replace(new RegExp(`{{${variable}}}`, 'g'), sampleData[variable] || `{{${variable}}}`);
    });

    return preview;
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-lato-bold mb-2">Email Template Editor</h2>
            <p className="text-custom-text-secondary">
              Edit email templates with a visual editor. Changes are saved locally and need to be deployed to take effect.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Note:</p>
                <p>Changes require code deployment to take effect in production.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <Card key={template.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <Mail className="w-8 h-8 text-custom-primary" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(template)}
                  className="flex items-center gap-1"
                >
                  <Edit className="w-3 h-3" />
                  Edit
                </Button>
              </div>
              <h3 className="font-semibold text-lg mb-2">{template.name}</h3>
              <p className="text-sm text-custom-text-secondary mb-3">{template.description}</p>
              <div className="text-xs text-custom-text-secondary space-y-1">
                <p><strong>File:</strong> {template.file}</p>
                <p><strong>Function:</strong> {template.function}</p>
                <p><strong>Lines:</strong> {template.lines}</p>
              </div>
            </Card>
          ))}
        </div>
      </Card>

      {/* Email Editor Modal */}
      {showEditor && editedTemplate && (
        <Modal isOpen={showEditor} onClose={() => setShowEditor(false)} size="xl">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-lato-bold">Edit Email Template</h2>
              <Button
                variant="outline"
                onClick={() => setShowEditor(false)}
                className="flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Close
              </Button>
            </div>

            <div className="space-y-6">
              {/* Template Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">{editedTemplate.name}</h3>
                <p className="text-sm text-custom-text-secondary">{editedTemplate.description}</p>
              </div>

              {/* Subject Line */}
              <div>
                <label className="block text-sm font-medium text-custom-text mb-2">
                  Email Subject
                </label>
                <Input
                  value={editedTemplate.subject}
                  onChange={(e) => setEditedTemplate({ ...editedTemplate, subject: e.target.value })}
                  placeholder="Email subject line"
                  className="w-full"
                />
              </div>

              {/* HTML Content */}
              <div>
                <label className="block text-sm font-medium text-custom-text mb-2">
                  HTML Content
                </label>
                <textarea
                  value={editedTemplate.htmlContent}
                  onChange={(e) => setEditedTemplate({ ...editedTemplate, htmlContent: e.target.value })}
                  rows={15}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent font-mono text-sm"
                  placeholder="HTML email content"
                />
              </div>

              {/* Plain Text Content */}
              <div>
                <label className="block text-sm font-medium text-custom-text mb-2">
                  Plain Text Content (Fallback)
                </label>
                <textarea
                  value={editedTemplate.textContent}
                  onChange={(e) => setEditedTemplate({ ...editedTemplate, textContent: e.target.value })}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                  placeholder="Plain text version"
                />
              </div>

              {/* Available Variables */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Available Variables:</h4>
                <div className="flex flex-wrap gap-2">
                  {editedTemplate.variables.map((variable) => (
                    <code key={variable} className="bg-white px-3 py-1 rounded text-sm">
                      {`{{${variable}}}`}
                    </code>
                  ))}
                </div>
                <p className="text-xs text-custom-text-secondary mt-2">
                  Use these variables in your template. They will be replaced with actual data when the email is sent.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? 'Hide' : 'Show'} Preview
                </Button>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowEditor(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>

              {/* Preview */}
              {showPreview && (
                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4">Email Preview (with sample data):</h3>
                  <div className="border rounded-lg p-4 bg-white">
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-600">Subject:</p>
                      <p className="text-lg">{editedTemplate.subject.replace(/{{(\w+)}}/g, 'Camp Example')}</p>
                    </div>
                    <div 
                      className="border-t pt-4"
                      dangerouslySetInnerHTML={{ __html: renderPreview() || '' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EmailTemplateEditor;

