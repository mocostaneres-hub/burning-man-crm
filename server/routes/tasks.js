const express = require('express');
const router = express.Router();
// IMPORTANT: Middlewares and DB must be required BEFORE route usage
const { authenticateToken, requireCampAccount } = require('../middleware/auth');
const db = require('../database/databaseAdapter');
const Task = require('../models/Task');
// @route   GET /api/tasks
// @desc    Return tasks for current user's camp
// @access  Private (Camp accounts and admins)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let campId = req.user.campId || null;
    if (!campId) {
      const camp = await db.findCamp({ contactEmail: req.user.email });
      campId = camp ? camp._id : null;
    }
    if (!campId) return res.status(404).json({ message: 'Camp not found' });

    const tasks = await db.findTasks({ campId });
    return res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// (moved requires to the top so authenticateToken is initialized before first use)

// @route   GET /api/tasks/camp/:campId
// @desc    Get all tasks for a camp
// @access  Private (Camp owners only)
router.get('/camp/:campId', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;
    
    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && (req.user.campId || req.user.campName))) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Check if user owns this camp
    if (camp.contactEmail !== req.user.email) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const tasks = await db.findTasks({ campId });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/my-tasks
// @desc    Get tasks assigned to the current user
// @access  Private (Personal accounts only)
router.get('/my-tasks', authenticateToken, async (req, res) => {
  try {
    // Only personal accounts can access their own tasks
    if (req.user.accountType !== 'personal') {
      return res.status(403).json({ message: 'Personal account required' });
    }

    const tasks = await db.findTasks({ assignedTo: req.user._id });

    // Populate camp information for each task (always fetch fresh data)
    const tasksWithCampInfo = await Promise.all(tasks.map(async (task) => {
      try {
        // Normalize task in case it's a Mongoose document
        const plainTask = typeof task.toObject === 'function' ? task.toObject() : task;

        // Always fetch fresh camp data to ensure updates are reflected
        const camp = await db.findCamp({ _id: plainTask.campId });

        // Camps model uses `name`, not `campName`
        const campName = camp ? (camp.campName || camp.name) : undefined;

        return {
          ...plainTask,
          camp: camp ? {
            _id: camp._id,
            campName: campName,
            slug: camp.slug
          } : null
        };
      } catch (error) {
        console.error('Error fetching camp info for task:', error);
        const plainTask = typeof task.toObject === 'function' ? task.toObject() : task;
        return {
          ...plainTask,
          camp: null
        };
      }
    }));

    // Return plain JSON
    res.json(tasksWithCampInfo);
  } catch (error) {
    console.error('Error fetching my tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/assigned/:userId
// @desc    Get tasks assigned to a specific user
// @access  Private
router.get('/assigned/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user is accessing their own tasks or is a camp admin
    if (req.user._id.toString() !== userId && req.user.accountType !== 'camp' && req.user.accountType !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const tasks = await db.findTasks({ assignedTo: userId });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching assigned tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks
// @desc    Create a new task
// @access  Private (Camp owners only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && (req.user.campId || req.user.campName))) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    const { campId, title, description, assignedTo, dueDate, priority = 'medium' } = req.body;

    // Validate required fields
    if (!campId || !title || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if user owns this camp
    const camp = await db.findCamp({ _id: campId });
    if (!camp || camp.contactEmail !== req.user.email) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const taskData = {
      campId,
      title,
      description,
      assignedTo: assignedTo || [],
      dueDate: dueDate ? new Date(dueDate) : null,
      priority,
      createdBy: req.user._id
    };

    const task = await db.createTask(taskData);
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update a task
// @access  Private (Camp owners or assigned users)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const task = await db.findTask({ _id: id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user is camp owner or assigned to the task
    const camp = await db.findCamp({ _id: task.campId });
    const isCampOwner = camp && camp.contactEmail === req.user.email;
    const isAssigned = task.assignedTo.includes(req.user._id.toString());
    const isAdmin = req.user.accountType === 'admin';

    if (!isCampOwner && !isAssigned && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // If updating status to closed, set completedBy
    if (updates.status === 'closed' && !task.completedBy) {
      updates.completedBy = req.user._id;
    }

    const updatedTask = await db.updateTask(id, updates);
    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete a task
// @access  Private (Camp owners only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && (req.user.campId || req.user.campName))) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    const task = await db.findTask({ _id: id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user owns this camp
    const camp = await db.findCamp({ _id: task.campId });
    if (!camp || camp.contactEmail !== req.user.email) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await db.deleteTask(id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/:id/assign
// @desc    Assign task to users
// @access  Private (Camp owners only)
router.post('/:id/assign', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    let { assignedTo } = req.body;

    // Check if user is camp owner
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && (req.user.campId || req.user.campName))) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    const task = await db.findTask({ _id: id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user owns this camp
    const camp = await db.findCamp({ _id: task.campId });
    if (!camp || camp.contactEmail !== req.user.email) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Convert assignedTo array to numbers for consistency with mock database
    if (Array.isArray(assignedTo)) {
      assignedTo = assignedTo.map(id => {
        const numId = parseInt(id);
        return isNaN(numId) ? id : numId;
      });
    }

    console.log('🔄 [Task Assignment] Updating task:', {
      taskId: id,
      taskIdType: typeof id,
      assignedTo: assignedTo,
      assignedToType: typeof assignedTo[0]
    });

    const updatedTask = await db.updateTask(id, { assignedTo });
    
    if (!updatedTask) {
      console.error('❌ [Task Assignment] Task not found or update failed:', id);
      return res.status(404).json({ message: 'Task not found or update failed' });
    }
    
    console.log('✅ [Task Assignment] Task updated:', {
      taskId: id,
      taskTitle: updatedTask.title,
      assignedTo: updatedTask.assignedTo,
      assignedCount: updatedTask.assignedTo.length
    });
    res.json(updatedTask);
  } catch (error) {
    console.error('Error assigning task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

