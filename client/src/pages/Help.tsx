import React, { useState, useEffect } from 'react';
import { Button, Card, Input, Modal } from '../components/ui';
import Footer from '../components/layout/Footer';
import { Send, MessageCircle as MessageCircleIcon, HelpCircle, ChevronDown, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import apiService from '../services/api';

interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
  audience?: 'camps' | 'members' | 'both';
}

interface SupportMessage {
  _id: string;
  subject: string;
  message: string;
  status: 'open' | 'in-progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

const Help: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Determine the target audience based on URL
  const getTargetAudience = () => {
    if (location.pathname === '/camp/help') return 'camps';
    if (location.pathname === '/member/help') return 'members';
    if (user?.accountType === 'admin') return 'all';
    return 'both'; // Default for non-authenticated users on /help
  };

  // Redirect authenticated users from /help to their appropriate help page
  useEffect(() => {
    if (location.pathname === '/help' && user) {
      if (user.accountType === 'camp') {
        navigate('/camp/help', { replace: true });
      } else if (user.accountType === 'personal') {
        navigate('/member/help', { replace: true });
      }
      // Admin users stay on /help to see all FAQs
    }
  }, [location.pathname, user, navigate]);

  useEffect(() => {
    loadHelpData();
  }, [location.pathname, user?.accountType]);

