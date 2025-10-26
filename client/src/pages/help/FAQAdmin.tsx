import React, { useState, useEffect } from 'react';
import { Button, Card, Modal, Input, Badge } from '../../components/ui';
import { Plus, Edit, Trash2, Save as SaveIcon, X, Loader2, HelpCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

interface FAQ {
  _id?: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
  audience: 'camps' | 'members' | 'both';
  createdBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  updatedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

const FAQAdmin: React.FC = () => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    'General',
    'Account Management',
    'Camp Management',
    'Applications',
    'Tasks',
    'Members',
    'Technical Support',
    'Billing'
  ];

  const audiences = [
    { value: 'both', label: 'Both Camps & Members' },
    { value: 'camps', label: 'Camps Only' },
    { value: 'members', label: 'Members Only' }
  ];

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/admin/faqs');
      setFaqs(response.faqs || []);
    } catch (err) {
      console.error('Error loading FAQs:', err);
      setError('Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFAQ = async () => {
    if (!editingFAQ?.question.trim() || !editingFAQ?.answer.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      setError('');

      if (editingFAQ._id) {
        // Update existing FAQ
        const response = await apiService.put(`/admin/faqs/${editingFAQ._id}`, editingFAQ);
        setFaqs(faqs.map(faq => faq._id === editingFAQ._id ? response.faq : faq));
      } else {
        // Create new FAQ
        const response = await apiService.post('/admin/faqs', editingFAQ);
        setFaqs([...faqs, response.faq]);
      }

      setEditingFAQ(null);
      setShowModal(false);
    } catch (err) {
      console.error('Error saving FAQ:', err);
      setError('Failed to save FAQ');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFAQ = async (faqId: string) => {
    if (!window.confirm('Are you sure you want to delete this FAQ?')) {
      return;
    }

    try {
      await apiService.delete(`/admin/faqs/${faqId}`);
      setFaqs(faqs.filter(faq => faq._id !== faqId));
    } catch (err) {
      console.error('Error deleting FAQ:', err);
      setError('Failed to delete FAQ');
    }
  };

  const handleEditFAQ = (faq: FAQ) => {
    setEditingFAQ({ ...faq });
    setShowModal(true);
  };

  const handleCreateFAQ = () => {
    setEditingFAQ({
      question: '',
      answer: '',
      category: categories[0],
      order: faqs.length + 1,
      isActive: true,
      audience: 'both'
    });
    setShowModal(true);
  };

  const updateEditingFAQ = (field: keyof FAQ, value: any) => {
    setEditingFAQ(prev => prev ? { ...prev, [field]: value } : null);
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
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-h1 font-lato-bold text-custom-text mb-2">
          FAQ Management
          </h1>
          <p className="text-body text-custom-text-secondary">
            Manage frequently asked questions and answers
          </p>
        </div>
        <Button
          variant="primary"
          onClick={handleCreateFAQ}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add FAQ
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
          <button
            onClick={() => setError('')}
            className="absolute top-0 right-0 p-2 text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* FAQs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {faqs.map((faq) => (
          <Card key={faq._id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-h3 font-lato-bold text-custom-text mb-2 line-clamp-2">
                          {faq.question}
                </h3>
                <div className="flex gap-2 mb-3">
                  <Badge variant={faq.isActive ? 'success' : 'error'}>
                    {faq.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="neutral">
                    {faq.category}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-1 ml-2">
                <Button
                  variant="outline"
                  size="sm"
                          onClick={() => handleEditFAQ(faq)}
                  className="p-2"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                          onClick={() => handleDeleteFAQ(faq._id!)}
                  className="p-2 text-red-600 border-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <p className="text-body text-custom-text-secondary line-clamp-3 mb-4">
              {faq.answer}
            </p>

            <div className="flex items-center justify-between text-sm text-custom-text-secondary">
              <span>Order: {faq.order}</span>
              <span>Audience: {faq.audience}</span>
            </div>
            </Card>
          ))}
      </div>

      {faqs.length === 0 && (
        <div className="text-center py-16">
          <HelpCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-h2 font-lato-bold text-custom-text-secondary mb-2">
            No FAQs Found
          </h2>
          <p className="text-body text-custom-text-secondary mb-6">
            Get started by creating your first FAQ.
          </p>
          <Button
            variant="primary"
            onClick={handleCreateFAQ}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create First FAQ
          </Button>
        </div>
      )}

      {/* FAQ Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingFAQ(null);
          setError('');
        }}
        title={editingFAQ?._id ? 'Edit FAQ' : 'Create New FAQ'}
      >
        {editingFAQ && (
          <div className="space-y-4">
            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Question *
              </label>
              <Input
                value={editingFAQ.question}
                onChange={(e) => updateEditingFAQ('question', e.target.value)}
                placeholder="Enter the question"
              />
            </div>

            <div>
              <label className="block text-label font-medium text-custom-text mb-2">
                Answer *
              </label>
              <textarea
                value={editingFAQ.answer}
                onChange={(e) => updateEditingFAQ('answer', e.target.value)}
                placeholder="Enter the answer"
                rows={6}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-label font-medium text-custom-text mb-2">
                  Category
                </label>
                <select
                  value={editingFAQ.category}
                  onChange={(e) => updateEditingFAQ('category', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                  >
                    {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-label font-medium text-custom-text mb-2">
                  Audience
                </label>
                <select
                  value={editingFAQ.audience}
                  onChange={(e) => updateEditingFAQ('audience', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                >
                  {audiences.map((audience) => (
                    <option key={audience.value} value={audience.value}>
                      {audience.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-label font-medium text-custom-text mb-2">
                  Order
                </label>
                <Input
                  type="number"
                  value={editingFAQ.order}
                  onChange={(e) => updateEditingFAQ('order', parseInt(e.target.value))}
                  placeholder="Display order"
                />
              </div>

              <div className="flex items-center justify-center">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingFAQ.isActive}
                    onChange={(e) => updateEditingFAQ('isActive', e.target.checked)}
                    className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                  />
                  <span className="text-sm text-custom-text">Active</span>
                </label>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded relative" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setEditingFAQ(null);
                  setError('');
                }}
                className="flex-1"
              >
            Cancel
          </Button>
          <Button
                variant="primary"
            onClick={handleSaveFAQ}
                disabled={saving || !editingFAQ.question.trim() || !editingFAQ.answer.trim()}
                className="flex-1 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <SaveIcon className="w-4 h-4" />
                    {editingFAQ._id ? 'Update FAQ' : 'Create FAQ'}
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

export default FAQAdmin;