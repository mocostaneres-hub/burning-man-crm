import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, Badge, Modal, Input, Textarea } from '../../components/ui';
import { Plus, Eye, Edit, Trash2, Loader2, RefreshCw, CheckCircle, Clock, X, RotateCcw, Users, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatEventDate } from '../../utils/dateFormatters';

interface Task {
  _id: string;
  title: string;
  description: string;
  assignedTo: string[];
  watchers?: string[]; // New field for watchers
  dueDate?: string;
  status: 'open' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  completedAt?: string;
  completedBy?: string;
  type?: string; // To distinguish between regular tasks and event tasks
}

const TaskManagement: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [campId, setCampId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: '',
    assignedTo: [] as string[]
  });
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showWatchersModal, setShowWatchersModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: '',
    status: 'open' as 'open' | 'closed',
    assignedTo: [] as string[],
    watchers: [] as string[]
  });
  const [assignTo, setAssignTo] = useState<string[]>([]);
  const [watchers, setWatchers] = useState<string[]>([]);
  const [rosterMembers, setRosterMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');

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
      const regularTasks = response.filter((task: Task) => !task.type || task.type !== 'event');
      setTasks(regularTasks);
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

  // Filter tasks based on active tab
  const filteredTasks = tasks.filter(task => task.status === activeTab);

  // Handle task title click
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowViewModal(true);
  };

  // Handle close task
  const handleCloseTask = async (taskId: string) => {
    try {
      await api.updateTask(taskId, { status: 'closed' });
      await fetchTasks();
      setShowViewModal(false);
    } catch (err) {
      console.error('Error closing task:', err);
      setError('Failed to close task');
    }
  };

  // Handle reopen task
  const handleReopenTask = async (taskId: string) => {
    try {
      await api.updateTask(taskId, { status: 'open' });
      await fetchTasks();
      setShowViewModal(false);
    } catch (err) {
      console.error('Error reopening task:', err);
      setError('Failed to reopen task');
    }
  };

  // Handle edit from view modal
  const handleEditFromView = () => {
    if (selectedTask) {
      setEditTask({
        title: selectedTask.title,
        description: selectedTask.description,
        priority: selectedTask.priority,
        dueDate: selectedTask.dueDate || '',
        status: selectedTask.status,
        assignedTo: selectedTask.assignedTo || [],
        watchers: selectedTask.watchers || []
      });
      setAssignTo(selectedTask.assignedTo || []);
      setWatchers(selectedTask.watchers || []);
      setShowViewModal(false);
      setShowEditModal(true);
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
        campId,
        assignedTo: newTask.assignedTo
      });
      
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        assignedTo: []
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

  const handleUpdateTask = async () => {
    if (!selectedTask) return;

    try {
      await api.updateTask(selectedTask._id, {
        ...editTask,
        assignedTo: assignTo,
        watchers: watchers
      });
      
      setShowEditModal(false);
      setSelectedTask(null);
      await fetchTasks();
    } catch (err) {
      console.error('Error updating task:', err);
      setError('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      await api.deleteTask(taskId);
      await fetchTasks();
    } catch (err) {
      console.error('Error deleting task:', err);
      setError('Failed to delete task');
    }
  };

  const loadRosterMembers = async () => {
    if (!campId) return;
    
    try {
      setLoadingMembers(true);
      const response = await api.getRosterMembers(campId);
      setRosterMembers(response);
    } catch (err) {
      console.error('Error loading roster members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAssignTask = async () => {
    if (!selectedTask) return;

    try {
      await api.assignTask(selectedTask._id, assignTo);
      setShowAssignModal(false);
      setSelectedTask(null);
      await fetchTasks();
    } catch (err) {
      console.error('Error assigning task:', err);
      setError('Failed to assign task');
    }
  };

  const handleUpdateWatchers = async () => {
    if (!selectedTask) return;

    try {
      await api.updateTask(selectedTask._id, { watchers });
      setShowWatchersModal(false);
      setSelectedTask(null);
      await fetchTasks();
    } catch (err) {
      console.error('Error updating watchers:', err);
      setError('Failed to update watchers');
    }
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
                      <button
                        onClick={() => handleTaskClick(task)}
                        className="text-sm font-medium text-custom-primary hover:text-custom-primary/80 hover:underline text-left"
                      >
                        {task.title}
                      </button>
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
                    {task.assignedTo?.length || 0} assigned
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {task.watchers?.length || 0} watchers
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View Task Modal */}
      {showViewModal && selectedTask && (
        <Modal
          isOpen={showViewModal}
          onClose={() => setShowViewModal(false)}
          title="Task Details"
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{selectedTask.title}</h3>
              <p className="text-gray-600 mt-2">{selectedTask.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Priority</label>
                <Badge variant={getPriorityVariant(selectedTask.priority)} className="ml-2">
                  {selectedTask.priority}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <Badge variant={getStatusVariant(selectedTask.status)} className="ml-2">
                  {selectedTask.status}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Due Date</label>
                <p className="text-sm text-gray-900">
                  {selectedTask.dueDate ? formatEventDate(selectedTask.dueDate) : 'No due date'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Assigned To</label>
                <p className="text-sm text-gray-900">{selectedTask.assignedTo?.length || 0} members</p>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleEditFromView} className="flex items-center gap-2">
                <Edit className="w-4 h-4" />
                Edit
              </Button>
              {selectedTask.status === 'open' ? (
                 <Button 
                   onClick={() => handleCloseTask(selectedTask._id)}
                   variant="outline"
                   className="flex items-center gap-2 text-orange-600 border-orange-600 hover:bg-orange-50"
                 >
                   <X className="w-4 h-4" />
                   Close Task
                 </Button>
              ) : (
                <Button 
                  onClick={() => handleReopenTask(selectedTask._id)}
                  variant="outline"
                  className="flex items-center gap-2 text-green-600 border-green-600 hover:bg-green-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  Re-Open
                </Button>
              )}
              <Button
                onClick={() => {
                  setAssignTo(selectedTask.assignedTo || []);
                  setShowAssignModal(true);
                }}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Assign
              </Button>
              <Button
                onClick={() => {
                  setWatchers(selectedTask.watchers || []);
                  setShowWatchersModal(true);
                }}
                variant="outline"
                className="flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Watchers
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Task Modal */}
      {showEditModal && (
        <Modal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          title="Edit Task"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
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

            <div className="flex gap-2 pt-4">
              <Button onClick={handleUpdateTask}>
                Save Changes
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign Task Modal */}
      {showAssignModal && (
        <Modal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          title="Assign Task"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Select members to assign this task to:</p>
            
            {loadingMembers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-custom-primary" />
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {rosterMembers.map((member) => {
                  const userId = member.user?._id?.toString();
                  return (
                    <label key={userId || member._id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignTo.includes(userId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignTo([...assignTo, userId]);
                          } else {
                            setAssignTo(assignTo.filter(id => id !== userId));
                          }
                        }}
                        className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {member.user?.firstName} {member.user?.lastName}
                          {member.user?.playaName && (
                            <span className="text-gray-500 ml-2">({member.user.playaName})</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {member.user?.email}
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

            <div className="flex gap-2 pt-4">
              <Button onClick={handleAssignTask}>
                Assign Task
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowAssignModal(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Watchers Modal */}
      {showWatchersModal && (
        <Modal
          isOpen={showWatchersModal}
          onClose={() => setShowWatchersModal(false)}
          title="Task Watchers"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Select members to watch this task (they'll be notified of changes):</p>
            
            {loadingMembers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-custom-primary" />
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {rosterMembers.map((member) => {
                  const userId = member.user?._id?.toString();
                  return (
                    <label key={userId || member._id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={watchers.includes(userId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setWatchers([...watchers, userId]);
                          } else {
                            setWatchers(watchers.filter(id => id !== userId));
                          }
                        }}
                        className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {member.user?.firstName} {member.user?.lastName}
                          {member.user?.playaName && (
                            <span className="text-gray-500 ml-2">({member.user.playaName})</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {member.user?.email}
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

            <div className="flex gap-2 pt-4">
              <Button onClick={handleUpdateWatchers}>
                Update Watchers
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowWatchersModal(false)}
              >
                Cancel
              </Button>
            </div>
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