  const loadHelpData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadFAQs(),
        loadSupportMessages()
      ]);
    } catch (err) {
      console.error('Error loading help data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFAQs = async () => {
    try {
      const response = await apiService.get('/help/faqs');
      const allFaqs = response.faqs || [];
      
      // Filter FAQs based on target audience
      const targetAudience = getTargetAudience();
      let filteredFaqs = allFaqs;
      
      if (targetAudience === 'camps') {
        filteredFaqs = allFaqs.filter(faq => faq.audience === 'camps' || faq.audience === 'both');
      } else if (targetAudience === 'members') {
        filteredFaqs = allFaqs.filter(faq => faq.audience === 'members' || faq.audience === 'both');
      } else if (targetAudience === 'both') {
        filteredFaqs = allFaqs.filter(faq => faq.audience === 'both');
      }
      // For 'all' (admin), show all FAQs
      
      setFaqs(filteredFaqs);
    } catch (err) {
      console.error('Error loading FAQs:', err);
    }
  };

  const loadSupportMessages = async () => {
    try {
      const response = await apiService.get('/help/support-messages');
      setSupportMessages(response);
    } catch (err) {
      console.error('Error loading support messages:', err);
    }
  };

  const handleContactSubmit = async () => {
    try {
      setSubmitting(true);
      await apiService.post('/help/contact', contactForm);
      setContactForm({ subject: '', message: '' });
      setShowContactModal(false);
      // Show success message
    } catch (err) {
      console.error('Error submitting contact form:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 animate-spin text-custom-primary">
            <Loader2 className="w-full h-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-h1 font-lato-bold text-custom-text mb-4">
          Help & Support
        </h1>
        <p className="text-body text-custom-text-secondary">
          {(() => {
            const targetAudience = getTargetAudience();
            if (targetAudience === 'camps') {
              return 'Find answers to common questions about managing your camp or contact our support team';
            } else if (targetAudience === 'members') {
              return 'Find answers to common questions about finding camps and your G8Road experience or contact our support team';
            } else {
              return 'Find answers to common questions or contact our support team';
            }
          })()}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {['FAQs', 'Contact Support'].map((tab, index) => (
              <button
                key={tab}
                onClick={() => setActiveTab(index)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === index
                    ? 'border-custom-primary text-custom-primary'
                    : 'border-transparent text-custom-text-secondary hover:text-custom-text hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* FAQs Tab */}
      {activeTab === 0 && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 text-custom-primary mx-auto mb-4">
              <HelpCircle className="w-full h-full" />
            </div>
            <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-body text-custom-text-secondary">
              {(() => {
                const targetAudience = getTargetAudience();
                if (targetAudience === 'camps') {
                  return 'Find quick answers to common questions about managing your camp';
                } else if (targetAudience === 'members') {
                  return 'Find quick answers to common questions about finding camps and your G8Road experience';
                } else {
                  return 'Find quick answers to common questions about using the G8Road CRM';
                }
              })()}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {faqs.map((faq) => (
              <FAQCard key={faq._id} faq={faq} />
            ))}
          </div>

          {faqs.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 text-gray-400 mx-auto mb-4">
                <HelpCircle className="w-full h-full" />
              </div>
              <h3 className="text-h3 font-lato-bold text-custom-text-secondary mb-2">
                No FAQs Available
              </h3>
              <p className="text-body text-custom-text-secondary">
                Check back later for frequently asked questions and answers.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Contact Support Tab */}
      {activeTab === 1 && (
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-12 h-12 text-custom-primary mx-auto mb-4">
              <MessageCircleIcon className="w-full h-full" />
            </div>
            <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
              Contact Support
            </h2>
            <p className="text-body text-custom-text-secondary">
              Can't find what you're looking for? Send us a message and we'll get back to you as soon as possible.
            </p>
          </div>

          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-label font-medium text-custom-text mb-2">
                  Subject
                </label>
                <Input
                    value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                  placeholder="What can we help you with?"
                />
              </div>

              <div>
                <label className="block text-label font-medium text-custom-text mb-2">
                  Message
                </label>
                <textarea
                    value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder="Please describe your question or issue in detail..."
                  rows={6}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent resize-none"
                />
              </div>

                  <Button
                variant="primary"
                onClick={() => setShowContactModal(true)}
                disabled={!contactForm.subject.trim() || !contactForm.message.trim()}
                className="w-full flex items-center justify-center gap-2"
              >
                <div className="w-4 h-4">
                  <Send className="w-full h-full" />
                </div>
                Send Message
                  </Button>
            </div>
          </Card>

          {/* Support Messages History */}
          {supportMessages.length > 0 && (
            <div className="mt-8">
              <h3 className="text-h3 font-lato-bold text-custom-text mb-4">
                Your Support Messages
              </h3>
              <div className="space-y-4">
                {supportMessages.map((message) => (
                  <Card key={message._id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-body font-medium text-custom-text">
                          {message.subject}
                        </h4>
                        <p className="text-sm text-custom-text-secondary mt-1">
                          {message.message.substring(0, 100)}...
                        </p>
                        <p className="text-xs text-custom-text-secondary mt-2">
                          {new Date(message.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        message.status === 'resolved' 
                          ? 'bg-green-100 text-green-800'
                          : message.status === 'in-progress'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {message.status}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contact Confirmation Modal */}
      <Modal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        title="Confirm Support Request"
      >
        <div className="space-y-4">
          <p className="text-body text-custom-text-secondary">
            Are you sure you want to send this support request? Our team will respond within 24 hours.
          </p>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-custom-text mb-1">Subject:</p>
            <p className="text-sm text-custom-text-secondary">{contactForm.subject}</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-custom-text mb-1">Message:</p>
            <p className="text-sm text-custom-text-secondary">{contactForm.message}</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowContactModal(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleContactSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 animate-spin">
                    <Loader2 className="w-full h-full" />
                  </div>
                  Sending...
                </>
              ) : (
                <>
                  <div className="w-4 h-4">
                  <Send className="w-full h-full" />
                </div>
                  Send Request
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Footer */}
      <Footer />
    </div>
  );
};

// FAQ Card Component
const FAQCard: React.FC<{ faq: FAQ }> = ({ faq }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-h3 font-lato-bold text-custom-text mb-2">
            {faq.question}
          </h3>
          <p className="text-sm text-custom-text-secondary mb-2">
            {faq.category}
          </p>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-4 p-2 text-custom-text-secondary hover:text-custom-text transition-colors"
        >
          <div className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown className="w-full h-full" />
          </div>
        </button>
      </div>
      
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-body text-custom-text-secondary">
            {faq.answer}
          </p>
        </div>
      )}
    </Card>
  );
};

export default Help;