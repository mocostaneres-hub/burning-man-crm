import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Card, Input, Modal } from '../components/ui';
import Footer from '../components/layout/Footer';
import { Send, MessageCircle as MessageCircleIcon, HelpCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { renderRichTextToHtml } from '../utils/richText';

interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
  audience?: 'camps' | 'members' | 'both' | 'homepage';
}

type RequesterType = 'camp' | 'member' | 'other';
type FAQAudienceTarget = 'camps' | 'members' | 'all' | 'both';

const Help: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [showContactModal, setShowContactModal] = useState(false);
  const [showContactSuccessModal, setShowContactSuccessModal] = useState(false);
  const [contactForm, setContactForm] = useState({
    requesterType: 'other' as RequesterType,
    requesterEmail: '',
    requesterPhone: '',
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Determine the target audience based on URL
  const getTargetAudience = useCallback((): FAQAudienceTarget => {
    if (location.pathname === '/camp/help') return 'camps';
    if (location.pathname === '/member/help') return 'members';
    if (user?.accountType === 'admin' || user?.isSystemAdmin) return 'all';
    return 'both'; // Default for non-authenticated users on /help
  }, [location.pathname, user?.accountType, user?.isSystemAdmin]);

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

  const loadFAQs = useCallback(async () => {
    try {
      const targetAudience = getTargetAudience();
      const response = await apiService.get('/help/faqs', {
        params: { audience: targetAudience }
      });
      setFaqs(response.faqs || []);
    } catch (err) {
      console.error('Error loading FAQs:', err);
    }
  }, [getTargetAudience]);

  useEffect(() => {
    const loadHelpData = async () => {
      try {
        setLoading(true);
        await loadFAQs();
      } catch (err) {
        console.error('Error loading help data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHelpData();
  }, [loadFAQs]);

  const categories = useMemo(() => {
    const values = Array.from(new Set(faqs.map((faq) => faq.category).filter(Boolean)));
    return ['All', ...values];
  }, [faqs]);

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory('All');
    }
  }, [categories, activeCategory]);

  const filteredFaqs = useMemo(() => {
    if (activeCategory === 'All') return faqs;
    return faqs.filter((faq) => faq.category === activeCategory);
  }, [faqs, activeCategory]);

  const faqsByCategory = useMemo(() => {
    return filteredFaqs.reduce<Record<string, FAQ[]>>((acc, faq) => {
      if (!acc[faq.category]) acc[faq.category] = [];
      acc[faq.category].push(faq);
      return acc;
    }, {});
  }, [filteredFaqs]);

  const sortedCategoryKeys = useMemo(() => {
    return Object.keys(faqsByCategory).sort((a, b) => a.localeCompare(b));
  }, [faqsByCategory]);

  const handleContactSubmit = async () => {
    try {
      setSubmitting(true);
      await apiService.post('/help/contact', contactForm);
      setContactForm({
        requesterType: user?.accountType === 'camp' ? 'camp' : user?.accountType === 'personal' ? 'member' : 'other',
        requesterEmail: user?.email || '',
        requesterPhone: '',
        subject: '',
        message: ''
      });
      setShowContactModal(false);
      setShowContactSuccessModal(true);
    } catch (err) {
      console.error('Error submitting contact form:', err);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    setContactForm(prev => ({
      ...prev,
      requesterType: user?.accountType === 'camp' ? 'camp' : user?.accountType === 'personal' ? 'member' : prev.requesterType,
      requesterEmail: user?.email || prev.requesterEmail
    }));
  }, [user]);

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3">
          <Card className="p-4 sticky top-24">
            <p className="text-xs uppercase tracking-wide text-custom-text-secondary mb-3">Categories</p>
            <div className="space-y-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition ${
                    activeCategory === category
                      ? 'bg-green-100 text-green-800 font-semibold'
                      : 'bg-white text-custom-text border border-gray-200 hover:border-green-200 hover:bg-green-50'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </Card>
        </aside>

        <section className="lg:col-span-6 space-y-6">
          <div className="text-center">
            <div className="w-12 h-12 text-custom-primary mx-auto mb-4">
              <HelpCircle className="w-full h-full" />
            </div>
            <h2 className="text-h2 font-lato-bold text-custom-text mb-2">Frequently Asked Questions</h2>
            <p className="text-body text-custom-text-secondary">
              Answers are fully visible so you can scan quickly without expanding cards.
            </p>
          </div>

          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 text-gray-400 mx-auto mb-4">
                <HelpCircle className="w-full h-full" />
              </div>
              <h3 className="text-h3 font-lato-bold text-custom-text-secondary mb-2">No FAQs Available</h3>
              <p className="text-body text-custom-text-secondary">
                Check back later for frequently asked questions and answers.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {sortedCategoryKeys.map((category) => (
                <div key={category}>
                  <div className="mb-3">
                    <span className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      {category}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {(faqsByCategory[category] || []).map((faq) => (
                      <Card key={faq._id} className="border border-gray-200">
                        <p className="text-h3 font-lato-bold text-custom-text mb-2">{faq.question}</p>
                        <div
                          className="text-body text-custom-text-secondary leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: renderRichTextToHtml(faq.answer) }}
                        />
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="lg:col-span-3 space-y-4">
          <Card className="p-4 sticky top-24">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircleIcon className="w-4 h-4 text-custom-primary" />
            </div>
            <p className="text-sm text-custom-text-secondary mb-4">
              {user ? 'Need help with something specific? Send us a message.' : 'Need to contact the G8Road Team?'}
            </p>
            <Button
              variant="primary"
              onClick={() => {
                setContactForm((prev) => ({
                  ...prev,
                  requesterType: user?.accountType === 'camp' ? 'camp' : user?.accountType === 'personal' ? 'member' : prev.requesterType,
                  requesterEmail: user?.email || prev.requesterEmail
                }));
                setShowContactModal(true);
              }}
              className="w-full"
            >
              Contact Support
            </Button>
          </Card>
        </aside>
      </div>

      {/* Contact Support Modal */}
      <Modal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        title="Contact Support"
      >
        <div className="space-y-4">
          <p className="text-sm text-custom-text-secondary">
            Tell us what you need and we will email back as soon as possible.
          </p>

          <div>
            <label className="block text-label font-medium text-custom-text mb-2">I am a</label>
            <select
              value={contactForm.requesterType}
              onChange={(e) => setContactForm({ ...contactForm, requesterType: e.target.value as RequesterType })}
              className="w-full bg-white p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
            >
              <option value="camp">Camp</option>
              <option value="member">Member</option>
              <option value="other">Other</option>
            </select>
          </div>

          <Input
            type="email"
            label="Email Address"
            value={contactForm.requesterEmail}
            onChange={(e) => setContactForm({ ...contactForm, requesterEmail: e.target.value })}
            placeholder="you@example.com"
            className="bg-white"
          />

          <Input
            type="tel"
            label="Phone Number (Optional)"
            value={contactForm.requesterPhone}
            onChange={(e) => setContactForm({ ...contactForm, requesterPhone: e.target.value })}
            placeholder="+1 (555) 123-4567"
            className="bg-white"
          />

          <Input
            type="text"
            label="Subject"
            value={contactForm.subject}
            onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
            placeholder="What can we help you with?"
            className="bg-white"
          />

          <div>
            <label className="block text-label font-medium text-custom-text mb-2">Message</label>
            <textarea
              value={contactForm.message}
              onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
              placeholder="Please describe your question or issue in detail..."
              rows={5}
              className="w-full bg-white p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent resize-none"
            />
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
              disabled={
                submitting ||
                !contactForm.requesterType ||
                !contactForm.requesterEmail.trim() ||
                !contactForm.subject.trim() ||
                !contactForm.message.trim()
              }
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

      <Modal
        isOpen={showContactSuccessModal}
        onClose={() => setShowContactSuccessModal(false)}
        title="Support Request Sent"
      >
        <div className="space-y-4">
          <p className="text-body text-custom-text-secondary">
            Your support request was sent successfully. We will follow up by email.
          </p>
          <div className="pt-2">
            <Button
              variant="primary"
              onClick={() => setShowContactSuccessModal(false)}
              className="w-full"
            >
              OK
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Help;