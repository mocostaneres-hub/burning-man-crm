import React, { useState, useEffect } from 'react';
import { Button, Card, Modal, Badge } from '../ui';
import { Send, Reply as ReplyIcon, MessageSquare as MessageSquareIcon, Inbox as InboxIcon, Plus, Loader2, User } from 'lucide-react';
// import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';

interface MessageUser {
  _id: string;
  name: string;
  email: string;
}

interface SupportMessage {
  _id: string;
  subject: string;
  message: string;
  status: 'open' | 'in-progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  user: MessageUser;
  createdAt: string;
  updatedAt: string;
  replies?: SupportReply[];
}

interface SupportReply {
  _id: string;
  message: string;
  isFromSupport: boolean;
  createdAt: string;
}

const SupportInbox: React.FC = () => {
  // const { } = useAuth(); // Removed unused auth
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    loadSupportMessages();
  }, []);

  const loadSupportMessages = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/support/inbox');
      setMessages(response.data);
    } catch (err) {
      console.error('Error loading support messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReplySubmit = async () => {
    if (!selectedMessage || !replyMessage.trim()) return;

    try {
      setSubmittingReply(true);
      await apiService.post(`/support/messages/${selectedMessage._id}/reply`, {
        message: replyMessage
      });
      
      setReplyMessage('');
      setShowReplyModal(false);
      loadSupportMessages(); // Refresh messages
    } catch (err) {
      console.error('Error submitting reply:', err);
    } finally {
      setSubmittingReply(false);
    }
  };

  const updateMessageStatus = async (messageId: string, status: string) => {
    try {
      await apiService.put(`/support/messages/${messageId}/status`, { status });
      loadSupportMessages(); // Refresh messages
    } catch (err) {
      console.error('Error updating message status:', err);
    }
  };

  const filteredMessages = messages.filter(message => {
    switch (activeTab) {
      case 0: return message.status === 'open';
      case 1: return message.status === 'in-progress';
      case 2: return message.status === 'resolved';
      default: return true;
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'error';
      case 'in-progress': return 'warning';
      case 'resolved': return 'success';
      default: return 'neutral';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'neutral';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-custom-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h2 font-lato-bold text-custom-text">
            Support Inbox
          </h2>
          <p className="text-body text-custom-text-secondary">
            Manage and respond to user support messages
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowReplyModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Message
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { name: 'Open', count: messages.filter(m => m.status === 'open').length },
            { name: 'In Progress', count: messages.filter(m => m.status === 'in-progress').length },
            { name: 'Resolved', count: messages.filter(m => m.status === 'resolved').length }
          ].map((tab, index) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(index)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === index
                  ? 'border-custom-primary text-custom-primary'
                  : 'border-transparent text-custom-text-secondary hover:text-custom-text hover:border-gray-300'
              }`}
            >
              {tab.name}
              <Badge variant={getStatusColor(tab.name.toLowerCase().replace(' ', '-'))}>
                {tab.count}
              </Badge>
            </button>
          ))}
        </nav>
      </div>

      {/* Messages List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredMessages.map((message) => (
          <Card key={message._id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-custom-primary flex items-center justify-center text-white">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-body font-medium text-custom-text">
                    {message.user.name}
                  </h3>
                  <p className="text-sm text-custom-text-secondary">
                    {message.user.email}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant={getStatusColor(message.status)}>
                  {message.status}
                </Badge>
                <Badge variant={getPriorityColor(message.priority)}>
                  {message.priority}
                    </Badge>
              </div>
            </div>

            <div className="mb-4">
              <h4 className="text-h4 font-lato-bold text-custom-text mb-2">
                {message.subject}
              </h4>
              <p className="text-body text-custom-text-secondary line-clamp-3">
                {message.message}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-custom-text-secondary">
                {new Date(message.createdAt).toLocaleDateString()}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMessage(message)}
                  className="flex items-center gap-1"
                >
                  <MessageSquareIcon className="w-3 h-3" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedMessage(message);
                    setShowReplyModal(true);
                  }}
                  className="flex items-center gap-1"
                >
                  <ReplyIcon className="w-3 h-3" />
                  Reply
                </Button>
              </div>
            </div>

            {/* Quick Status Update */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateMessageStatus(message._id, 'in-progress')}
                  disabled={message.status === 'in-progress'}
                  className="flex-1"
                >
                  Mark In Progress
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateMessageStatus(message._id, 'resolved')}
                  disabled={message.status === 'resolved'}
                  className="flex-1"
                >
                  Mark Resolved
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredMessages.length === 0 && (
        <div className="text-center py-12">
          <InboxIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-h3 font-lato-bold text-custom-text-secondary mb-2">
            No Messages
          </h3>
          <p className="text-body text-custom-text-secondary">
            No support messages found for this status.
          </p>
        </div>
      )}

      {/* Message Detail Modal */}
      {selectedMessage && (
        <MessageDetailModal
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
          onReply={() => {
            setSelectedMessage(null);
            setShowReplyModal(true);
          }}
        />
      )}

      {/* Reply Modal */}
      <Modal
        isOpen={showReplyModal}
        onClose={() => {
          setShowReplyModal(false);
          setReplyMessage('');
        }}
        title="Send Reply"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-label font-medium text-custom-text mb-2">
              Reply Message
            </label>
            <textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Type your reply here..."
              rows={6}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowReplyModal(false);
                setReplyMessage('');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleReplySubmit}
              disabled={!replyMessage.trim() || submittingReply}
              className="flex-1 flex items-center justify-center gap-2"
            >
              {submittingReply ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
            Send Reply
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

// Message Detail Modal Component
const MessageDetailModal: React.FC<{
  message: SupportMessage;
  onClose: () => void;
  onReply: () => void;
}> = ({ message, onClose, onReply }) => {
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={message.subject}
    >
      <div className="space-y-4">
        {/* Message Header */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-custom-primary flex items-center justify-center text-white">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-body font-medium text-custom-text">
                {message.user.name}
              </h4>
              <p className="text-sm text-custom-text-secondary">
                {message.user.email}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant={message.status === 'open' ? 'error' : message.status === 'in-progress' ? 'warning' : 'success'}>
              {message.status}
            </Badge>
            <Badge variant={message.priority === 'high' ? 'error' : message.priority === 'medium' ? 'warning' : 'success'}>
              {message.priority}
            </Badge>
          </div>
        </div>

        {/* Message Content */}
        <div className="p-4 border border-gray-200 rounded-lg">
          <p className="text-body text-custom-text-secondary whitespace-pre-wrap">
            {message.message}
          </p>
          <p className="text-sm text-custom-text-secondary mt-4">
            {new Date(message.createdAt).toLocaleString()}
          </p>
        </div>

        {/* Replies */}
        {message.replies && message.replies.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-h4 font-lato-bold text-custom-text">Replies</h4>
            {message.replies.map((reply) => (
              <div key={reply._id} className={`p-4 rounded-lg ${
                reply.isFromSupport ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-custom-text">
                    {reply.isFromSupport ? 'Support Team' : 'User'}
                  </span>
                  <span className="text-sm text-custom-text-secondary">
                    {new Date(reply.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-body text-custom-text-secondary whitespace-pre-wrap">
                  {reply.message}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Close
          </Button>
          <Button
            variant="primary"
            onClick={onReply}
            className="flex-1 flex items-center justify-center gap-2"
          >
            <ReplyIcon className="w-4 h-4" />
            Reply
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SupportInbox;