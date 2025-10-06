import React, { useState, useEffect } from 'react';
import { Button, Card, Modal, Input } from '../ui';
import { Video as VideoIcon, Users, X, Play as PlayIcon, Square as SquareIcon, Mic as MicIcon, MicOff as MicOffIcon, Loader2 } from 'lucide-react';

interface ZoomMeetingProps {
  campId?: string;
  memberId?: string;
  onClose?: () => void;
  userAccountType?: 'personal' | 'camp' | 'admin';
}

interface MeetingData {
  meetingNumber: string;
  password: string;
  userName: string;
  userEmail: string;
  role: number; // 0 = attendee, 1 = host
}

const ZoomMeeting: React.FC<ZoomMeetingProps> = ({
  campId,
  memberId,
  onClose,
  userAccountType = 'personal'
}) => {
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinForm, setJoinForm] = useState({
    meetingId: '',
    password: '',
    userName: ''
  });

  useEffect(() => {
    if (campId || memberId) {
      loadMeetingData();
    }
  }, [campId, memberId]);

  const loadMeetingData = async () => {
    try {
    setLoading(true);
    setError('');

      // Simulate API call to get meeting data
      // In a real implementation, this would fetch from your backend
      const mockMeetingData: MeetingData = {
        meetingNumber: '123456789',
        password: '123456',
        userName: 'Burning Man Member',
        userEmail: 'member@example.com',
        role: userAccountType === 'camp' ? 1 : 0
      };
      
      setMeetingData(mockMeetingData);
    } catch (err) {
      console.error('Error loading meeting data:', err);
      setError('Failed to load meeting information');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMeeting = () => {
    if (!meetingData) {
      setError('No meeting data available');
      return;
    }

    setIsInMeeting(true);
    // In a real implementation, this would initialize the Zoom SDK
    console.log('Joining meeting with data:', meetingData);
  };

  const handleLeaveMeeting = () => {
    setIsInMeeting(false);
    // In a real implementation, this would leave the Zoom meeting
    console.log('Leaving meeting');
  };

  const handleJoinWithId = () => {
    if (!joinForm.meetingId.trim() || !joinForm.userName.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    const meetingData: MeetingData = {
      meetingNumber: joinForm.meetingId,
      password: joinForm.password,
      userName: joinForm.userName,
      userEmail: '',
      role: 0
    };

    setMeetingData(meetingData);
    setIsInMeeting(true);
    setShowJoinModal(false);
    setError('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-custom-primary" />
      </div>
    );
  }

  if (isInMeeting && meetingData) {
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Meeting Header */}
        <div className="bg-gray-900 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-h2 font-lato-bold">
              Zoom Meeting
            </h2>
            <span className="text-sm text-gray-400">
              Meeting ID: {meetingData.meetingNumber}
            </span>
          </div>
          <Button
            variant="outline"
            onClick={handleLeaveMeeting}
            className="text-white border-white hover:bg-white hover:text-black"
          >
            <X className="w-4 h-4 mr-2" />
            Leave Meeting
          </Button>
        </div>

        {/* Meeting Content */}
        <div className="flex-1 p-8">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gray-800 border-gray-700 p-8 text-center">
              <VideoIcon className="w-16 h-16 text-custom-primary mx-auto mb-4" />
              <h3 className="text-h3 font-lato-bold mb-4">
                Meeting in Progress
              </h3>
              <p className="text-body text-gray-300 mb-6">
                You are now connected to the Zoom meeting. In a real implementation, 
                the Zoom SDK would be initialized here.
              </p>
              
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  className="bg-red-600 border-red-600 text-white hover:bg-red-700"
                >
                  <MicIcon className="w-4 h-4 mr-2" />
                  Mute
                </Button>
                <Button
                  variant="outline"
                  className="bg-gray-600 border-gray-600 text-white hover:bg-gray-700"
                >
                  <SquareIcon className="w-4 h-4 mr-2" />
                  Stop Video
                </Button>
                <Button
                  variant="outline"
                  className="bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Participants
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <VideoIcon className="w-16 h-16 text-custom-primary mx-auto mb-4" />
        <h1 className="text-h1 font-lato-bold text-custom-text mb-4">
          Video Meetings
        </h1>
        <p className="text-body text-custom-text-secondary">
          Connect with your camp members through video calls
        </p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Join Camp Meeting */}
        {meetingData && (
          <Card className="p-6 text-center">
            <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
              Camp Meeting
            </h2>
            <p className="text-body text-custom-text-secondary mb-6">
              Join your camp's scheduled meeting
            </p>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-sm text-custom-text-secondary">Meeting ID:</span>
                <span className="text-sm font-medium text-custom-text">{meetingData.meetingNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-custom-text-secondary">Password:</span>
                <span className="text-sm font-medium text-custom-text">{meetingData.password}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-custom-text-secondary">Your Name:</span>
                <span className="text-sm font-medium text-custom-text">{meetingData.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-custom-text-secondary">Role:</span>
                <span className="text-sm font-medium text-custom-text">
                  {meetingData.role === 1 ? 'Host' : 'Participant'}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              onClick={handleJoinMeeting}
              className="w-full flex items-center justify-center gap-2"
            >
              <PlayIcon className="w-4 h-4" />
              Join Meeting
            </Button>
          </Card>
        )}

        {/* Join with Meeting ID */}
        <Card className="p-6 text-center">
          <h2 className="text-h2 font-lato-bold text-custom-text mb-4">
            Join Meeting
          </h2>
          <p className="text-body text-custom-text-secondary mb-6">
            Join a meeting with a meeting ID
          </p>

          <Button
            variant="outline"
            onClick={() => setShowJoinModal(true)}
            className="w-full flex items-center justify-center gap-2"
          >
            <VideoIcon className="w-4 h-4" />
            Enter Meeting ID
          </Button>
        </Card>
      </div>

      {/* Join Meeting Modal */}
      <Modal
        isOpen={showJoinModal}
        onClose={() => {
          setShowJoinModal(false);
          setError('');
        }}
        title="Join Meeting"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-label font-medium text-custom-text mb-2">
              Meeting ID *
            </label>
            <Input
              value={joinForm.meetingId}
              onChange={(e) => setJoinForm({ ...joinForm, meetingId: e.target.value })}
              placeholder="Enter meeting ID"
            />
          </div>

          <div>
            <label className="block text-label font-medium text-custom-text mb-2">
              Meeting Password
            </label>
            <Input
              type="password"
              value={joinForm.password}
              onChange={(e) => setJoinForm({ ...joinForm, password: e.target.value })}
              placeholder="Enter meeting password (if required)"
            />
          </div>

          <div>
            <label className="block text-label font-medium text-custom-text mb-2">
              Your Name *
            </label>
            <Input
              value={joinForm.userName}
              onChange={(e) => setJoinForm({ ...joinForm, userName: e.target.value })}
              placeholder="Enter your display name"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowJoinModal(false);
                setError('');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleJoinWithId}
              disabled={!joinForm.meetingId.trim() || !joinForm.userName.trim()}
              className="flex-1 flex items-center justify-center gap-2"
            >
              <PlayIcon className="w-4 h-4" />
              Join Meeting
            </Button>
          </div>
        </div>
      </Modal>

      {/* Close Button */}
      {onClose && (
        <div className="text-center mt-8">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Close
          </Button>
        </div>
      )}
    </div>
  );
};

export default ZoomMeeting;