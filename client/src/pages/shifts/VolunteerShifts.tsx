import React, { useState, useEffect } from 'react';
import { Button, Card, Modal, Input } from '../../components/ui';
import { Calendar, Users, Plus, Eye, Edit, Trash2, Save, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Event } from '../../types';
import { formatEventDate, formatTime, formatDate } from '../../utils/dateFormatters';

// Helper function for retrying API calls with exponential backoff
const retryApiCall = async (
  apiCall: () => Promise<any>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<any> => {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on authentication or permission errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`⏳ API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

const VolunteerShifts: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [activeTab, setActiveTab] = useState<'main' | 'reports'>('main');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [reportType, setReportType] = useState<'per-person' | 'per-day'>('per-person');
  const [selectedDate, setSelectedDate] = useState('');

  // Form state for creating events
  const [eventForm, setEventForm] = useState({
    eventName: '',
    description: '',
    shifts: [] as Array<{
      title: string;
      description: string;
      date: string;
      startTime: string;
      endTime: string;
      maxSignUps: number;
    }>,
    assignmentType: 'none' as 'none' | 'all' | 'specific',
    selectedMembers: [] as number[]
  });

  // State for roster members
  const [rosterMembers, setRosterMembers] = useState<Array<{
    _id: number;
    firstName: string;
    lastName: string;
    email: string;
  }>>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Check if user has admin/lead access
  const isCampContext = user?.accountType === 'camp' || (user?.accountType === 'admin' && user?.campName);
  const isAdminOrLead = user?.accountType === 'admin' || user?.accountType === 'camp';
  const canAccessShifts = isCampContext && isAdminOrLead;

  useEffect(() => {
    if (canAccessShifts) {
      loadEvents();
      loadRosterMembers();
    }
  }, [canAccessShifts]);

  const loadRosterMembers = async () => {
    try {
      setLoadingMembers(true);
      
      // Get camp ID from user context  
      let campId;
      if (user?.accountType === 'camp') {
        const response = await api.get('/camps/my-camp');
        campId = response.data?._id;
      } else if (user?.accountType === 'admin' && user?.campName) {
        const response = await api.get('/camps/my-camp');
        campId = response.data?._id;
      }

      if (!campId) {
        setRosterMembers([]);
        return;
      }

      // Use the same endpoint as MemberRoster for consistency
      const response = await api.getCampMembers(campId.toString());
      
      if (response.members && Array.isArray(response.members)) {
        // Filter for approved members only
        const approvedMembers = response.members
          .filter((member: any) => {
            // Check if the member is approved in the roster
            return member.status === 'approved' || member.role !== 'pending';
          })
          .map((member: any) => {
            const user = typeof member.user === 'object' ? member.user : member;
            return {
              _id: user._id || member._id,
              firstName: user.firstName || '',
              lastName: user.lastName || '',
              email: user.email || ''
            };
          });
        
        setRosterMembers(approvedMembers);
      } else {
        setRosterMembers([]);
      }
    } catch (error) {
      console.error('Error loading roster members:', error);
      setRosterMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadEvents = async () => {
    try {
      const response = await api.get('/shifts/events');
      if (response.data?.events) {
        setEvents(response.data.events);
      } else {
        setEvents([]);
      }
    } catch (error) {
      console.error('Error loading events:', error);
      setEvents([]);
    }
  };

  const handleCreateEvent = async () => {
    try {
      console.log('🔍 [Event Creation] User object:', user);
      console.log('🔍 [Event Creation] User accountType:', user?.accountType);
      console.log('🔍 [Event Creation] User campName:', user?.campName);
      
      // Get camp ID from user context
      let campId;
      if (user?.accountType === 'camp') {
        console.log('🔍 [Event Creation] Detected camp account, fetching camp data...');
        // For camp accounts, we need to get the camp ID
        const response = await api.get('/camps/my-camp');
        console.log('🔍 [Event Creation] Camp response:', response.data);
        campId = response.data?._id;
      } else if (user?.accountType === 'admin' && user?.campName) {
        console.log('🔍 [Event Creation] Detected admin account with camp context...');
        // For admin accounts with camp context
        const response = await api.get('/camps/my-camp');
        console.log('🔍 [Event Creation] Camp response:', response.data);
        campId = response.data?._id;
      }

      console.log('🔍 [Event Creation] Final campId:', campId);
      if (!campId) {
        console.error('❌ [Event Creation] No campId found!');
        alert('Unable to determine camp context. Please ensure you are logged in as a camp admin.');
        return;
      }

      // Prepare the event data
      const eventData = {
        eventName: eventForm.eventName,
        description: eventForm.description,
        shifts: eventForm.shifts.map(shift => ({
          title: shift.title,
          description: shift.description,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          maxSignUps: shift.maxSignUps
        }))
      };

      let response;
      let successMessage;

      if (isEditMode && eventToEdit) {
        // Update existing event
        response = await api.put(`/shifts/events/${eventToEdit._id}`, eventData);
        successMessage = 'Event updated successfully!';
      } else {
        // Create new event
        response = await api.post('/shifts/events', eventData);
        successMessage = 'Event created successfully!';
      }
      
      if (response.data?.event) {
        const resultEvent = response.data.event;
        
        // Handle task assignment changes
        let taskResult = { success: true, message: '' };
        
        if (isEditMode) {
          try {
            // Use targeted task assignment update (only affects this event's tasks)
            console.log('🔄 Updating task assignments for event:', resultEvent._id);
            
            const taskData: any = {
              assignmentType: eventForm.assignmentType
            };
            
            if (eventForm.assignmentType === 'all') {
              taskData.sendToAllMembers = true;
            } else if (eventForm.assignmentType === 'specific') {
              taskData.memberIds = eventForm.selectedMembers;
            }
            
            console.log('📝 Updating task assignments with data:', taskData);
            const updateResponse = await retryApiCall(
              () => api.put(`/shifts/events/${resultEvent._id}/task-assignments`, taskData),
              3, // 3 retries
              1000 // 1 second delay
            );
            console.log('✅ Task assignment update response:', updateResponse.data);
            
            const { deletedCount, createdCount, membersAdded, membersRemoved, finalMemberCount, noChangesNeeded } = updateResponse.data;
            
            if (noChangesNeeded) {
              taskResult.message = `Task assignments unchanged - already correctly assigned to ${finalMemberCount} members.`;
            } else if (eventForm.assignmentType === 'none') {
              taskResult.message = `Removed all ${deletedCount} task assignments for this event.`;
            } else {
              let messageDetails = [];
              if (deletedCount > 0) {
                messageDetails.push(`removed ${deletedCount} tasks from ${membersRemoved} members`);
              }
              if (createdCount > 0) {
                messageDetails.push(`added ${createdCount} tasks for ${membersAdded} members`);
              }
              
              if (messageDetails.length > 0) {
                taskResult.message = `Updated task assignments: ${messageDetails.join(', ')}. Now assigned to ${finalMemberCount} members.`;
              } else {
                taskResult.message = `Task assignments unchanged - already assigned to ${finalMemberCount} members.`;
              }
            }
            
            if (updateResponse.data.warnings) {
              taskResult.message += ` Warning: ${updateResponse.data.warnings}`;
            }
          } catch (taskError: any) {
            console.error('❌ Task assignment update failed:', taskError);
            taskResult.success = false;
            
            const errorMsg = taskError.response?.data?.message || taskError.message || 'Unknown error';
            taskResult.message = `Task assignment update failed: ${errorMsg}`;
            
            if (taskError.response?.data?.error) {
              taskResult.message += ` (${taskError.response.data.error})`;
            }
          }
        } else {
          // For new events, only create tasks if assignment is not 'none'
          if (eventForm.assignmentType !== 'none') {
            try {
              const taskData: any = {};
              
              if (eventForm.assignmentType === 'all') {
                taskData.sendToAllMembers = true;
              } else if (eventForm.assignmentType === 'specific') {
                taskData.memberIds = eventForm.selectedMembers;
              }
              
              console.log('📝 Creating tasks for new event with data:', taskData);
              const createResponse = await retryApiCall(
                () => api.post(`/shifts/events/${resultEvent._id}/send-task`, taskData),
                3, // 3 retries
                1000 // 1 second delay
              );
              console.log('✅ Task creation response:', createResponse.data);
              
              taskResult.message = `Created ${createResponse.data.tasksCreated || 0} tasks for ${createResponse.data.targetMembers || 0} members.`;
              
              if (createResponse.data.warnings) {
                taskResult.message += ` Warning: ${createResponse.data.warnings}`;
              }
            } catch (taskError: any) {
              console.error('❌ Task assignment failed:', taskError);
              taskResult.success = false;
              
              const errorMsg = taskError.response?.data?.message || taskError.message || 'Unknown error';
              taskResult.message = `Task assignment failed: ${errorMsg}`;
              
              if (taskError.response?.data?.error) {
                taskResult.message += ` (${taskError.response.data.error})`;
              }
            }
          }
        }
        
        // Show appropriate success/warning message
        if (taskResult.success) {
          if (taskResult.message) {
            alert(`${successMessage}\n\nTask Assignment: ${taskResult.message}`);
          } else {
            alert(successMessage);
          }
        } else {
          alert(`${successMessage}\n\nHowever, there was an issue with task assignments:\n${taskResult.message}`);
        }
        
        setShowCreateModal(false);
        resetForm();
        
        // Stay on main tab and reload events
        setActiveTab('main');
        loadEvents();
      } else {
        alert(`Failed to ${isEditMode ? 'update' : 'create'} event. Please try again.`);
      }
    } catch (error: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} event:`, error);
      if (error.response?.status === 403) {
        alert('Access denied. Only camp admins can manage events.');
      } else if (error.response?.status === 400) {
        alert('Invalid data. Please check all required fields are filled.');
      } else if (error.response?.status === 404 && isEditMode) {
        alert('Event not found. It may have been deleted.');
      } else {
        alert(`Error ${isEditMode ? 'updating' : 'creating'} event. Please try again.`);
      }
    }
  };

  const handleAddShift = () => {
    setEventForm(prev => ({
      ...prev,
      shifts: [...prev.shifts, {
        title: '',
        description: '',
        date: '',
        startTime: '',
        endTime: '',
        maxSignUps: 1
      }]
    }));
  };

  const handleRemoveShift = (index: number) => {
    setEventForm(prev => ({
      ...prev,
      shifts: prev.shifts.filter((_, i) => i !== index)
    }));
  };

  const handleShiftChange = (index: number, field: string, value: string | number) => {
    setEventForm(prev => ({
      ...prev,
      shifts: prev.shifts.map((shift, i) => 
        i === index ? { ...shift, [field]: value } : shift
      )
    }));
  };

  const resetForm = () => {
    setEventForm({
      eventName: '',
      description: '',
      shifts: [],
      assignmentType: 'none',
      selectedMembers: []
    });
    setIsEditMode(false);
    setEventToEdit(null);
  };

  const handleEditEvent = (event: Event) => {
    setEventToEdit(event);
    setIsEditMode(true);
    
    // Populate form with event data
    setEventForm({
      eventName: event.eventName,
      description: event.description || '',
      shifts: event.shifts.map(shift => ({
        title: shift.title,
        description: shift.description || '',
        date: new Date(shift.date).toISOString().split('T')[0], // Convert to YYYY-MM-DD format
        startTime: new Date(shift.startTime).toTimeString().slice(0, 5), // Convert to HH:MM format
        endTime: new Date(shift.endTime).toTimeString().slice(0, 5), // Convert to HH:MM format
        maxSignUps: shift.maxSignUps
      })),
      assignmentType: 'none', // Reset assignment for edits
      selectedMembers: []
    });
    
    setShowCreateModal(true);
  };

  // Using shared date formatting utilities


  if (!canAccessShifts) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You do not have permission to access Volunteer Shifts management.</p>
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
            Volunteer Shifts Management
          </h1>
          <p className="text-body text-custom-text-secondary">
            Create and manage volunteer shifts for your camp
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'main' ? 'border-b-2 border-custom-primary text-custom-primary' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('main')}
        >
          Manage Events
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium ${activeTab === 'reports' ? 'border-b-2 border-custom-primary text-custom-primary' : 'text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports
        </button>
      </div>

      {/* Main Content */}
      {activeTab === 'main' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-lato-bold text-custom-text mb-2">
                  Volunteer Events & Shifts
                </h2>
                <p className="text-gray-600">
                  Manage your camp's volunteer events and shifts. Create new events or edit existing ones.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Event
              </Button>
            </div>

            {events.length === 0 ? (
              <div className="text-center py-12">
                <div className="max-w-md mx-auto">
                  <div className="mb-4">
                    <Calendar className="w-16 h-16 mx-auto text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No events created yet</h3>
                  <p className="text-gray-600 mb-6">
                    Get started by creating your first volunteer event. Events can contain multiple shifts that members can sign up for.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Your First Event
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <div key={event._id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-medium text-lg">{event.eventName}</h3>
                        <p className="text-gray-600">{event.description}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          {event.shifts.length} shift{event.shifts.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowManageModal(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditEvent(event)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    {/* Show shift preview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {event.shifts.slice(0, 3).map((shift) => (
                        <div key={shift._id} className="bg-gray-50 rounded p-2 text-sm">
                          <div className="font-medium">{shift.title}</div>
                          <div className="text-gray-600">
                            {formatEventDate(shift.date)}
                          </div>
                          <div className="text-gray-600">
                            {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                          </div>
                          <div className="text-gray-500">
                            {shift.memberIds.length}/{shift.maxSignUps} signed up
                          </div>
                        </div>
                      ))}
                      {event.shifts.length > 3 && (
                        <div className="bg-gray-50 rounded p-2 text-sm text-gray-500 flex items-center justify-center">
                          +{event.shifts.length - 3} more shifts
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-lato-bold text-custom-text mb-4">
              Shift Reports
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Button
                variant={reportType === 'per-person' ? 'primary' : 'outline'}
                onClick={() => setReportType('per-person')}
                className="flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Per-Person Report
              </Button>
              <Button
                variant={reportType === 'per-day' ? 'primary' : 'outline'}
                onClick={() => setReportType('per-day')}
                className="flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Per-Day Report
              </Button>
            </div>
            {reportType === 'per-day' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Date
                </label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-48"
                />
              </div>
            )}
            <Button
              variant="primary"
              onClick={() => setShowReportsModal(true)}
              disabled={reportType === 'per-day' && !selectedDate}
            >
              Generate Report
            </Button>
          </Card>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-lato-bold text-custom-text mb-2">
                Volunteer Shift Reports
              </h2>
              <p className="text-gray-600">
                View participation and assignment data for all volunteer shifts.
              </p>
            </div>

            {events.length === 0 ? (
              <div className="text-center py-12">
                <Calendar size={64} className="text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Events to Report</h3>
                <p className="text-gray-600">Create some volunteer events first to see reporting data.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Per-Person View */}
                <div>
                  <h3 className="text-lg font-lato-bold text-custom-text mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Per-Person View
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">Person Name</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Event Name</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Shift Time</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const signUps: Array<{
                            personName: string;
                            date: string;
                            eventName: string;
                            shiftTime: string;
                            description: string;
                          }> = [];

                          events.forEach(event => {
                            event.shifts.forEach(shift => {
                              if (shift.memberIds && shift.memberIds.length > 0) {
                                shift.memberIds.forEach(memberId => {
                                  // Find member name from roster
                                  const member = rosterMembers.find(m => m._id === memberId);
                                  const memberName = member ? 
                                    `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown Member' : 
                                    'Unknown Member';

                                  signUps.push({
                                    personName: memberName,
                                    date: formatEventDate(shift.date),
                                    eventName: event.eventName,
                                    shiftTime: `${formatTime(shift.startTime)} – ${formatTime(shift.endTime)}`,
                                    description: shift.description || shift.title
                                  });
                                });
                              }
                            });
                          });

                          if (signUps.length === 0) {
                            return (
                              <tr>
                                <td colSpan={5} className="border border-gray-300 px-4 py-8 text-center text-gray-500">
                                  No sign-ups yet
                                </td>
                              </tr>
                            );
                          }

                          return signUps.map((signUp, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-2">{signUp.personName}</td>
                              <td className="border border-gray-300 px-4 py-2">{signUp.date}</td>
                              <td className="border border-gray-300 px-4 py-2">{signUp.eventName}</td>
                              <td className="border border-gray-300 px-4 py-2">{signUp.shiftTime}</td>
                              <td className="border border-gray-300 px-4 py-2">{signUp.description}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Per-Day View */}
                <div>
                  <h3 className="text-lg font-lato-bold text-custom-text mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Per-Day View
                  </h3>
                  <div className="space-y-4">
                    {(() => {
                      // Group shifts by date
                      const shiftsByDate: { [key: string]: Array<{
                        event: any;
                        shift: any;
                        signedUpMembers: string[];
                      }> } = {};

                      events.forEach(event => {
                        event.shifts.forEach(shift => {
                          const dateKey = formatEventDate(shift.date);
                          if (!shiftsByDate[dateKey]) {
                            shiftsByDate[dateKey] = [];
                          }

                          const signedUpMembers = shift.memberIds?.map((memberId: any) => {
                            const member = rosterMembers.find(m => m._id === memberId);
                            return member ? 
                              `${member.firstName || ''} ${member.lastName || ''}`.trim() || 'Unknown Member' : 
                              'Unknown Member';
                          }) || [];

                          shiftsByDate[dateKey].push({
                            event,
                            shift,
                            signedUpMembers
                          });
                        });
                      });

                      const sortedDates = Object.keys(shiftsByDate).sort((a, b) => {
                        const dateA = new Date(a.split(', ')[1] + '/2024');
                        const dateB = new Date(b.split(', ')[1] + '/2024');
                        return dateA.getTime() - dateB.getTime();
                      });

                      if (sortedDates.length === 0) {
                        return (
                          <div className="text-center py-12 text-gray-500">
                            <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                            <p>No shifts scheduled yet</p>
                          </div>
                        );
                      }

                      return sortedDates.map(date => (
                        <div key={date} className="border border-gray-200 rounded-lg">
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                            <h4 className="font-medium text-gray-900">{date}</h4>
                          </div>
                          <div className="p-4">
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left py-2">Event Name</th>
                                    <th className="text-left py-2">Shift Time</th>
                                    <th className="text-left py-2">Description</th>
                                    <th className="text-left py-2">Signed Up Members</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {shiftsByDate[date].map((item, index) => (
                                    <tr key={index} className="border-b border-gray-100 last:border-b-0">
                                      <td className="py-2">{item.event.eventName}</td>
                                      <td className="py-2">
                                        {formatTime(item.shift.startTime)} – {formatTime(item.shift.endTime)}
                                      </td>
                                      <td className="py-2">{item.shift.description || item.shift.title}</td>
                                      <td className="py-2">
                                        {item.signedUpMembers.length > 0 ? (
                                          <div className="flex flex-wrap gap-1">
                                            {item.signedUpMembers.map((memberName, idx) => (
                                              <span key={idx} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                                {memberName}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-gray-500 text-sm">No sign-ups</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Create Event Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title={isEditMode ? `Edit Event: ${eventToEdit?.eventName}` : "Create New Event"}
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Name *
            </label>
            <Input
              value={eventForm.eventName}
              onChange={(e) => setEventForm(prev => ({ ...prev, eventName: e.target.value }))}
              placeholder="Enter event name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={eventForm.description}
              onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
              placeholder="Enter event description"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Shifts</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddShift}
                className="flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Shift
              </Button>
            </div>

            {eventForm.shifts.map((shift, index) => (
              <div key={index} className="border rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">Shift {index + 1}</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveShift(index)}
                    className="text-red-600 border-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title *
                    </label>
                    <Input
                      value={shift.title}
                      onChange={(e) => handleShiftChange(index, 'title', e.target.value)}
                      placeholder="Shift title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Sign-ups *
                    </label>
                    <Input
                      type="number"
                      value={shift.maxSignUps}
                      onChange={(e) => handleShiftChange(index, 'maxSignUps', parseInt(e.target.value) || 1)}
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date *
                    </label>
                    <Input
                      type="date"
                      value={shift.date}
                      onChange={(e) => handleShiftChange(index, 'date', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time *
                    </label>
                    <Input
                      type="time"
                      value={shift.startTime}
                      onChange={(e) => handleShiftChange(index, 'startTime', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time *
                    </label>
                    <Input
                      type="time"
                      value={shift.endTime}
                      onChange={(e) => handleShiftChange(index, 'endTime', e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={shift.description}
                    onChange={(e) => handleShiftChange(index, 'description', e.target.value)}
                    rows={2}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-custom-primary focus:border-transparent"
                    placeholder="Shift description"
                  />
                </div>
              </div>
            ))}

            {eventForm.shifts.length === 0 && (
              <p className="text-gray-500 text-center py-8">
                No shifts added yet. Click "Add Shift" to create your first shift.
              </p>
            )}
          </div>

          {/* Assignment Options */}
          {(
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Task Assignment</h3>
            <p className="text-sm text-gray-600 mb-4">
              {isEditMode 
                ? "Update task assignment for this event. Note: Changing assignment will affect existing tasks sent to members."
                : "Optionally send this event as a task to roster members. Members will see the volunteer shifts in their \"My Tasks\" view."
              }
            </p>
            
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="assignmentType"
                  value="none"
                  checked={eventForm.assignmentType === 'none'}
                  onChange={(e) => setEventForm(prev => ({ ...prev, assignmentType: e.target.value as any }))}
                  className="mr-2"
                />
                <span>Don't send as task</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  name="assignmentType"
                  value="all"
                  checked={eventForm.assignmentType === 'all'}
                  onChange={(e) => setEventForm(prev => ({ ...prev, assignmentType: e.target.value as any }))}
                  className="mr-2"
                />
                <span>Send to entire approved roster ({rosterMembers.length} members)</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  name="assignmentType"
                  value="specific"
                  checked={eventForm.assignmentType === 'specific'}
                  onChange={(e) => setEventForm(prev => ({ ...prev, assignmentType: e.target.value as any }))}
                  className="mr-2"
                />
                <span>Send to specific members</span>
              </label>
            </div>

            {/* Specific Members Selection */}
            {eventForm.assignmentType === 'specific' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Members ({eventForm.selectedMembers.length} selected)
                </label>
                {loadingMembers ? (
                  <p className="text-gray-500">Loading members...</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                    {rosterMembers.map((member) => (
                      <label key={member._id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={eventForm.selectedMembers.includes(member._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEventForm(prev => ({
                                ...prev,
                                selectedMembers: [...prev.selectedMembers, member._id]
                              }));
                            } else {
                              setEventForm(prev => ({
                                ...prev,
                                selectedMembers: prev.selectedMembers.filter(id => id !== member._id)
                              }));
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">
                          {member.firstName || member.lastName 
                            ? `${member.firstName} ${member.lastName}`.trim()
                            : member.email
                          } ({member.email})
                        </span>
                      </label>
                    ))}
                    {rosterMembers.length === 0 && (
                      <p className="text-gray-500 text-sm">No approved members found in roster.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateEvent}
              disabled={
                !eventForm.eventName || 
                eventForm.shifts.length === 0 ||
                (eventForm.assignmentType === 'specific' && eventForm.selectedMembers.length === 0)
              }
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              {isEditMode ? 'Update Event' : 'Create Event'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Manage Event Details Modal */}
      <Modal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        title={selectedEvent ? `Event Details: ${selectedEvent.eventName}` : 'Event Details'}
        size="lg"
      >
        <div className="space-y-6">
          {selectedEvent && (
            <>
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold">{selectedEvent.eventName}</h3>
                <p className="text-gray-600 mt-1">{selectedEvent.description}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Created: {new Date(selectedEvent.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-3">Shifts ({selectedEvent.shifts.length})</h4>
                <div className="space-y-3">
                  {selectedEvent.shifts.map((shift) => (
                    <div key={shift._id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <h5 className="font-medium">{shift.title}</h5>
                        <span className="text-sm text-gray-500">
                          {shift.memberIds.length}/{shift.maxSignUps} signed up
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{shift.description}</p>
                      <div className="text-sm text-gray-500">
                        <div>{formatDate(shift.date)}</div>
                        <div>{formatTime(shift.startTime)} - {formatTime(shift.endTime)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => setShowManageModal(false)}
            className="flex-1"
          >
            Close
          </Button>
        </div>
      </Modal>

      {/* Reports Modal */}
      <Modal
        isOpen={showReportsModal}
        onClose={() => setShowReportsModal(false)}
        title={`${reportType === 'per-person' ? 'Per-Person' : 'Per-Day'} Report`}
        size="lg"
      >
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium mb-2">Report Configuration</h3>
            <p className="text-sm text-gray-600">
              {reportType === 'per-person' 
                ? 'This report shows each member and all shifts they are working.'
                : `This report shows all shifts scheduled for ${selectedDate ? formatDate(selectedDate) : 'the selected date'} and all members signed up for each shift.`
              }
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Person Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shift Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No data available. Create events and have members sign up to generate reports.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setShowReportsModal(false)}
              className="flex-1"
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default VolunteerShifts;
