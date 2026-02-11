import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import { Card, Table, TableColumn, Modal, Badge, Button } from '../../components/ui';
import { formatDate, formatEventDate, formatShiftDate, formatShiftTime } from '../../utils/dateFormatters';
import {
  ClipboardList as Assignment,
  CheckCircle as CheckCircleIcon,
  Clock,
  Eye,
  RefreshCw as Refresh,
  Calendar,
  Users,
  UserPlus,
  UserCheck,
} from 'lucide-react';

interface Task {
  _id: string;
  campId: string;
  title: string;
  description: string;
  assignedTo: string[];
  dueDate?: string;
  status: 'open' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  completedAt?: string;
  completedBy?: string;
  type?: string;
  taskIdCode?: string;
  metadata?: {
    eventId?: string;
    shiftId?: string;
    eventName?: string;
    shiftTitle?: string;
  };
  camp?: {
    _id: string;
    campName: string;
    slug?: string;
  };
}

const MyTasks: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [eventData, setEventData] = useState<any>(null);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [signUpLoading, setSignUpLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchMyTasks();
    }
  }, [user]);

  // Refresh tasks when component becomes visible (user navigates back to page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        fetchMyTasks();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

  const fetchMyTasks = async () => {
    try {
      setLoading(true);
      // Fetch tasks assigned to the current user with cache-busting to ensure fresh camp data
      const response = await apiService.get('/tasks/my-tasks', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      // Normalize payload in case API returns raw Mongoose docs
      const normalized = (response || []).map((item: any) => {
        // If payload looks like a Mongoose doc wrapper, unwrap
        const task = item?._doc ? { ...item._doc, camp: item.camp } : item;

        // Ensure camp shape and derive a readable name
        const camp = task.camp || null;
        const campName = camp?.campName || camp?.name || (camp?.slug ? camp.slug.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : undefined);

        return {
          ...task,
          camp: camp ? { ...camp, campName } : null
        } as Task & { camp?: any };
      });

      setTasks(normalized);
    } catch (error) {
      console.error('Error fetching my tasks:', error);
      setError('Failed to load your tasks');
    } finally {
      setLoading(false);
    }
  };

  const loadEventShifts = async (eventId: string) => {
    try {
      setLoadingShifts(true);
      console.log('🔍 [MyTasks] Loading event shifts for eventId:', eventId);
      const response = await apiService.get(`/shifts/events/${eventId}`);
      console.log('✅ [MyTasks] Event shifts response:', response);
      setEventData(response);
    } catch (error) {
      console.error('❌ [MyTasks] Error loading event shifts:', error);
      console.error('❌ [MyTasks] Error details:', error);
      setEventData(null);
    } finally {
      setLoadingShifts(false);
    }
  };

  const loadEventShiftsFromTaskDescription = async (task: Task) => {
    try {
      setLoadingShifts(true);
      console.log('🔍 [MyTasks] Trying to find event from task description:', task.title);
      
      // Extract shift title from task title
      const shiftTitle = task.title.replace(/^Volunteer Shift:\s*/i, '');
      console.log('📝 [MyTasks] Extracted shift title:', shiftTitle);
      
      // Try to find events that contain this shift
      // Get all events for camps the user is a member of
      const eventsResponse = await apiService.get('/tasks/my-events');
      console.log('📅 [MyTasks] All events response:', eventsResponse);
      
      if (eventsResponse && eventsResponse.events) {
        // Find event that contains a shift with matching title
        const matchingEvent = eventsResponse.events.find((event: any) => {
          return event.shifts && event.shifts.some((shift: any) => 
            shift.title === shiftTitle
          );
        });
        
        if (matchingEvent) {
          console.log('✅ [MyTasks] Found matching event:', matchingEvent.eventName);
          setEventData(matchingEvent);
        } else {
          console.log('⚠️ [MyTasks] No matching event found for shift:', shiftTitle);
          setEventData(null);
        }
      } else {
        console.log('⚠️ [MyTasks] No events found');
        setEventData(null);
      }
    } catch (error) {
      console.error('❌ [MyTasks] Error finding event from task description:', error);
      setEventData(null);
    } finally {
      setLoadingShifts(false);
    }
  };

  const handleViewTask = async (task: Task) => {
    // Check if this is a volunteer shift task (by type or title pattern)
    const isVolunteerShiftTask = task.type === 'volunteer_shift' || 
      task.title.toLowerCase().startsWith('volunteer shift:');
    
    // For regular tasks, navigate to TaskDetailsPage if taskIdCode exists
    if (!isVolunteerShiftTask && task.taskIdCode) {
      navigate(`/tasks/${task.taskIdCode}`);
      return;
    }
    
    // For volunteer shift tasks or tasks without taskIdCode, show modal
    setSelectedTask(task);
    setViewDialogOpen(true);
    
    if (isVolunteerShiftTask && task.metadata?.eventId) {
      await loadEventShifts(task.metadata.eventId);
    } else if (isVolunteerShiftTask) {
      // Try to extract event information from the task description
      await loadEventShiftsFromTaskDescription(task);
    } else {
      setEventData(null);
    }
  };

  const handleCloseViewDialog = () => {
    setSelectedTask(null);
    setViewDialogOpen(false);
    setEventData(null);
  };

  const handleSignUpForShift = async (shiftId: string) => {
    try {
      setSignUpLoading(shiftId);
      
      const response = await apiService.post(`/shifts/shifts/${shiftId}/signup`);
      
      // The API service post method returns response.data, so we check for the message
      if (response.message === 'Successfully signed up for shift') {
        // Refresh the event data to show updated sign-up counts
        if (selectedTask?.metadata?.eventId) {
          await loadEventShifts(selectedTask.metadata.eventId);
        } else if (eventData) {
          // If we found the event through task description matching, reload it
          await loadEventShiftsFromTaskDescription(selectedTask!);
        }
        
        // Refresh tasks to update status if this was the first sign-up
        await fetchMyTasks();
        
        // Show success message (you might want to replace this with a toast)
        alert('Successfully signed up for shift!');
      }
    } catch (error: any) {
      console.error('Error signing up for shift:', error);
      
      if (error.response?.status === 409) {
        alert('Sorry, this shift is now full. Please try a different shift.');
      } else if (error.response?.status === 403) {
        alert('You are not authorized to sign up for this shift.');
      } else {
        alert('Failed to sign up for shift. Please try again.');
      }
    } finally {
      setSignUpLoading(null);
    }
  };

  const getPriorityVariant = (priority: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
    switch (priority) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'neutral';
    }
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
    switch (status) {
      case 'open': return 'success';
      case 'closed': return 'neutral';
      default: return 'neutral';
    }
  };

  // Using shared date formatting utilities

  const getCampDisplayName = (camp: any | undefined | null): string => {
    if (!camp) return 'Unknown Camp';
    if (camp.campName) return camp.campName;
    if (camp.name) return camp.name;
    if (camp.slug) {
      const formatted = camp.slug
        .toString()
        .split('-')
        .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      return formatted || 'Unknown Camp';
    }
    return 'Unknown Camp';
  };

  const isUserSignedUp = (shift: any) => {
    return shift.memberIds && shift.memberIds.includes(user?._id);
  };

  const isShiftFull = (shift: any) => {
    return shift.memberIds && shift.memberIds.length >= shift.maxSignUps;
  };

  const getRemainingSpots = (shift: any) => {
    const signedUp = shift.memberIds?.length || 0;
    const max = shift.maxSignUps || 0;
    return Math.max(max - signedUp, 0);
  };

  const columns: TableColumn<Task>[] = [
    {
      key: 'title',
      title: 'Task',
      render: (_, task) => (
        <div>
          <div className="font-work font-medium text-custom-text mb-1">
            {task.title}
          </div>
          <div className="text-xs text-gray-500 line-clamp-2 max-w-xs">
            {task.description}
          </div>
        </div>
      ),
    },
    {
      key: 'camp',
      title: 'Camp',
      render: (_, task) => (
        <div className="font-work font-medium text-custom-text">
          {getCampDisplayName(task.camp)}
        </div>
      ),
    },
    {
      key: 'priority',
      title: 'Priority',
      render: (_, task) => (
        <Badge variant={getPriorityVariant(task.priority)}>
          {task.priority}
        </Badge>
      ),
    },
    {
      key: 'dueDate',
      title: 'Due Date',
      render: (_, task) => (
        <div className="text-sm text-custom-text">
          {task.dueDate ? formatEventDate(task.dueDate) : (
            <span className="text-gray-500">No due date</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      render: (_, task) => (
        <Badge variant={getStatusVariant(task.status)}>
          <div className="flex items-center gap-1">
            {task.status === 'open' ? <Clock size={12} /> : <CheckCircleIcon size={12} />}
            {task.status}
          </div>
        </Badge>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, task) => (
        <button
          onClick={() => handleViewTask(task)}
          className="p-2 text-custom-primary hover:bg-gray-100 rounded-lg transition-colors duration-200"
          title="View Details"
        >
          <Eye size={16} />
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-center min-h-96">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-h1 font-lato font-bold text-custom-text">
          My Tasks
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Tasks assigned to you by your camp
          </span>
          <button
            onClick={fetchMyTasks}
            disabled={loading}
            className="p-2 text-custom-primary hover:bg-gray-100 rounded-lg transition-colors duration-200 disabled:opacity-50"
            title="Refresh tasks"
          >
            <Refresh size={20} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex justify-between items-center">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <Card className="text-center">
          <div className="py-12">
            <Assignment size={64} className="text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-lato font-bold text-gray-600 mb-2">
              No tasks assigned to you yet
            </h3>
            <p className="text-sm text-gray-500">
              Your camp leaders will assign tasks to you here when they're available
            </p>
          </div>
        </Card>
      ) : (
        <Table
          columns={columns}
          data={tasks}
          loading={loading}
          emptyText="No tasks found"
          onRowClick={(task) => handleViewTask(task)}
        />
      )}

      {/* Task Details Modal */}
      <Modal
        isOpen={viewDialogOpen}
        onClose={handleCloseViewDialog}
        title="Task Details"
        size="md"
      >
        {selectedTask && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-lato font-bold text-custom-text mb-3">
                {selectedTask.title}
              </h2>
              <div className="flex gap-2 mb-4">
                <Badge variant={getPriorityVariant(selectedTask.priority)}>
                  {selectedTask.priority}
                </Badge>
                <Badge variant={getStatusVariant(selectedTask.status)}>
                  <div className="flex items-center gap-1">
                    {selectedTask.status === 'open' ? <Clock size={12} /> : <CheckCircleIcon size={12} />}
                    {selectedTask.status}
                  </div>
                </Badge>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-lato font-bold text-custom-text mb-2">
                Description
              </h3>
              <p className="text-gray-600">
                {selectedTask.description}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-lato font-bold text-custom-text mb-2">
                Camp
              </h3>
              <p className="text-gray-600">
                {selectedTask.camp?.campName || 'Unknown Camp'}
              </p>
            </div>

            {selectedTask.dueDate && (
              <div>
                <h3 className="text-lg font-lato font-bold text-custom-text mb-2">
                  Due Date
                </h3>
                <p className="text-gray-600">
                  {formatEventDate(selectedTask.dueDate)}
                </p>
              </div>
            )}

            {/* Volunteer Shift Sign-Up Interface */}
            {(selectedTask.type === 'volunteer_shift' || selectedTask.title.toLowerCase().startsWith('volunteer shift:')) && (
              <div>
                <h3 className="text-lg font-lato font-bold text-custom-text mb-3 flex items-center gap-2">
                  <Calendar size={20} />
                  Available Shifts
                </h3>
                
                {loadingShifts ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="spinner" />
                    <span className="ml-2 text-gray-600">Loading shifts...</span>
                  </div>
                ) : eventData ? (
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-1">{eventData.eventName}</h4>
                      {eventData.description && (
                        <p className="text-sm text-blue-700">{eventData.description}</p>
                      )}
                      <p className="text-xs text-blue-700 mt-2">All shift times are shown in PT.</p>
                    </div>
                    
                    <div className="space-y-3">
                      {(() => {
                        const now = new Date();
                        const upcomingShifts = (eventData.shifts || [])
                          .filter((shift: any) => {
                            const endTime = shift.endTime ? new Date(shift.endTime) : new Date(shift.date);
                            return endTime >= now;
                          })
                          .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

                        if (upcomingShifts.length === 0) {
                          return (
                            <div className="text-sm text-gray-500">
                              No upcoming shifts available.
                            </div>
                          );
                        }

                        return upcomingShifts.map((shift: any) => {
                          const signedUp = isUserSignedUp(shift);
                          const isFull = isShiftFull(shift);
                          const isTaskCompleted = selectedTask.status === 'closed';
                          const maxSignUps = shift.maxSignUps || 0;
                          const currentSignUps = shift.memberIds?.length || 0;
                          const remainingSpots = Math.max(maxSignUps - currentSignUps, 0);

                          return (
                            <div key={shift._id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h5 className="font-medium text-gray-900 mb-2">{shift.title}</h5>
                                {shift.description && (
                                  <p className="text-sm text-gray-600 mb-3">{shift.description}</p>
                                )}
                                
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                                  <div className="flex items-center gap-1">
                                    <Calendar size={14} className="text-gray-500" />
                                    <span>{formatShiftDate(shift.date)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock size={14} className="text-gray-500" />
                                    <span>{formatShiftTime(shift.startTime)} - {formatShiftTime(shift.endTime)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Users size={14} className="text-gray-500" />
                                    <span>{currentSignUps}/{maxSignUps} signed up</span>
                                  </div>
                                  <div className="flex items-center gap-1 text-gray-600">
                                    <span>
                                      {remainingSpots === 0
                                        ? 'Full'
                                        : `${remainingSpots} spot${remainingSpots === 1 ? '' : 's'} remaining`}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="ml-4">
                                {signedUp ? (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    disabled
                                    className="flex items-center gap-1"
                                  >
                                    <UserCheck size={16} />
                                    Signed Up
                                  </Button>
                                ) : isTaskCompleted ? (
                                  <div className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded">
                                    Read Only
                                  </div>
                                ) : isFull ? (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled
                                    className="flex items-center gap-1"
                                  >
                                    <Users size={16} />
                                    Full
                                  </Button>
                                ) : (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleSignUpForShift(shift._id)}
                                    disabled={signUpLoading === shift._id}
                                    className="flex items-center gap-1"
                                  >
                                    {signUpLoading === shift._id ? (
                                      <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Signing Up...
                                      </>
                                    ) : (
                                      <>
                                        <UserPlus size={16} />
                                        Sign Up
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    
                    {selectedTask.status === 'closed' && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <CheckCircleIcon size={16} className="text-green-600" />
                          <span className="text-green-800 font-medium">Task Completed</span>
                        </div>
                        <p className="text-sm text-green-700 mt-1">
                          You have successfully signed up for one or more shifts in this event.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                    <p>Unable to load shift information</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <h3 className="text-lg font-lato font-bold text-custom-text mb-3">
                Task Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Created</p>
                  <p className="text-sm text-custom-text">
                    {formatDate(selectedTask.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Last Updated</p>
                  <p className="text-sm text-custom-text">
                    {formatDate(selectedTask.updatedAt)}
                  </p>
                </div>
                {selectedTask.completedAt && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Completed</p>
                    <p className="text-sm text-custom-text">
                      {formatDate(selectedTask.completedAt)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MyTasks;