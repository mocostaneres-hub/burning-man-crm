import React, { useState, useEffect } from 'react';
import { ChevronDown, HelpCircle, MessageCircle as MessageCircleIcon, Send, Loader2 } from 'lucide-react';
import { Button, Input, Modal } from './ui';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { renderRichTextToHtml } from '../utils/richText';

interface FAQItem {
  _id?: string;
  question: string;
  answer: string;
  category?: string;
  order?: number;
}

type RequesterType = 'camp' | 'member' | 'other';

// Curated FAQs for non-authenticated homepage visitors. These are used when
// the admin-managed homepage FAQ data is missing or sparse.
const generalFAQData: FAQItem[] = [
  {
    question: "What is G8Road?",
    answer: "G8Road is a camp operations platform for Burner camps and the people who join them. Camp leads can manage applications, rosters, communications, tasks, volunteer shifts, surveys, and camp logistics in one place.",
    category: "General",
    order: 1
  },
  {
    question: "What is a Camp account?",
    answer: "A Camp account is for the person or team managing a camp. It gives you camp-level tools to create a public camp profile, accept or review applications, maintain your roster, assign tasks, coordinate shifts, and keep member information organized.",
    category: "Account Management",
    order: 2
  },
  {
    question: "How do I get started as a camp lead?",
    answer: "Create an account, choose the camp role during onboarding, and complete your camp profile. From there you can publish your profile, invite members, review applications, and start building the roster and planning tools your camp needs.",
    category: "Camp Management",
    order: 3
  },
  {
    question: "What can I manage from a Camp account?",
    answer: "Camp accounts can manage member rosters, applications, dues status, arrivals and departures, tickets, vehicle passes, tasks, surveys, events, volunteer shifts, and camp communications. The goal is to replace scattered spreadsheets with one roster-first workflow.",
    category: "Camp Management",
    order: 4
  },
  {
    question: "Can members apply to join my camp through G8Road?",
    answer: "Yes. If your camp profile is public and accepting applications, visitors can review your camp information and apply. You can review applicants, track decisions, follow up, and move approved people into your roster.",
    category: "Applications",
    order: 5
  },
  {
    question: "Can I add existing members without making them apply?",
    answer: "Yes. Camp leads can add or invite known members directly to the roster. Applications are useful for recruiting and screening new people, but they are not required for every roster member.",
    category: "Members",
    order: 6
  },
  {
    question: "Can I give another person access to help manage the camp?",
    answer: "Yes. Camp owners can assign delegated Camp Lead access to trusted roster members so they can help manage camp operations. Access is scoped to that camp, so they get the tools they need without becoming a system admin.",
    category: "Camp Management",
    order: 7
  },
  {
    question: "Can individual burners use G8Road too?",
    answer: "Yes. Personal accounts are for members who want to browse camps, complete a profile, apply to camps, track application status, view tasks, sign up for shifts, and stay connected with the camp they join.",
    category: "General",
    order: 8
  },
  {
    question: "Is camp and member information private?",
    answer: "Sensitive camp operations data is only available to authorized users. Public camp profiles can be shown to visitors, while roster details, applications, tasks, shifts, and internal notes stay inside the appropriate camp account permissions.",
    category: "Technical Support",
    order: 9
  },
  {
    question: "What if I need help choosing the right account type?",
    answer: "Choose a Camp account if you are creating or managing a camp. Choose a Personal account if you are joining camps as an individual member. If you are unsure, contact support and the G8Road team can help you pick the right path.",
    category: "Account Management",
    order: 10
  }
];

const MIN_HOMEPAGE_FAQS = 6;

const sortFAQs = (faqs: FAQItem[]) =>
  [...faqs].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

const mergeHomepageFAQs = (apiFaqs: FAQItem[]) => {
  const sortedApiFaqs = sortFAQs(apiFaqs);

  if (sortedApiFaqs.length >= MIN_HOMEPAGE_FAQS) {
    return sortedApiFaqs;
  }

  const seenQuestions = new Set<string>();
  const merged: FAQItem[] = [];

  [...sortedApiFaqs, ...generalFAQData].forEach((faq) => {
    const questionKey = faq.question.trim().toLowerCase();
    if (!questionKey || seenQuestions.has(questionKey)) return;
    seenQuestions.add(questionKey);
    merged.push(faq);
  });

  return merged;
};

const FAQ: React.FC = () => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<string | false>(false);
  const [faqData, setFaqData] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showContactSuccessModal, setShowContactSuccessModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [contactForm, setContactForm] = useState({
    requesterType: (user?.accountType === 'camp' ? 'camp' : user?.accountType === 'personal' ? 'member' : 'other') as RequesterType,
    requesterEmail: user?.email || '',
    requesterPhone: '',
    subject: '',
    message: ''
  });

  const handleToggle = (panel: string) => {
    setExpanded(expanded === panel ? false : panel);
  };

  useEffect(() => {
    const loadFAQs = async () => {
      try {
        setLoading(true);
        const response = await apiService.get('/help/faqs', {
          params: { audience: 'homepage' }
        });
        const apiFaqs = response.faqs || [];
        setFaqData(mergeHomepageFAQs(apiFaqs));
      } catch (error) {
        console.error('Error loading FAQs:', error);
        setFaqData(generalFAQData);
      } finally {
        setLoading(false);
      }
    };

    loadFAQs();
  }, [user?.accountType]);

  useEffect(() => {
    setContactForm((prev) => ({
      ...prev,
      requesterType: (user?.accountType === 'camp' ? 'camp' : user?.accountType === 'personal' ? 'member' : prev.requesterType) as RequesterType,
      requesterEmail: user?.email || prev.requesterEmail
    }));
  }, [user]);

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
    } catch (error) {
      console.error('Error submitting contact form:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-16 bg-custom-bg">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <HelpCircle className="w-10 h-10 text-custom-primary mr-3" />
            <h2 className="text-h1 md:text-h1 font-lato-bold text-custom-primary">
              Frequently Asked Questions
            </h2>
          </div>
          <p className="text-h5 text-custom-text-secondary max-w-2xl mx-auto">
            Everything you need to know before joining G8Road.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-custom-primary"></div>
              <p className="mt-2 text-custom-text-secondary">Loading FAQs...</p>
            </div>
          ) : (
            faqData.map((faq, index) => (
            <div
              key={faq._id ?? `faq-${index}`}
              className="mb-4 bg-white border border-gray-200 rounded-lg overflow-hidden"
            >
              <button
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
                onClick={() => handleToggle(`panel${index}`)}
              >
                <h3 className="text-h4 font-lato-bold text-custom-text pr-4">
                  {faq.question}
                </h3>
                <ChevronDown 
                  className={`w-5 h-5 text-custom-primary transition-transform duration-200 ${
                    expanded === `panel${index}` ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {expanded === `panel${index}` && (
                <div className="px-6 pb-4">
                  <div
                    className="text-body text-custom-text-secondary leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderRichTextToHtml(faq.answer) }}
                  />
                </div>
              )}
            </div>
          ))
          )}
        </div>

        <div className="max-w-4xl mx-auto mt-12">
          <div className="rounded-3xl bg-white border border-gray-200 shadow-sm p-8">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircleIcon className="w-5 h-5 text-custom-primary" />
            </div>
            <p className="text-h4 text-custom-text-secondary mb-6">
              Need to contact the G8Road Team?
            </p>
            <Button
              variant="primary"
              onClick={() => setShowContactModal(true)}
              className="w-full"
            >
              Contact Support
            </Button>
          </div>
        </div>
      </div>

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

export default FAQ;
