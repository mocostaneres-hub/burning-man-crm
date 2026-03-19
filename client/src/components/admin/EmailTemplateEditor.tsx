import React, { useEffect, useRef, useState } from 'react';
import { Card, Button, Modal, Input } from '../ui';
import { Edit, Save, X, Mail, AlertTriangle } from 'lucide-react';
import apiService from '../../services/api';

interface EmailTemplate {
  _id: string;
  key: string;
  name: string;
  description: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
  isActive: boolean;
}

const SAMPLE_DATA: Record<string, string> = {
  camp_name: 'Solar Haven',
  user_name: 'Alex',
  invite_link: 'https://www.g8road.com/apply?invite_token=abc123',
  time_since_signup: '7 days'
};

const EmailTemplateEditor: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editedTemplate, setEditedTemplate] = useState<EmailTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; htmlContent: string } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await apiService.getEmailTemplates();
      setTemplates(response.templates || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      alert('Failed to load email templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleEdit = (template: EmailTemplate) => {
    setEditedTemplate({ ...template });
    setShowEditor(true);
    setShowPreview(false);
    setPreview(null);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = template.htmlContent || '';
      }
    }, 0);
  };

  const applyFormat = (command: string) => {
    document.execCommand(command, false);
    if (editorRef.current && editedTemplate) {
      setEditedTemplate({ ...editedTemplate, htmlContent: editorRef.current.innerHTML });
    }
  };

  const insertLink = () => {
    const url = window.prompt('Enter URL', 'https://');
    if (!url) return;
    document.execCommand('createLink', false, url);
    if (editorRef.current && editedTemplate) {
      setEditedTemplate({ ...editedTemplate, htmlContent: editorRef.current.innerHTML });
    }
  };

  const insertButtonSnippet = () => {
    const html =
      '<a href="{{invite_link}}" style="background:#FF6B35;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:bold;">Complete Now</a>';
    document.execCommand('insertHTML', false, html);
    if (editorRef.current && editedTemplate) {
      setEditedTemplate({ ...editedTemplate, htmlContent: editorRef.current.innerHTML });
    }
  };

  const handleSave = async () => {
    if (!editedTemplate) return;
    setSaving(true);
    try {
      const htmlContent = editorRef.current ? editorRef.current.innerHTML : editedTemplate.htmlContent;
      await apiService.updateEmailTemplate(editedTemplate.key, {
        subject: editedTemplate.subject,
        htmlContent,
        textContent: editedTemplate.textContent,
        variables: editedTemplate.variables,
        isActive: editedTemplate.isActive
      });
      await loadTemplates();
      setShowEditor(false);
      alert('Template saved to database.');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!editedTemplate) return;
    try {
      const htmlContent = editorRef.current ? editorRef.current.innerHTML : editedTemplate.htmlContent;
      const result = await apiService.previewEmailTemplate(editedTemplate.key, SAMPLE_DATA);
      setPreview({
        subject: result.subject || editedTemplate.subject,
        htmlContent: result.htmlContent || htmlContent
      });
      setShowPreview(true);
    } catch (error) {
      console.error('Preview error:', error);
      alert('Failed to render preview.');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-lato-bold mb-2">Email Template Editor</h2>
            <p className="text-custom-text-secondary">
              Manage reminder templates in database. Supports rich text editing, HTML preview, and variable placeholders.
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium">Reminder Templates</p>
              <p>Camp + Member onboarding reminders are editable and rendered at send time.</p>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-custom-text-secondary">Loading templates...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {templates.map((template) => (
              <Card key={template._id} className="p-4 hover:shadow-lg transition-shadow">
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
                <h3 className="font-semibold text-lg mb-1">{template.name}</h3>
                <p className="text-xs text-custom-text-secondary mb-2">{template.key}</p>
                <p className="text-sm text-custom-text-secondary">{template.description}</p>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {showEditor && editedTemplate && (
        <Modal isOpen={showEditor} onClose={() => setShowEditor(false)} size="xl">
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-lato-bold">Edit Template: {editedTemplate.name}</h2>
              <Button variant="outline" onClick={() => setShowEditor(false)}>
                <X className="w-4 h-4 mr-1" />
                Close
              </Button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Subject</label>
              <Input
                value={editedTemplate.subject}
                onChange={(e) => setEditedTemplate({ ...editedTemplate, subject: e.target.value })}
              />
            </div>

            <div className="border rounded-lg">
              <div className="border-b p-2 flex items-center gap-2 bg-gray-50">
                <Button variant="outline" size="sm" onClick={() => applyFormat('bold')}>
                  Bold
                </Button>
                <Button variant="outline" size="sm" onClick={insertLink}>
                  Link
                </Button>
                <Button variant="outline" size="sm" onClick={insertButtonSnippet}>
                  Insert CTA Button
                </Button>
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => {
                  if (!editedTemplate || !editorRef.current) return;
                  setEditedTemplate({ ...editedTemplate, htmlContent: editorRef.current.innerHTML });
                }}
                className="min-h-[260px] p-3 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Plain Text Fallback</label>
              <textarea
                value={editedTemplate.textContent}
                onChange={(e) => setEditedTemplate({ ...editedTemplate, textContent: e.target.value })}
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="font-medium text-sm mb-2">Variables</p>
              <div className="flex flex-wrap gap-2">
                {editedTemplate.variables.map((variable) => (
                  <code key={variable} className="bg-white px-2 py-1 rounded text-xs">
                    {`{{${variable}}}`}
                  </code>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handlePreview}>
                Preview HTML
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowEditor(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>

            {showPreview && preview && (
              <div className="border rounded-lg p-4">
                <p className="text-sm font-semibold mb-2">Subject: {preview.subject}</p>
                <div dangerouslySetInnerHTML={{ __html: preview.htmlContent }} />
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EmailTemplateEditor;

