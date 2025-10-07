import React, { useState, useEffect, useCallback } from 'react';
import { Button, Card, Badge, Modal, Input, Textarea } from '../../components/ui';
import { Plus, Eye, Edit, Trash2, Loader2, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatEventDate } from '../../utils/dateFormatters';

interface Task {
  _id: string;
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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: '',
    status: 'open' as 'open' | 'closed'
  });
  const [assignTo, setAssignTo] = useState<string[]>([]);
  const [rosterMembers, setRosterMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

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
      setTasks(response);
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

  const handleCreateTask = async () => {
    if (!campId || !newTask.title.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setCreateLoading(true);
      const taskData = {
        ...newTask,
        campId,
        status: 'open'
      };
      
      await api.createTask(taskData);
      setShowCreateModal(false);
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        assignedTo: []
      });
      await fetchTasks();
    } catch (err) {
      console.error('Error creating task:', err);
      setError('Failed to create task');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setShowViewModal(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setEditTask({
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      status: task.status
    });
    setShowEditModal(true);
  };

  const handleUpdateTask = async () => {
    if (!selectedTask || !editTask.title.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      await api.updateTask(selectedTask._id, editTask);
      setShowEditModal(false);
      setSelectedTask(null);
      await fetchTasks();
    } catch (err) {
      console.error('Error updating task:', err);
      setError('Failed to update task');
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!window.confirm(`Are you sure you want to delete "${task.title}"?`)) {
      return;
    }

    try {
      await api.deleteTask(task._id);
      await fetchTasks();
    } catch (err) {
      console.error('Error deleting task:', err);
      setError('Failed to delete task');
    }
  };

  const handleAssignTask = (task: Task) => {
    setSelectedTask(task);
    // Convert assignedTo to strings for checkbox matching
    setAssignTo(task.assignedTo.map(id => id.toString()));
    fetchRosterMembers();
    setShowAssignModal(true);
  };

  const fetchRosterMembers = async () => {
    if (!campId) return;
    
    try {
      setLoadingMembers(true);
      const response = await api.get(`/rosters/camp/${campId}`);
      // The API returns a roster object directly with a members array
      if (response.data && response.data.members) {
        setRosterMembers(response.data.members);
      } else if (response.members) {
        // Fallback if response is already the roster object
        setRosterMembers(response.members);
      }
    } catch (err) {
      console.error('Error fetching roster members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleUpdateAssignment = async () => {
    if (!selectedTask) return;

    try {
      console.log('🔄 [Task Assignment] Assigning task:', {
        taskId: selectedTask._id,
        taskTitle: selectedTask.title,
        assignedTo: assignTo,
        assignedCount: assignTo.length
      });
      
      const updatedTask = await api.assignTask(selectedTask._id, assignTo);
      
      console.log('✅ [Task Assignment] Assignment successful:', {
        taskId: updatedTask._id,
        assignedTo: updatedTask.assignedTo,
        assignedCount: updatedTask.assignedTo?.length || 0
      });
      
      setShowAssignModal(false);
      setSelectedTask(null);
      await fetchTasks();
    } catch (err) {
      console.error('❌ [Task Assignment] Error assigning task:', err);
      setError('Failed to assign task');
    }
  };

  // Using shared date formatting utility

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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tasks.map((task) => (
                <tr key={task._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
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
                    {task.assignedTo.length} member{task.assignedTo.length !== 1 ? 's' : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                        onClick={() => handleViewTask(task)}
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                        onClick={() => handleEditTask(task)}
                      >
                        <Edit className="w-3 h-3" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-blue-600 border-blue-600 hover:bg-blue-50"
                        onClick={() => handleAssignTask(task)}
                      >
                        <Plus className="w-3 h-3" />
                        Assign
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1 text-red-600 border-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteTask(task)}
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tasks.length === 0 && (
          <div className="text-center py-12">
            <h3 className="text-h3 font-lato-bold text-custom-text-secondary mb-2">
              No tasks found
            </h3>
            <p className="text-body text-custom-text-secondary">
              Create your first task to get started with camp management.
            </p>
          </div>
        )}
      </Card>

      {/* Create Task Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Task"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Title *
            </label>
            <Input
              type="text"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="Enter task title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <Textarea
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-custom-primary focus:border-transparent"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <Input
              type="date"
              value={newTask.dueDate}
              onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              disabled={createLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateTask}
              disabled={createLoading || !newTask.title.trim()}
              className="flex items-center gap-2"
            >
              {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Task
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Task Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Task Details"
      >
        {selectedTask && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <div className="p-3 bg-gray-50 rounded-md">
                {selectedTask.title}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <div className="p-3 bg-gray-50 rounded-md min-h-[100px]">
                {selectedTask.description}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <Badge variant={getPriorityVariant(selectedTask.priority)}>
                  {selectedTask.priority}
                </Badge>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <Badge variant={getStatusVariant(selectedTask.status)}>
                  {selectedTask.status}
                </Badge>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <div className="p-3 bg-gray-50 rounded-md">
                {selectedTask.dueDate ? formatEventDate(selectedTask.dueDate) : 'No due date'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned To
              </label>
              <div className="p-3 bg-gray-50 rounded-md">
                {selectedTask.assignedTo.length === 0 ? (
                  <span className="text-gray-500">No members assigned</span>
                ) : (
                  <div>
                    <div className="font-medium mb-1">
                      {selectedTask.assignedTo.length} member{selectedTask.assignedTo.length !== 1 ? 's' : ''}
                    </div>
                    <div className="text-sm text-gray-600">
                      Click "Assign" button to view or modify assignments
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Task Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Task"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Title *
            </label>
            <Input
              type="text"
              value={editTask.title}
              onChange={(e) => setEditTask({ ...editTask, title: e.target.value })}
              placeholder="Enter task title"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <Textarea
              value={editTask.description}
              onChange={(e) => setEditTask({ ...editTask, description: e.target.value })}
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={editTask.priority}
                onChange={(e) => setEditTask({ ...editTask, priority: e.target.value as 'low' | 'medium' | 'high' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-custom-primary focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={editTask.status}
                onChange={(e) => setEditTask({ ...editTask, status: e.target.value as 'open' | 'closed' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-custom-primary focus:border-transparent"
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <Input
              type="date"
              value={editTask.dueDate}
              onChange={(e) => setEditTask({ ...editTask, dueDate: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowEditModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdateTask}
              disabled={!editTask.title.trim()}
            >
              Update Task
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Task Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Task to Members"
      >
        {selectedTask && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Members to Assign
              </label>
              {loadingMembers ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-custom-primary" />
                </div>
              ) : (
                <>
                  {rosterMembers.length > 0 && (
                    <div className="mb-3 pb-3 border-b border-gray-200">
                      <label className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assignTo.length === rosterMembers.length && rosterMembers.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // Assign to all members
                              setAssignTo(rosterMembers.map(m => m.user._id.toString()));
                            } else {
                              // Unassign all
                              setAssignTo([]);
                            }
                          }}
                          className="rounded border-gray-300 text-custom-primary focus:ring-custom-primary"
                        />
                        <div className="font-medium text-gray-900">
                          Assign to Entire Roster ({rosterMembers.length} members)
                        </div>
                      </label>
                    </div>
                  )}
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
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAssignModal(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdateAssignment}
                disabled={assignTo.length === 0}
              >
                Assign Task ({assignTo.length})
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TaskManagement;