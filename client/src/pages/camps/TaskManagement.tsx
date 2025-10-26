import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Card, Badge, Modal, Input, Textarea } from '../../components/ui';
import { Plus, Edit, Trash2, Loader2, RefreshCw, CheckCircle, Clock, X, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatEventDate, formatTaskHistoryTimestamp } from '../../utils/dateFormatters';
import { Task as GlobalTask, User as GlobalUser, TaskHistoryEntry } from '../../types';

// Helper function to safely get user array from assignedTo/watchers
const getUserArray = (field: string[] | GlobalUser[] | undefined): GlobalUser[] => {
  if (!field) return [];
  if (field.length === 0) return [];
  // Check if first element is a string (ID) or object (populated User)
  if (typeof field[0] === 'string') return [];
  return field as GlobalUser[];
};

// Helper function to get user object from createdBy/completedBy
const getUser = (field: string | GlobalUser | undefined): GlobalUser | null => {
  if (!field) return null;
  if (typeof field === 'string') return null;
  return field as GlobalUser;
};

// Helper function to render history entry text
const renderHistoryText = (entry: TaskHistoryEntry): string => {
  const user = getUser(entry.user);
  const userName = user ? `${user.firstName} ${user.lastName}` : 'Someone';
  
  switch (entry.action) {
    case 'created':
      return `${userName} created this task`;
    case 'updated':
      if (entry.field === 'title') {
        return `${userName} changed title from "${entry.oldValue}" to "${entry.newValue}"`;
      } else if (entry.field === 'description') {
        return `${userName} updated the description`;
      } else if (entry.field === 'priority') {
        return `${userName} changed priority from ${entry.oldValue} to ${entry.newValue}`;
      } else if (entry.field === 'dueDate') {
        const oldDate = entry.oldValue ? formatEventDate(entry.oldValue) : 'none';
        const newDate = entry.newValue ? formatEventDate(entry.newValue) : 'none';
        return `${userName} changed due date from ${oldDate} to ${newDate}`;
      }
      return `${userName} updated ${entry.field}`;
    case 'closed':
      return `${userName} closed this task`;
    case 'reopened':
      return `${userName} reopened this task`;
    case 'assigned':
      const assignee = getUser(entry.newValue);
      return `${userName} assigned ${assignee ? `${assignee.firstName} ${assignee.lastName}` : 'a member'} to this task`;
    case 'unassigned':
      const unassignee = getUser(entry.oldValue);
      return `${userName} removed ${unassignee ? `${unassignee.firstName} ${unassignee.lastName}` : 'a member'} from this task`;
    case 'added_watcher':
      const watcher = getUser(entry.newValue);
      return `${userName} added ${watcher ? `${watcher.firstName} ${watcher.lastName}` : 'a member'} as a watcher`;
    case 'removed_watcher':
      const removedWatcher = getUser(entry.oldValue);
      return `${userName} removed ${removedWatcher ? `${removedWatcher.firstName} ${removedWatcher.lastName}` : 'a member'} from watchers`;
    default:
      return `${userName} performed an action`;
  }
};

const TaskManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tasks, setTasks] = useState<GlobalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [campId, setCampId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: ''
  });
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedTask, setSelectedTask] = useState<GlobalTask | null>(null);
  const [editTask, setEditTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: '',
    status: 'open' as 'open' | 'closed',
    assignedTo: [] as string[],
    watchers: [] as string[]
  });
  const [rosterMembers, setRosterMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchCampData = async () => {
    try {
      const campData = await api.getMyCamp();
      setCampId(campData._id.toString());
    } catch (err) {
      console.error('Error fetching camp data:', err);
      setError('Failed to load camp data');
    }
  };

  const fetchTasks = useCallback(async () => {
    if (!campId) return;
    
    try {
      setLoading(true);
      const response = await api.getTasks(campId);
      // Filter out event tasks (only show regular tasks)
      const regularTasks = response.filter((task: any) => !task.type || task.type !== 'event');
      setTasks(regularTasks as GlobalTask[]);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [campId]);

  useEffect(() => {
    if (user?.campId) {
      fetchCampData();
    }
  }, [user?.campId]);

  // Handle editTaskId from location state (for personal accounts)
  useEffect(() => {
    const handleEditFromState = async () => {
      if (location.state?.editTaskId && !campId) {
        // Use campId from location state if available
        if (location.state.campId) {
          setCampId(location.state.campId);
          // Wait for tasks to load, then open the task in edit mode
          setTimeout(() => {
            const taskToEdit = tasks.find(t => t._id === location.state.editTaskId);
            if (taskToEdit) {
              handleTaskClick(taskToEdit);
            }
          }, 500);
        } else {
          // Fallback: try to find the task in assigned tasks
          try {
            const assignedTasks = await api.get(`/tasks/assigned/${user?._id}`);
            const taskToEdit = assignedTasks.find((t: any) => t._id === location.state.editTaskId);
            
            if (taskToEdit && taskToEdit.campId) {
              setCampId(taskToEdit.campId);
              // Wait for tasks to load, then open the task in edit mode
              setTimeout(() => {
                const taskToEditAfterLoad = tasks.find(t => t._id === location.state.editTaskId);
                if (taskToEditAfterLoad) {
                  handleTaskClick(taskToEditAfterLoad);
                }
              }, 500);
            }
          } catch (err) {
            console.error('Error loading task for editing:', err);
          }
        }
      }
    };
    handleEditFromState();
  }, [location.state, campId, tasks, user?._id]);

  useEffect(() => {
    if (campId) {
      fetchTasks();
    }
  }, [campId, fetchTasks]);


  const loadRosterMembers = useCallback(async () => {
    if (!campId) {
      console.log('⚠️ [TaskManagement] No campId available for loading roster');
      return;
    }
    
    // Always reload roster members when called
    try {
      setLoadingMembers(true);
      console.log('🔄 [TaskManagement] Loading roster members for camp:', campId);
      const response = await api.get(`/rosters/camp/${campId}`);
      console.log('✅ [TaskManagement] Roster response:', response);
      
      if (response.data && response.data.members) {
        console.log('📋 [TaskManagement] Members from response.data.members:', response.data.members);
        setRosterMembers(response.data.members);
      } else if (response.members) {
        console.log('📋 [TaskManagement] Members from response.members:', response.members);
        setRosterMembers(response.members);
      } else if (Array.isArray(response)) {
        console.log('📋 [TaskManagement] Response is array, using directly:', response);
        setRosterMembers(response);
      } else {
        console.warn('⚠️ [TaskManagement] No members found in response');
        setRosterMembers([]);
      }
    } catch (err: any) {
      console.error('❌ [TaskManagement] Error loading roster members:', err);
      console.error('❌ [TaskManagement] Error details:', err.response?.data || err.message);
      setRosterMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [campId]);

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

  const filteredTasks = tasks.filter(task => task.status === activeTab);

  const handleTaskClick = useCallback(async (task: GlobalTask) => {
    setSelectedTask(task);
    const assignees = getUserArray(task.assignedTo);
    const taskWatchers = getUserArray(task.watchers);
    setEditTask({
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate || '',
      status: task.status,
      assignedTo: assignees.map(u => u._id.toString()),
      watchers: taskWatchers.map(u => u._id.toString())
    });
    setIsEditMode(false);
    setShowTaskModal(true);
    
    // Load roster members for assign/watchers dropdowns
    console.log('🔄 [TaskManagement] Loading roster members for task modal');
    await loadRosterMembers();
  }, [loadRosterMembers]);

  // Check if we need to open a specific task in edit mode
  useEffect(() => {
    if (location.state?.editTaskId && tasks.length > 0) {
      const taskToEdit = tasks.find(task => task._id === location.state.editTaskId);
      if (taskToEdit) {
        handleTaskClick(taskToEdit);
        setIsEditMode(true);
        // Clear the state to prevent re-opening on refresh
        navigate(location.pathname, { replace: true });
      }
    }
  }, [location.state, tasks, navigate, handleTaskClick, location.pathname]);

  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleCloseTask = async () => {
    if (!selectedTask) return;
    
    try {
      await api.updateTask(selectedTask._id, { status: 'closed' });
      await fetchTasks();
      setShowTaskModal(false);
      setSelectedTask(null);
    } catch (err) {
      console.error('Error closing task:', err);
      setError('Failed to close task');
    }
  };

  const handleReopenTask = async () => {
    if (!selectedTask) return;
    
    try {
      await api.updateTask(selectedTask._id, { status: 'open' });
      await fetchTasks();
      setShowTaskModal(false);
      setSelectedTask(null);
    } catch (err) {
      console.error('Error reopening task:', err);
      setError('Failed to reopen task');
    }
  };

  const handleSaveTask = async () => {
    if (!selectedTask) return;

    try {
      console.log('🔄 [TaskManagement] Updating task:', selectedTask._id, 'with data:', editTask);
      const updatedTask = await api.updateTask(selectedTask._id, editTask);
      console.log('✅ [TaskManagement] Task updated successfully:', updatedTask);
      
      // Refresh the tasks list
      await fetchTasks();
      
      // Update the selected task with the new data
      setSelectedTask(updatedTask);
      setIsEditMode(false);
    } catch (err: any) {
      console.error('❌ [TaskManagement] Error updating task:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update task';
      setError(errorMessage);
      alert(`Failed to update task: ${errorMessage}`);
    }
  };

  const handleCreateTask = async () => {
    if (!campId || !newTask.title.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setCreateLoading(true);
      console.log('🔄 [TaskManagement] Creating task with creator auto-assigned');
      
      // Auto-assign the task creator
      await api.createTask({
        ...newTask,
        campId,
        assignedTo: [user?._id] // Auto-assign creator
      });
      
      console.log('✅ [TaskManagement] Task created with creator assigned');
      
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: ''
      });
      setShowCreateModal(false);
      await fetchTasks();
    } catch (err) {
      console.error('❌ [TaskManagement] Error creating task:', err);
      setError('Failed to create task');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      await api.deleteTask(taskId);
      await fetchTasks();
      setShowTaskModal(false);
      setSelectedTask(null);
    } catch (err) {
      console.error('Error deleting task:', err);
      setError('Failed to delete task');
    }
  };

  const handleAddComment = async () => {
    if (!selectedTask || !newComment.trim()) return;

    try {
      setSubmittingComment(true);
      console.log('🔄 [TaskManagement] Adding comment to task:', selectedTask._id);
      const comment = await api.postTaskComment(selectedTask._id, newComment.trim());
      console.log('✅ [TaskManagement] Comment added successfully:', comment);
      
      // Update selected task with new comment
      setSelectedTask({
        ...selectedTask,
        comments: [...(selectedTask.comments || []), comment]
      });
      
      setNewComment('');
    } catch (err: any) {
      console.error('❌ [TaskManagement] Error adding comment:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to add comment';
      setError(errorMessage);
      alert(`Failed to add comment: ${errorMessage}`);
    } finally {
      setSubmittingComment(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    setEditTask(prev => ({
      ...prev,
      assignedTo: prev.assignedTo.includes(userId)
        ? prev.assignedTo.filter(id => id !== userId)
        : [...prev.assignedTo, userId]
    }));
  };

  const toggleWatcher = (userId: string) => {
    setEditTask(prev => ({
      ...prev,
      watchers: prev.watchers.includes(userId)
        ? prev.watchers.filter(id => id !== userId)
        : [...prev.watchers, userId]
    }));
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-h1 font-lato-bold text-custom-text mb-2">
            Task Management
          </h1>
          <p className="text-body text-custom-text-secondary">
            Create and manage camp tasks
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={fetchTasks}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            className="flex items-center gap-2"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4" />
            Create Task
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Task Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('open')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'open'
                  ? 'border-custom-primary text-custom-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Open Tasks ({tasks.filter(t => t.status === 'open').length})
            </button>
            <button
              onClick={() => setActiveTab('closed')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'closed'
                  ? 'border-custom-primary text-custom-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Archived ({tasks.filter(t => t.status === 'closed').length})
            </button>
          </nav>
        </div>
      </div>

      {/* Tasks List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Task
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned To
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Watchers
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTasks.map((task) => (
                <tr key={task._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div 
                        className={`text-sm font-medium ${task.taskIdCode ? 'text-custom-primary hover:underline cursor-pointer' : 'text-gray-900'}`}
                        onClick={() => task.taskIdCode && navigate(`/tasks/${task.taskIdCode}`)}
                      >
                        {task.title}
                      </div>
                      {task.taskIdCode && (
                        <div className="text-xs text-gray-400 font-mono mb-1 flex items-center gap-2">
                          {task.taskIdCode}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(`${window.location.origin}/tasks/${task.taskIdCode}`);
                              alert('Task URL copied to clipboard!');
                            }}
                            className="text-xs text-custom-primary hover:text-custom-primary-dark hover:underline"
                            title="Copy task URL"
                          >
                            [copy]
                          </button>
                        </div>
                      )}
                      <div className="text-sm text-gray-500 line-clamp-2 max-w-xs">
                        {task.description}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={getPriorityVariant(task.priority)}>
                      {task.priority}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={getStatusVariant(task.status)}>
                      <div className="flex items-center gap-1">
                        {task.status === 'open' ? <Clock size={12} /> : <CheckCircle size={12} />}
                        {task.status}
                      </div>
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {task.dueDate ? formatEventDate(task.dueDate) : (
                      <span className="text-gray-500">No due date</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {getUserArray(task.assignedTo).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {getUserArray(task.assignedTo).map((assignee, idx) => (
                          <span key={assignee._id} className="text-gray-700">
                            {assignee.firstName} {assignee.lastName}
                            {idx < getUserArray(task.assignedTo).length - 1 && ','}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500">Not assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {getUserArray(task.watchers).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {getUserArray(task.watchers).map((watcher, idx) => (
                          <span key={watcher._id} className="text-gray-700">
                            {watcher.firstName} {watcher.lastName}
                            {idx < getUserArray(task.watchers).length - 1 && ','}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View/Edit Task Modal */}
      {showTaskModal && selectedTask && (
        <Modal
          isOpen={showTaskModal}
          onClose={() => {
            setShowTaskModal(false);
            setSelectedTask(null);
            setIsEditMode(false);
          }}
          title={isEditMode ? 'Edit Task' : 'Task Details'}
          size="lg"
        >
          <div className="space-y-6">
            {!isEditMode ? (
              /* VIEW MODE */
              <>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedTask.title}</h2>
                  <p className="text-gray-600">{selectedTask.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Priority</label>
                    <div className="mt-1">
                      <Badge variant={getPriorityVariant(selectedTask.priority)}>
                        {selectedTask.priority}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div className="mt-1">
                      <Badge variant={getStatusVariant(selectedTask.status)}>
                        {selectedTask.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Due Date</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {selectedTask.dueDate ? formatEventDate(selectedTask.dueDate) : 'No due date'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created By</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {getUser(selectedTask.createdBy)?.firstName} {getUser(selectedTask.createdBy)?.lastName}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">Assigned To</label>
                  {getUserArray(selectedTask.assignedTo).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {getUserArray(selectedTask.assignedTo).map(assignee => (
                        <Badge key={assignee._id} variant="info">
                          {assignee.firstName} {assignee.lastName}
                          {assignee.playaName && ` (${assignee.playaName})`}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No one assigned</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">Watchers</label>
                  {getUserArray(selectedTask.watchers).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {getUserArray(selectedTask.watchers).map(watcher => (
                        <Badge key={watcher._id} variant="neutral">
                          {watcher.firstName} {watcher.lastName}
                          {watcher.playaName && ` (${watcher.playaName})`}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No watchers</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 mb-2 block">Task History</label>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {selectedTask.history && selectedTask.history.length > 0 ? (
                      selectedTask.history.map((entry, idx) => (
                        <div key={idx} className="flex gap-3 text-sm">
                          <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-custom-primary"></div>
                          <div className="flex-1">
                            <p className="text-gray-900">{renderHistoryText(entry)}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatTaskHistoryTimestamp(entry.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">No history available</p>
                    )}
                  </div>
                </div>

                {/* Comments Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Comments</h3>
                  <div className="space-y-4 mb-4 max-h-60 overflow-y-auto">
                    {selectedTask.comments && selectedTask.comments.length > 0 ? (
                      selectedTask.comments.map((comment, idx) => (
                        <div key={comment._id || idx} className="border-l-4 border-gray-300 pl-4 py-2">
                          <div className="mb-1">
                            <span className="font-medium text-sm text-gray-900">
                              {comment.user ? `${comment.user.firstName} ${comment.user.lastName}` : 'Unknown User'}
                              {comment.user?.playaName && ` (${comment.user.playaName})`}
                            </span>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {formatTaskHistoryTimestamp(comment.createdAt)}
                            </p>
                          </div>
                          <p className="text-sm text-gray-700">{comment.text}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">No comments yet</p>
                    )}
                  </div>

                  {/* Add Comment */}
                  <div className="flex gap-2">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      rows={2}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || submittingComment}
                      size="sm"
                      className="self-end"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={handleEditClick} className="flex items-center gap-2">
                    <Edit className="w-4 h-4" />
                    Edit
                  </Button>
                  {selectedTask.status === 'open' ? (
                    <Button 
                      onClick={handleCloseTask}
                      variant="outline"
                      className="flex items-center gap-2 text-orange-600 border-orange-600 hover:bg-orange-50"
                    >
                      <X className="w-4 h-4" />
                      Close Task
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleReopenTask}
                      variant="outline"
                      className="flex items-center gap-2 text-green-600 border-green-600 hover:bg-green-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Re-Open
                    </Button>
                  )}
                  <Button
                    onClick={() => handleDeleteTask(selectedTask._id)}
                    variant="outline"
                    className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50 ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </>
            ) : (
              /* EDIT MODE */
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <Input
                    value={editTask.title}
                    onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
                    placeholder="Task title"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <Textarea
                    value={editTask.description}
                    onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
                    placeholder="Task description"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={editTask.priority}
                      onChange={(e) => setEditTask({ ...editTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-custom-primary"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <Input
                      type="date"
                      value={editTask.dueDate}
                      onChange={(e) => setEditTask({ ...editTask, dueDate: e.target.value })}
                    />
                  </div>
                </div>

                {/* Assign Members */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign To ({editTask.assignedTo.length} selected)
                  </label>
                  {loadingMembers ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-custom-primary" />
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
                      {rosterMembers.map((member) => {
                        const userId = member.user?._id?.toString();
                        return (
                          <label key={userId || member._id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editTask.assignedTo.includes(userId)}
                              onChange={() => toggleAssignee(userId)}
                              className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                            />
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {member.user?.firstName} {member.user?.lastName}
                                {member.user?.playaName && (
                                  <span className="text-gray-500 ml-2">({member.user.playaName})</span>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                      {rosterMembers.length === 0 && (
                        <div className="text-center py-4 text-gray-500">
                          No roster members found
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Watchers */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Watchers ({editTask.watchers.length} selected)
                  </label>
                  {loadingMembers ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-custom-primary" />
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded p-2">
                      {rosterMembers.map((member) => {
                        const userId = member.user?._id?.toString();
                        return (
                          <label key={userId || member._id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editTask.watchers.includes(userId)}
                              onChange={() => toggleWatcher(userId)}
                              className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                            />
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {member.user?.firstName} {member.user?.lastName}
                                {member.user?.playaName && (
                                  <span className="text-gray-500 ml-2">({member.user.playaName})</span>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                      {rosterMembers.length === 0 && (
                        <div className="text-center py-4 text-gray-500">
                          No roster members found
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={handleSaveTask}>
                    Save Changes
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      // Reset form to original task data
                      if (selectedTask) {
                        const assignees = getUserArray(selectedTask.assignedTo);
                        const taskWatchers = getUserArray(selectedTask.watchers);
                        setEditTask({
                          title: selectedTask.title,
                          description: selectedTask.description,
                          priority: selectedTask.priority,
                          dueDate: selectedTask.dueDate || '',
                          status: selectedTask.status,
                          assignedTo: assignees.map(u => u._id.toString()),
                          watchers: taskWatchers.map(u => u._id.toString())
                        });
                      }
                      setIsEditMode(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title="Create New Task"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <Input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <Textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Task description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-custom-primary"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <Input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleCreateTask}
                disabled={createLoading}
              >
                {createLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Task'
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TaskManagement;

