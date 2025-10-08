import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Badge } from '../../components/ui';
import { CheckCircle as CheckCircleIcon, X, Eye, Filter as FilterIcon, Loader2, RefreshCw, Linkedin, Instagram, Facebook, MapPin, Calendar, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatDate } from '../../utils/dateFormatters';

interface Application {
  _id: string;
  applicant?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePhoto?: string;
    playaName?: string;
    city?: string;
    yearsBurned?: number;
    arrivalDate?: string;
    departureDate?: string;
    hasTicket?: boolean;
    hasVehiclePass?: boolean;
    interestedInEAP?: boolean;
    interestedInStrike?: boolean;
    skills?: string[];
    socialMedia?: {
      linkedin?: string;
      instagram?: string;
      facebook?: string;
    };
  };
  status: 'pending' | 'call-scheduled' | 'pending-orientation' | 'under-review' | 'approved' | 'rejected' | 'unresponsive';
  appliedAt: string;
  reviewedAt?: string;
  reviewNotes?: string;
  applicationData?: {
    motivation?: string;
    experience?: string;
    skills?: string[];
    selectedCallSlotId?: string;
    callSlot?: {
      date: string;
      startTime: string;
      endTime: string;
    };
    availability?: {
      arriveDate?: string;
      departDate?: string;
      workShifts?: string;
    };
  };
}

