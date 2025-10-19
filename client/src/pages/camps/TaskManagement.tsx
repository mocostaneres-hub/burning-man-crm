import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, Badge, Modal, Input, Textarea } from '../../components/ui';
import { Plus, Edit, Trash2, Loader2, RefreshCw, CheckCircle, Clock, X, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatEventDate } from '../../utils/dateFormatters';
import { Task as GlobalTask, User as GlobalUser, TaskComment } from '../../types';

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

const TaskManagement: React.FC = () => {
  const { user } = useAuth();
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

  useEffect(() => {
    if (campId) {
      fetchTasks();
    }
  }, [campId, fetchTasks]);

  const loadRosterMembers = async () => {
    if (!campId || rosterMembers.length > 0) return;
    
    try {
      setLoadingMembers(true);
      const response = await api.get(`/rosters/camp/${campId}`);
      console.log('🔍 [TaskManagement] Roster response:', response);
      
      if (response.data && response.data.members) {
        console.log('📋 [TaskManagement] Members from response.data.members:', response.data.members);
        setRosterMembers(response.data.members);
      } else if (response.members) {
        console.log('📋 [TaskManagement] Members from response.members:', response.members);
        setRosterMembers(response.members);
      } else {
        console.warn('⚠️ [TaskManagement] No members found in response');
        setRosterMembers([]);
      }
    } catch (err) {
      console.error('❌ [TaskManagement] Error loading roster members:', err);
      setRosterMembers([]);
    } finally {
      setLoadingMembers(false);
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

  const filteredTasks = tasks.filter(task => task.status === activeTab);

  const handleTaskClick = async (task: GlobalTask) => {
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
    await loadRosterMembers();
  };

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
      await api.updateTask(selectedTask._id, editTask);
      await fetchTasks();
      setIsEditMode(false);
      // Refresh selected task to show updated data
      const updatedTasks = await api.getTasks(campId!);
      const refreshedTask = updatedTasks.find((t: Task) => t._id === selectedTask._id);
      if (refreshedTask) {
        setSelectedTask(refreshedTask);
      }
    } catch (err) {
      console.error('Error updating task:', err);
      setError('Failed to update task');
    }
  };

  const handleCreateTask = async () => {
    if (!campId || !newTask.title.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setCreateLoading(true);
      await api.createTask({
        ...newTask,
        campId
      });
      
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: ''
      });
      setShowCreateModal(false);
      await fetchTasks();
    } catch (err) {
      console.error('Error creating task:', err);
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
      const comment = await api.post(`/tasks/${selectedTask._id}/comments`, { text: newComment });
      
      // Update selected task with new comment
      setSelectedTask({
        ...selectedTask,
        comments: [...(selectedTask.comments || []), comment.data]
      });
      
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
      setError('Failed to add comment');
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
                <tr key={task._id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleTaskClick(task)}>
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-custom-primary">
                        {task.title}
                      </div>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getUserArray(task.assignedTo).length} assigned
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getUserArray(task.watchers).length} watchers
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
                  <label className="text-sm font-medium text-gray-500 mb-2 block">History</label>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Created: {formatEventDate(selectedTask.createdAt)} by {getUser(selectedTask.createdBy)?.firstName} {getUser(selectedTask.createdBy)?.lastName}</p>
                    <p>Last Updated: {formatEventDate(selectedTask.updatedAt)}</p>
                    {selectedTask.completedAt && (
                      <p>Completed: {formatEventDate(selectedTask.completedAt)}</p>
                    )}
                  </div>
                </div>

                {/* Comments Section */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Comments</h3>
                  <div className="space-y-4 mb-4 max-h-60 overflow-y-auto">
                    {selectedTask.comments && selectedTask.comments.length > 0 ? (
                      selectedTask.comments.map((comment, idx) => (
                        <div key={idx} className="border-l-4 border-gray-300 pl-4 py-2">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-sm text-gray-900">
                              {comment.user.firstName} {comment.user.lastName}
                              {comment.user.playaName && ` (${comment.user.playaName})`}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatEventDate(comment.createdAt)}
                            </span>
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
                    onClick={() => setIsEditMode(false)}
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

