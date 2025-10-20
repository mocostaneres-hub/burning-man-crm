import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Badge, Input, Textarea } from '../../components/ui';
import { ArrowLeft, Edit, CheckCircle, Clock, Loader2, Send, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatEventDate, formatTaskHistoryTimestamp } from '../../utils/dateFormatters';
import { Task as GlobalTask, User as GlobalUser, TaskHistoryEntry } from '../../types';

// Helper function to safely get user array from assignedTo/watchers
const getUserArray = (field: string[] | GlobalUser[] | undefined): GlobalUser[] => {
  if (!field) return [];
  if (field.length === 0) return [];
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
      return `${userName} assigned a member to this task`;
    case 'unassigned':
      return `${userName} removed a member from this task`;
    case 'added_watcher':
      return `${userName} added a watcher`;
    case 'removed_watcher':
      return `${userName} removed a watcher`;
    default:
      return `${userName} performed an action`;
  }
};

const TaskDetailsPage: React.FC = () => {
  const { taskIdCode } = useParams<{ taskIdCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [task, setTask] = useState<GlobalTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

  useEffect(() => {
    if (taskIdCode) {
      loadTask();
    }
  }, [taskIdCode]);

  const loadTask = async () => {
    try {
      setLoading(true);
      setError(null);
      const taskData = await api.getTaskByCode(taskIdCode!);
      setTask(taskData);
    } catch (err: any) {
      console.error('Error loading task:', err);
      setError(err.response?.data?.message || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!task || !newComment.trim()) return;

    try {
      setIsPostingComment(true);
      await api.postTaskComment(task._id, newComment.trim());
      setNewComment('');
      await loadTask(); // Reload to get the new comment
    } catch (err) {
      console.error('Error posting comment:', err);
      alert('Failed to post comment');
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleCloseTask = async () => {
    if (!task) return;
    try {
      await api.updateTask(task._id, { status: 'closed' });
      await loadTask();
    } catch (err) {
      console.error('Error closing task:', err);
      alert('Failed to close task');
    }
  };

  const handleReopenTask = async () => {
    if (!task) return;
    try {
      await api.updateTask(task._id, { status: 'open' });
      await loadTask();
    } catch (err) {
      console.error('Error reopening task:', err);
      alert('Failed to reopen task');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-custom-primary" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Task Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The task you are looking for does not exist or you do not have access to it.'}</p>
          <Button onClick={() => navigate('/camp/tasks')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Tasks
          </Button>
        </Card>
      </div>
    );
  }

  const assignedUsers = getUserArray(task.assignedTo);
  const watchers = getUserArray(task.watchers);
  const createdBy = getUser(task.createdBy);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header with back button */}
      <div className="mb-6 flex justify-between items-center">
        <Button onClick={() => navigate('/camp/tasks')} variant="outline" className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Tasks
        </Button>
        <div className="flex items-center gap-2">
          <Badge className={getPriorityColor(task.priority)}>
            {task.priority}
          </Badge>
          <Badge className={task.status === 'closed' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'}>
            {task.status}
          </Badge>
        </div>
      </div>

      {/* Task ID Code Badge */}
      <div className="mb-4">
        <Badge className="bg-purple-100 text-purple-800 text-lg font-mono">
          {task.taskIdCode}
        </Badge>
      </div>

      {/* Main Content */}
      <Card className="p-6 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{task.title}</h1>
          {task.dueDate && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              Due: {formatEventDate(task.dueDate)}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-gray-500 mb-2 block">Description</label>
          <p className="text-gray-900 whitespace-pre-wrap">{task.description}</p>
        </div>

        {/* Created By */}
        <div>
          <label className="text-sm font-medium text-gray-500 mb-2 block">Created By</label>
          <p className="text-sm text-gray-900">
            {createdBy ? `${createdBy.firstName} ${createdBy.lastName}` : 'Unknown'}
          </p>
        </div>

        {/* Assigned To */}
        <div>
          <label className="text-sm font-medium text-gray-500 mb-2 block">Assigned To</label>
          {assignedUsers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {assignedUsers.map((assignee) => (
                <Badge key={assignee._id} className="bg-blue-100 text-blue-800">
                  {assignee.firstName} {assignee.lastName}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No one assigned</p>
          )}
        </div>

        {/* Watchers */}
        <div>
          <label className="text-sm font-medium text-gray-500 mb-2 block">Watchers</label>
          {watchers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {watchers.map((watcher) => (
                <Badge key={watcher._id} className="bg-green-100 text-green-800">
                  {watcher.firstName} {watcher.lastName}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No watchers</p>
          )}
        </div>

        {/* Task History */}
        <div>
          <label className="text-sm font-medium text-gray-500 mb-2 block">Task History</label>
          <div className="space-y-3 max-h-60 overflow-y-auto">
            {task.history && task.history.length > 0 ? (
              task.history.map((entry, idx) => (
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
            {task.comments && task.comments.length > 0 ? (
              task.comments.map((comment) => (
                <div key={comment._id} className="bg-gray-50 p-3 rounded-lg">
                  <div className="mb-2">
                    <span className="font-medium text-gray-900">
                      {comment.user.firstName} {comment.user.lastName}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatTaskHistoryTimestamp(comment.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.text}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 italic">No comments yet</p>
            )}
          </div>
          
          {/* Add Comment Form */}
          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="flex-1"
            />
            <Button
              onClick={handlePostComment}
              disabled={!newComment.trim() || isPostingComment}
              className="self-end"
            >
              {isPostingComment ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={() => navigate('/camp/tasks')}
            variant="outline"
          >
            <Edit className="w-4 h-4 mr-2" />
            Back to Edit
          </Button>
          {task.status === 'open' ? (
            <Button
              onClick={handleCloseTask}
              variant="outline"
              className="text-green-600 hover:bg-green-50"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Close Task
            </Button>
          ) : (
            <Button
              onClick={handleReopenTask}
              variant="outline"
              className="text-blue-600 hover:bg-blue-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Re-Open Task
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default TaskDetailsPage;