const ApplicationManagementTable: React.FC = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'call-scheduled' | 'pending-orientation' | 'under-review' | 'approved' | 'rejected' | 'unresponsive'>('all');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const fetchApplications = async () => {
    try {
      setLoading(true);
      
      // First get the camp data to get the camp ID
      const campData = await api.getMyCamp();
      const campId = campData._id;
      
      const response = await api.get(`/applications/camp/${campId}`);
      
      // Since api.get() returns response.data directly, response should be the data
      const applicationsData = response.applications || response;
      
      setApplications(applicationsData);
    } catch (err) {
      console.error('Error fetching applications:', err);
      setError('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const filterApplications = useCallback(() => {
    if (statusFilter === 'all') {
      setFilteredApplications(applications);
    } else {
      setFilteredApplications(applications.filter(app => app.status === statusFilter));
    }
  }, [applications, statusFilter]);

  useEffect(() => {
    if (user?.accountType === 'camp' || user?.campId) {
      fetchApplications();
    }
  }, [user?.accountType, user?.campId]);

  useEffect(() => {
    filterApplications();
  }, [filterApplications]);

  const handleStatusChange = async (applicationId: string, newStatus: 'approved' | 'rejected') => {
    try {
      setProcessing(applicationId);
      await api.put(`/applications/${applicationId}/status`, {
        status: newStatus,
        reviewNotes: reviewNotes
      });
      
      await fetchApplications();
      setShowApplicationModal(false);
      setSelectedApplication(null);
      setReviewNotes('');
    } catch (err) {
      console.error('Error updating application status:', err);
      setError('Failed to update application status');
    } finally {
      setProcessing(null);
    }
  };

  const handleSaveStatusOnly = async () => {
    if (!selectedApplication) return;
    
    try {
      setProcessing(selectedApplication._id);
      await api.put(`/applications/${selectedApplication._id}/status`, {
        status: selectedStatus,
        reviewNotes: reviewNotes
      });
      
      await fetchApplications();
      setShowApplicationModal(false);
      setSelectedApplication(null);
      setReviewNotes('');
    } catch (err) {
      console.error('Error updating application status:', err);
      setError('Failed to update application status');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="error">Rejected</Badge>;
      case 'call-scheduled':
        return <Badge variant="info">Call Scheduled</Badge>;
      case 'pending-orientation':
        return <Badge variant="warning">Pending Orientation</Badge>;
      case 'under-review':
        return <Badge variant="neutral">Under Review</Badge>;
      case 'unresponsive':
        return <Badge variant="error">Unresponsive</Badge>;
      case 'pending':
      default:
        return <Badge variant="warning">Pending</Badge>;
    }
  };

  // Using shared date formatting utility

  const formatArrivalDepartureDate = (dateString: string) => {
    if (!dateString || dateString === '' || dateString === 'undefined' || dateString === 'null') {
      return 'Not specified';
    }
    
    try {
      // Handle different date formats
      let date;
      if (dateString.includes('T')) {
        // Already has time component
        date = new Date(dateString);
      } else {
        // Add timezone offset to handle date parsing correctly
        date = new Date(dateString + 'T12:00:00');
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Not specified';
      }
      
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: '2-digit',
        day: '2-digit'
      }).replace(/(\w+),\s*(\d+)\/(\d+)/, '$1, $2/$3');
    } catch (error) {
      return 'Not specified';
    }
  };

  const openApplicationModal = (application: Application) => {
    setSelectedApplication(application);
    setReviewNotes(application.reviewNotes || '');
    setSelectedStatus(application.status);
    setShowApplicationModal(true);
  };

  console.log('🎨 [DEBUG] Rendering component...');
  console.log('⏳ [DEBUG] Loading state:', loading);
  console.log('📊 [DEBUG] Applications count:', applications.length);
  console.log('🔍 [DEBUG] Filtered applications count:', filteredApplications.length);
  console.log('❌ [DEBUG] Error state:', error);

  if (loading) {
    console.log('⏳ [DEBUG] Showing loading state');
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-h1 font-lato-bold text-custom-text mb-2">
            Application Management
          </h1>
          <p className="text-body text-custom-text-secondary">
            Review and manage camp applications
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchApplications}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Filters */}
      <Card className="p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <FilterIcon className="w-4 h-4 text-custom-text-secondary" />
            <span className="text-label font-medium text-custom-text">Filter:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'call-scheduled', 'pending-orientation', 'under-review', 'approved', 'rejected', 'unresponsive'] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status === 'all' ? 'All' : 
                 status === 'call-scheduled' ? 'Call Scheduled' :
                 status === 'pending-orientation' ? 'Pending Orientation' :
                 status === 'under-review' ? 'Under Review' :
                 status === 'unresponsive' ? 'Unresponsive' :
                 status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
          <div className="ml-auto text-sm text-custom-text-secondary">
            {filteredApplications.length} application{filteredApplications.length !== 1 ? 's' : ''}
          </div>
        </div>
      </Card>

      {/* Applications Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applicant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Playa Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Travel Plans
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  EA/LD
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ticket/VP
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  📍 City
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  🔥 Burns
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Skills
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Socials
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applied
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chosen Call
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredApplications.map((application) => (
                <tr key={application._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {application.applicant?.profilePhoto ? (
                          <img
                            className="h-10 w-10 rounded-full"
                            src={application.applicant.profilePhoto}
                            alt={`${application.applicant?.firstName || ''} ${application.applicant?.lastName || ''}`}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-700">
                              {application.applicant?.firstName?.[0] || '?'}{application.applicant?.lastName?.[0] || '?'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {(user?.accountType === 'admin' || user?.accountType === 'camp') && user?.campId && application.applicant?._id ? (
                            <Link to={`/camp/${user.campId}/contacts/${application.applicant._id}`} className="text-custom-primary hover:underline">
                              {application.applicant?.firstName || 'Unknown'} {application.applicant?.lastName || 'User'}
                            </Link>
                          ) : (
                            <>
                              {application.applicant?.firstName || 'Unknown'} {application.applicant?.lastName || 'User'}
                            </>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {application.applicant?.email || 'No email'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {application.applicant?.playaName || (
                      <span className="text-gray-400 italic">Not set</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-sm">
                      <div className="text-green-600 font-medium">Arrive: {formatArrivalDepartureDate(application.applicant?.arrivalDate || '')}</div>
                      <div className="text-yellow-600 font-medium">Depart: {formatArrivalDepartureDate(application.applicant?.departureDate || '')}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-sm">
                      <div>EA: <span className={application.applicant?.interestedInEAP ? 'text-green-600 font-medium' : 'text-red-300'}>{application.applicant?.interestedInEAP ? 'Yes' : 'No'}</span></div>
                      <div>LD: <span className={application.applicant?.interestedInStrike ? 'text-green-600 font-medium' : 'text-red-300'}>{application.applicant?.interestedInStrike ? 'Yes' : 'No'}</span></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="text-sm">
                      <div>Ticket: <span className={application.applicant?.hasTicket ? 'text-green-600 font-medium' : 'text-red-300'}>{application.applicant?.hasTicket ? 'Yes' : 'No'}</span></div>
                      <div>VP: <span className={application.applicant?.hasVehiclePass ? 'text-green-600 font-medium' : 'text-red-300'}>{application.applicant?.hasVehiclePass ? 'Yes' : 'No'}</span></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {application.applicant?.city || 'Not specified'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {application.applicant?.yearsBurned !== undefined ? (
                      application.applicant.yearsBurned === 0 ? (
                        <span className="text-pink-600 font-medium">Virgin</span>
                      ) : (
                        application.applicant.yearsBurned
                      )
                    ) : 'Not specified'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(application.status)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {application.applicant?.skills?.slice(0, 3).map((skill) => (
                        <Badge key={skill} variant="neutral" size="sm">
                          {skill}
                        </Badge>
                      )) || []}
                      {application.applicant?.skills && application.applicant.skills.length > 3 && (
                        <Badge variant="neutral" size="sm">
                          +{application.applicant.skills.length - 3}
                        </Badge>
                      )}
                      {(!application.applicant?.skills || application.applicant.skills.length === 0) && (
                        <span className="text-gray-500 italic text-sm">No skills listed</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {/* Social Media Icons */}
                      {application.applicant?.socialMedia?.linkedin && (
                        <a
                          href={`https://linkedin.com/in/${application.applicant.socialMedia.linkedin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title="LinkedIn Profile"
                        >
                          <Linkedin className="w-4 h-4" />
                        </a>
                      )}
                      {application.applicant?.socialMedia?.instagram && (
                        <a
                          href={`https://instagram.com/${application.applicant.socialMedia.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pink-600 hover:text-pink-800 transition-colors"
                          title="Instagram Profile"
                        >
                          <Instagram className="w-4 h-4" />
                        </a>
                      )}
                      {application.applicant?.socialMedia?.facebook && (
                        <a
                          href={`https://facebook.com/${application.applicant.socialMedia.facebook}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 hover:text-blue-900 transition-colors"
                          title="Facebook Profile"
                        >
                          <Facebook className="w-4 h-4" />
                        </a>
                      )}
                      
                      {/* Show disabled icons for missing social media */}
                      {!application.applicant?.socialMedia?.linkedin && (
                        <Linkedin className="w-4 h-4 text-gray-300" />
                      )}
                      {!application.applicant?.socialMedia?.instagram && (
                        <Instagram className="w-4 h-4 text-gray-300" />
                      )}
                      {!application.applicant?.socialMedia?.facebook && (
                        <Facebook className="w-4 h-4 text-gray-300" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(application.appliedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {application.applicationData?.selectedCallSlotId ? (
                      <div className="text-sm">
                        <div className="font-medium text-blue-600">
                          {application.applicationData.callSlot ? (
                            <>
                              {new Date(application.applicationData.callSlot.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </>
                          ) : (
                            'Selected'
                          )}
                        </div>
                        {application.applicationData.callSlot && (
                          <div className="text-gray-600">
                            {application.applicationData.callSlot.startTime} - {application.applicationData.callSlot.endTime}
                          </div>
                        )}
                      </div>
                    ) : application.status === 'pending-orientation' ? (
                      <span className="text-orange-600 font-medium">Unavailable</span>
                    ) : (
                      <span className="text-gray-400">Not selected</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openApplicationModal(application)}
                        className="flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </Button>
                      {application.status === 'pending' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(application._id, 'approved')}
                            disabled={processing === application._id}
                            className="flex items-center gap-1 text-green-600 border-green-600 hover:bg-green-50"
                          >
                            <CheckCircleIcon className="w-3 h-3" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(application._id, 'rejected')}
                            disabled={processing === application._id}
                            className="flex items-center gap-1 text-red-600 border-red-600 hover:bg-red-50"
                          >
                            <X className="w-3 h-3" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredApplications.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-h3 font-lato-bold text-custom-text-secondary mb-2">
              No applications found
            </h3>
            <p className="text-body text-custom-text-secondary">
              {statusFilter === 'all' 
                ? 'No applications have been submitted yet.'
                : `No ${statusFilter} applications found.`
              }
            </p>
          </div>
        )}
      </Card>

      {/* Application Detail Modal */}
      {showApplicationModal && selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-h2 font-lato-bold text-custom-text">
                  Application Details
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApplicationModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="space-y-6">
                {/* Applicant Info Header */}
                <div className="flex items-center gap-4">
                  {selectedApplication.applicant?.profilePhoto ? (
                    <img
                      className="h-16 w-16 rounded-full"
                      src={selectedApplication.applicant.profilePhoto}
                      alt={`${selectedApplication.applicant?.firstName || ''} ${selectedApplication.applicant?.lastName || ''}`}
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-lg font-medium text-gray-700">
                        {selectedApplication.applicant?.firstName?.[0] || '?'}{selectedApplication.applicant?.lastName?.[0] || '?'}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-h3 font-lato-bold text-custom-text">
                      {selectedApplication.applicant?.firstName || 'Unknown'} {selectedApplication.applicant?.lastName || 'User'}
                    </h3>
                    {selectedApplication.applicant?.playaName && (
                      <p className="text-body text-orange-600 font-medium">
                        "{selectedApplication.applicant.playaName}"
                      </p>
                    )}
                    <p className="text-body text-custom-text-secondary">
                      {selectedApplication.applicant?.email || 'No email'}
                    </p>
                    
                    {/* City and Social Media */}
                    <div className="flex items-center gap-4 mt-2">
                      {selectedApplication.applicant?.city && (
                        <div className="flex items-center gap-1 text-sm text-custom-text-secondary">
                          <MapPin className="w-4 h-4" />
                          {selectedApplication.applicant.city}
                        </div>
                      )}
                      
                      {/* Social Media Icons */}
                      <div className="flex items-center gap-2">
                        {selectedApplication.applicant?.socialMedia?.linkedin && (
                          <a
                            href={`https://linkedin.com/in/${selectedApplication.applicant.socialMedia.linkedin}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                            title="LinkedIn Profile"
                          >
                            <Linkedin className="w-4 h-4" />
                          </a>
                        )}
                        {selectedApplication.applicant?.socialMedia?.instagram && (
                          <a
                            href={`https://instagram.com/${selectedApplication.applicant.socialMedia.instagram}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-pink-600 hover:text-pink-800 transition-colors"
                            title="Instagram Profile"
                          >
                            <Instagram className="w-4 h-4" />
                          </a>
                        )}
                        {selectedApplication.applicant?.socialMedia?.facebook && (
                          <a
                            href={`https://facebook.com/${selectedApplication.applicant.socialMedia.facebook}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 hover:text-blue-900 transition-colors"
                            title="Facebook Profile"
                          >
                            <Facebook className="w-4 h-4" />
                          </a>
                        )}
                        
                        {/* Show disabled icons for missing social media */}
                        {!selectedApplication.applicant?.socialMedia?.linkedin && (
                          <Linkedin className="w-4 h-4 text-gray-300" />
                        )}
                        {!selectedApplication.applicant?.socialMedia?.instagram && (
                          <Instagram className="w-4 h-4 text-gray-300" />
                        )}
                        {!selectedApplication.applicant?.socialMedia?.facebook && (
                          <Facebook className="w-4 h-4 text-gray-300" />
                        )}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(selectedApplication.status)}
                </div>

                {/* Travel Plans */}
                <div>
                  <h3 className="text-lg font-lato-bold text-custom-text mb-2">
                    Travel Plans
                  </h3>
                  <div className="text-sm space-y-1">
                    <div className="text-green-600 font-medium">
                      Arrive: {formatArrivalDepartureDate(selectedApplication.applicant?.arrivalDate || '')}
                    </div>
                    <div className="text-yellow-600 font-medium">
                      Depart: {formatArrivalDepartureDate(selectedApplication.applicant?.departureDate || '')}
                    </div>
                  </div>
                </div>

                {/* Early Arrival & Late Departure */}
                <div>
                  <h3 className="text-lg font-lato-bold text-custom-text mb-2">
                    Early Arrival & Late Departure
                  </h3>
                  <div className="text-sm space-y-1">
                    <div>EA: <span className={selectedApplication.applicant?.interestedInEAP ? 'text-green-600 font-medium' : 'text-red-300'}>{selectedApplication.applicant?.interestedInEAP ? 'Yes' : 'No'}</span></div>
                    <div>LD: <span className={selectedApplication.applicant?.interestedInStrike ? 'text-green-600 font-medium' : 'text-red-300'}>{selectedApplication.applicant?.interestedInStrike ? 'Yes' : 'No'}</span></div>
                  </div>
                </div>

                {/* Ticket & Vehicle Pass */}
                <div>
                  <h3 className="text-lg font-lato-bold text-custom-text mb-2">
                    Ticket & Vehicle Pass
                  </h3>
                  <div className="text-sm space-y-1">
                    <div>Ticket: <span className={
                      selectedApplication.applicant?.hasTicket === true ? 'text-green-600 font-medium' : 
                      selectedApplication.applicant?.hasTicket === false ? 'text-red-300' : 
                      'text-gray-500'
                    }>{
                      selectedApplication.applicant?.hasTicket === true ? 'Yes' : 
                      selectedApplication.applicant?.hasTicket === false ? 'No' : 
                      'Not informed'
                    }</span></div>
                    <div>VP: <span className={
                      selectedApplication.applicant?.hasVehiclePass === true ? 'text-green-600 font-medium' : 
                      selectedApplication.applicant?.hasVehiclePass === false ? 'text-red-300' : 
                      'text-gray-500'
                    }>{
                      selectedApplication.applicant?.hasVehiclePass === true ? 'Yes' : 
                      selectedApplication.applicant?.hasVehiclePass === false ? 'No' : 
                      'Not informed'
                    }</span></div>
                  </div>
                </div>

                {/* Burns */}
                <div>
                  <h3 className="text-lg font-lato-bold text-custom-text mb-2">
                    🔥 Burns
                  </h3>
                  <p className="text-gray-600">
                    {selectedApplication.applicant?.yearsBurned !== undefined ? (
                      selectedApplication.applicant.yearsBurned === 0 ? (
                        <span className="text-pink-600 font-medium">Virgin</span>
                      ) : (
                        selectedApplication.applicant.yearsBurned
                      )
                    ) : 'Not specified'}
                  </p>
                </div>

                {/* Skills */}
                <div>
                  <h3 className="text-lg font-lato-bold text-custom-text mb-2">
                    🛠️ Skills
                  </h3>
                  <div className="text-sm">
                    {selectedApplication.applicant?.skills && selectedApplication.applicant.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedApplication.applicant.skills.map((skill, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No skills listed</p>
                    )}
                  </div>
                </div>

                {/* Application-Specific Information */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <div>
                    <h4 className="text-label font-medium text-custom-text mb-2">Motivation</h4>
                    <p className="text-body text-custom-text-secondary">
                      {selectedApplication.applicationData?.motivation || 'Not provided'}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-label font-medium text-custom-text mb-2">Experience</h4>
                    <p className="text-body text-custom-text-secondary">
                      {selectedApplication.applicationData?.experience || 'Not provided'}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-label font-medium text-custom-text mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedApplication.applicant?.skills && selectedApplication.applicant.skills.length > 0 ? (
                        selectedApplication.applicant.skills.map((skill) => (
                          <Badge key={skill} variant="neutral">{skill}</Badge>
                        ))
                      ) : (
                        <span className="text-gray-500">No skills listed</span>
                      )}
                    </div>
                  </div>

                  {/* Chosen Call Time */}
                  <div>
                    <h4 className="text-label font-medium text-custom-text mb-2">📞 Chosen Call Time</h4>
                    {selectedApplication.applicationData?.selectedCallSlotId && selectedApplication.applicationData?.callSlot ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-blue-600" />
                          <div>
                            <div className="font-semibold text-blue-900">
                              {new Date(selectedApplication.applicationData.callSlot.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-blue-700 flex items-center gap-2 mt-1">
                              <Clock className="w-4 h-4" />
                              {selectedApplication.applicationData.callSlot.startTime} - {selectedApplication.applicationData.callSlot.endTime}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-body text-gray-500 italic">No call time selected</p>
                    )}
                  </div>
                </div>

                {/* Status Management Section */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Application Status
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                    >
                      <option value="pending">Pending</option>
                      <option value="call-scheduled">Call Scheduled</option>
                      <option value="pending-orientation">Pending Orientation</option>
                      <option value="under-review">Under Review</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="unresponsive">Unresponsive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Review Notes (Optional)
                    </label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Add notes about this application..."
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent resize-none"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <Button
                    variant="outline"
                    onClick={() => setShowApplicationModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSaveStatusOnly}
                    disabled={processing === selectedApplication._id}
                    className="flex-1"
                  >
                    {processing === selectedApplication._id ? 'Saving...' : 'Save Status'}
                  </Button>
                  {selectedApplication.status !== 'approved' && selectedStatus === 'approved' && (
                    <Button
                      variant="primary"
                      onClick={() => handleStatusChange(selectedApplication._id, 'approved')}
                      disabled={processing === selectedApplication._id}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircleIcon className="w-4 h-4 mr-2" />
                      {processing === selectedApplication._id ? 'Approving...' : 'Approve & Add to Roster'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationManagementTable;
