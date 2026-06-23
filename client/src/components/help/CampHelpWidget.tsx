import React, { useEffect, useState } from 'react';
import { HelpCircle, Loader2, MessageCircle, Send, X } from 'lucide-react';
import { Button, Input } from '../ui';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

type RequesterType = 'camp' | 'member' | 'other';

const CampHelpWidget: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({
    requesterType: 'camp' as RequesterType,
    requesterEmail: '',
    requesterPhone: '',
    subject: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const hasCampHelpAccess = Boolean(
    isAuthenticated && user && (
      user.accountType === 'camp'
      || (user.accountType === 'admin' && user.campId)
      || (user.isCampLead === true && user.campLeadCampId)
    )
  );

  useEffect(() => {
    if (!user) return;

    setForm((prev) => ({
      ...prev,
      requesterType: user.accountType === 'personal' ? 'member' : 'camp',
      requesterEmail: user.email || prev.requesterEmail
    }));
  }, [user]);

  if (!hasCampHelpAccess) {
    return null;
  }

  const resetMessages = () => {
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleOpen = () => {
    resetMessages();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    resetMessages();
  };

  const handleSubmit = async () => {
    resetMessages();
    setSubmitting(true);

    try {
      await apiService.post('/help/contact', form);
      setForm((prev) => ({
        ...prev,
        subject: '',
        message: '',
        requesterPhone: ''
      }));
      setSuccessMessage('Support request sent. We will follow up by email.');
    } catch (error) {
      console.error('Error submitting camp help request:', error);
      setErrorMessage('We could not send that request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = Boolean(
    form.requesterEmail.trim()
    && form.subject.trim()
    && form.message.trim()
    && !submitting
  );

  return (
    <div className="fixed right-4 top-20 z-50 w-[calc(100vw-2rem)] max-w-sm sm:right-6">
      {!isOpen && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex items-center gap-2 rounded-full bg-custom-primary px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-custom-primary-hover focus:outline-none focus:ring-2 focus:ring-custom-primary focus:ring-offset-2"
            aria-label="Open support help window"
          >
            <HelpCircle className="h-4 w-4" />
            Need Help?
          </button>
        </div>
      )}

      {isOpen && (
        <section
          className="rounded-lg border border-gray-200 bg-white shadow-xl"
          aria-label="Camp help support window"
        >
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-custom-primary" />
              <div>
                <h2 className="text-sm font-semibold text-custom-text">Need Help?</h2>
                <p className="text-xs text-custom-text-secondary">Email the G8Road support team.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-custom-primary"
              aria-label="Close support help window"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 px-4 py-4">
            {successMessage && (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </div>
            )}

            <Input
              type="email"
              label="Email"
              value={form.requesterEmail}
              onChange={(e) => setForm({ ...form, requesterEmail: e.target.value })}
              placeholder="you@example.com"
              className="bg-white"
            />

            <Input
              type="text"
              label="Subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="What can we help with?"
              className="bg-white"
            />

            <div>
              <label className="form-label" htmlFor="camp-help-message">Message</label>
              <textarea
                id="camp-help-message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Describe your question or issue..."
                rows={4}
                className="input-primary min-h-[104px] resize-none bg-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClose}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default CampHelpWidget;
