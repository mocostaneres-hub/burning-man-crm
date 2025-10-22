const express = require('express');
const router = express.Router();
// IMPORTANT: Middlewares and DB must be required BEFORE route usage
const { authenticateToken, requireCampAccount } = require('../middleware/auth');
const db = require('../database/databaseAdapter');
const Task = require('../models/Task');
const { getUserCampId, canAccessCamp, canAccessCampResources } = require('../utils/permissionHelpers');
const { generateUniqueTaskIdCode } = require('../utils/taskIdGenerator');
// @route   GET /api/tasks
// @desc    Return tasks for current user's camp
// @access  Private (Camp accounts and admins)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get camp ID using helper (immutable campId)
    const campId = await getUserCampId(req);
    if (!campId) return res.status(404).json({ message: 'Camp not found' });

    const tasks = await db.findTasks({ campId });
    return res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
// (moved requires to the top so authenticateToken is initialized before first use)

// @route   GET /api/tasks/code/:taskIdCode
// @desc    Get a single task by its unique code
// @access  Private (Camp owners, assigned users, or watchers)
router.get('/code/:taskIdCode', authenticateToken, async (req, res) => {
  try {
    const { taskIdCode } = req.params;
    
    // Find the task by taskIdCode
    const task = await Task.findOne({ taskIdCode: taskIdCode.toUpperCase() })
      .populate('createdBy', 'firstName lastName email playaName profilePhoto')
      .populate('assignedTo', 'firstName lastName email playaName profilePhoto')
      .populate('watchers', 'firstName lastName email playaName profilePhoto')
      .populate('comments.user', 'firstName lastName email playaName profilePhoto')
      .populate('history.user', 'firstName lastName email playaName profilePhoto')
      .populate('completedBy', 'firstName lastName email playaName profilePhoto');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access to this task
    // Access granted if: camp owner, active roster member, assigned, or watcher
    const hasCampAccess = await canAccessCampResources(req, task.campId);
    const isAssigned = task.assignedTo.some(user => user._id.toString() === req.user._id.toString());
    const isWatcher = task.watchers && task.watchers.some(user => user._id.toString() === req.user._id.toString());
    
    if (!hasCampAccess && !isAssigned && !isWatcher) {
      return res.status(403).json({ message: 'Access denied - must be camp member, assigned, or watcher' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task by code:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/camp/:campId
// @desc    Get all tasks for a camp
// @access  Private (Camp owners and active roster members)
router.get('/camp/:campId', authenticateToken, async (req, res) => {
  try {
    const { campId } = req.params;

    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Check if user has access to this camp's resources
    const hasAccess = await canAccessCampResources(req, campId);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied - must be camp owner or active roster member' });
    }

    // Use mongoose directly to populate fields
    const tasks = await Task.find({ campId })
      .populate('createdBy', 'firstName lastName email playaName profilePhoto')
      .populate('assignedTo', 'firstName lastName email playaName profilePhoto')
      .populate('watchers', 'firstName lastName email playaName profilePhoto')
      .populate('comments.user', 'firstName lastName email playaName profilePhoto')
      .populate('history.user', 'firstName lastName email playaName profilePhoto')
      .sort({ createdAt: -1 });
    
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
// @desc    Get tasks assigned to a specific user OR where user is a watcher
// @access  Private
router.get('/assigned/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user is accessing their own tasks or is a camp admin
    if (req.user._id.toString() !== userId && req.user.accountType !== 'camp' && req.user.accountType !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Find tasks where user is assigned OR watching
    const tasks = await Task.find({
      $or: [
        { assignedTo: userId },
        { watchers: userId }
      ]
    })
      .populate('createdBy', 'firstName lastName email playaName profilePhoto')
      .populate('assignedTo', 'firstName lastName email playaName profilePhoto')
      .populate('watchers', 'firstName lastName email playaName profilePhoto')
      .populate('comments.user', 'firstName lastName email playaName profilePhoto')
      .populate('history.user', 'firstName lastName email playaName profilePhoto')
      .sort({ createdAt: -1 });
    
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching assigned tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks
// @desc    Create a new task
// @access  Private (Camp owners and roster members)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { campId, title, description, assignedTo, dueDate, priority = 'medium' } = req.body;

    // Validate required fields
    if (!campId || !title || !description) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if user has access to this camp (camp owner OR roster member)
    const camp = await db.findCamp({ _id: campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Check camp ownership using helper
    const isCampOwner = await canAccessCamp(req, campId);
    
    // Check if user is an active roster member
    const isRosterMember = await db.findMember({ 
      camp: campId, 
      user: req.user._id, 
      status: 'active' 
    });

    // Allow camp owners, admins with campId, or active roster members
    if (!isCampOwner && !isRosterMember) {
      return res.status(403).json({ message: 'Access denied - must be camp owner or roster member' });
    }

    console.log('✅ [POST /api/tasks] User authorized to create task:', {
      userId: req.user._id,
      isCampOwner,
      isRosterMember: !!isRosterMember
    });

    // Generate unique task ID code
    const taskIdCode = await generateUniqueTaskIdCode(async (code) => {
      const existingTask = await Task.findOne({ taskIdCode: code });
      return !!existingTask; // Return true if exists, false if unique
    });

    const taskData = {
      taskIdCode,
      campId,
      title,
      description,
      assignedTo: assignedTo || [],
      dueDate: dueDate ? new Date(dueDate) : null,
      priority,
      createdBy: req.user._id,
      history: [{
        action: 'created',
        user: req.user._id,
        timestamp: new Date()
      }]
    };

    const newTask = await Task.create(taskData);
    
    // Populate the created task
    const populatedTask = await Task.findById(newTask._id)
      .populate('createdBy', 'firstName lastName email playaName profilePhoto')
      .populate('assignedTo', 'firstName lastName email playaName profilePhoto')
      .populate('watchers', 'firstName lastName email playaName profilePhoto')
      .populate('history.user', 'firstName lastName email playaName profilePhoto');
    
    res.status(201).json(populatedTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to track changes and generate history entries
const trackTaskChanges = (oldTask, updates, userId) => {
  const historyEntries = [];
  const timestamp = new Date();

  // Track title change
  if (updates.title && updates.title !== oldTask.title) {
    historyEntries.push({
      action: 'updated',
      field: 'title',
      oldValue: oldTask.title,
      newValue: updates.title,
      user: userId,
      timestamp
    });
  }

  // Track description change
  if (updates.description && updates.description !== oldTask.description) {
    historyEntries.push({
      action: 'updated',
      field: 'description',
      oldValue: oldTask.description,
      newValue: updates.description,
      user: userId,
      timestamp
    });
  }

  // Track priority change
  if (updates.priority && updates.priority !== oldTask.priority) {
    historyEntries.push({
      action: 'updated',
      field: 'priority',
      oldValue: oldTask.priority,
      newValue: updates.priority,
      user: userId,
      timestamp
    });
  }

  // Track due date change
  if (updates.dueDate !== undefined) {
    const oldDate = oldTask.dueDate ? new Date(oldTask.dueDate).toISOString() : null;
    const newDate = updates.dueDate ? new Date(updates.dueDate).toISOString() : null;
    if (oldDate !== newDate) {
      historyEntries.push({
        action: 'updated',
        field: 'dueDate',
        oldValue: oldDate,
        newValue: newDate,
        user: userId,
        timestamp
      });
    }
  }

  // Track status change
  if (updates.status && updates.status !== oldTask.status) {
    const action = updates.status === 'closed' ? 'closed' : 'reopened';
    historyEntries.push({
      action,
      field: 'status',
      oldValue: oldTask.status,
      newValue: updates.status,
      user: userId,
      timestamp
    });
  }

  // Track assignedTo changes
  if (updates.assignedTo) {
    const oldAssignees = oldTask.assignedTo.map(id => id.toString());
    const newAssignees = updates.assignedTo.map(id => id.toString());
    
    // Find added assignees
    const addedAssignees = newAssignees.filter(id => !oldAssignees.includes(id));
    addedAssignees.forEach(userId => {
      historyEntries.push({
        action: 'assigned',
        field: 'assignedTo',
        newValue: userId,
        user: userId,
        timestamp
      });
    });

    // Find removed assignees
    const removedAssignees = oldAssignees.filter(id => !newAssignees.includes(id));
    removedAssignees.forEach(userId => {
      historyEntries.push({
        action: 'unassigned',
        field: 'assignedTo',
        oldValue: userId,
        user: userId,
        timestamp
      });
    });
  }

  // Track watchers changes
  if (updates.watchers) {
    const oldWatchers = (oldTask.watchers || []).map(id => id.toString());
    const newWatchers = updates.watchers.map(id => id.toString());
    
    // Find added watchers
    const addedWatchers = newWatchers.filter(id => !oldWatchers.includes(id));
    addedWatchers.forEach(userId => {
      historyEntries.push({
        action: 'added_watcher',
        field: 'watchers',
        newValue: userId,
        user: userId,
        timestamp
      });
    });

    // Find removed watchers
    const removedWatchers = oldWatchers.filter(id => !newWatchers.includes(id));
    removedWatchers.forEach(userId => {
      historyEntries.push({
        action: 'removed_watcher',
        field: 'watchers',
        oldValue: userId,
        user: userId,
        timestamp
      });
    });
  }

  return historyEntries;
};

// @route   PUT /api/tasks/:id
// @desc    Update a task
// @access  Private (Camp owners, roster members, assigned users, or watchers)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access to update this task
    const camp = await db.findCamp({ _id: task.campId });
    if (!camp) {
      return res.status(404).json({ message: 'Camp not found' });
    }

    // Check comprehensive camp access (owner or active roster member)
    const hasCampAccess = await canAccessCampResources(req, task.campId);
    
    // Check if user is specifically assigned or watching
    const isAssigned = task.assignedTo.includes(req.user._id.toString());
    const isWatcher = task.watchers && task.watchers.includes(req.user._id.toString());

    // Allow camp owners, active roster members, assigned users, or watchers
    if (!hasCampAccess && !isAssigned && !isWatcher) {
      return res.status(403).json({ message: 'Access denied - must be camp owner, active roster member, assigned to task, or watcher' });
    }

    console.log('✅ [PUT /api/tasks/:id] User authorized to update task:', {
      userId: req.user._id,
      hasCampAccess,
      isAssigned,
      isWatcher
    });

    // Track changes before updating
    const historyEntries = trackTaskChanges(task, updates, req.user._id);

    // If updating status to closed, set completedBy
    if (updates.status === 'closed' && !task.completedBy) {
      updates.completedBy = req.user._id;
    }

    // Add history entries to the task
    if (!task.history) {
      task.history = [];
    }
    task.history.push(...historyEntries);

    // Apply updates
    Object.keys(updates).forEach(key => {
      task[key] = updates[key];
    });

    await task.save();

    // Populate the updated task
    const populatedTask = await Task.findById(id)
      .populate('createdBy', 'firstName lastName email playaName profilePhoto')
      .populate('assignedTo', 'firstName lastName email playaName profilePhoto')
      .populate('watchers', 'firstName lastName email playaName profilePhoto')
      .populate('comments.user', 'firstName lastName email playaName profilePhoto')
      .populate('history.user', 'firstName lastName email playaName profilePhoto');

    res.json(populatedTask);
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
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    const task = await db.findTask({ _id: id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user owns this camp
    const camp = await db.findCamp({ _id: task.campId });
    // Check camp ownership using helper
    const hasAccess = await canAccessCamp(req, task.campId);
    if (!camp || !hasAccess) {
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
    if (req.user.accountType !== 'camp' && !(req.user.accountType === 'admin' && req.user.campId)) {
      return res.status(403).json({ message: 'Camp account required' });
    }

    const task = await db.findTask({ _id: id });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user owns this camp
    const camp = await db.findCamp({ _id: task.campId });
    // Check camp ownership using helper
    const hasAccess = await canAccessCamp(req, task.campId);
    if (!camp || !hasAccess) {
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

// @route   POST /api/tasks/fix-volunteer-shifts
// @desc    Fix existing volunteer shift tasks by adding type and metadata fields
// @access  Private (Admin only)
router.post('/fix-volunteer-shifts', authenticateToken, async (req, res) => {
  try {
    // Only allow admin users to run this fix
    if (req.user.accountType !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    console.log('🔧 [TASK FIX] Starting volunteer shift task fix');

    // Find volunteer shift tasks missing type/metadata
    const tasks = await Task.find({
      title: /^Volunteer Shift:/,
      $or: [
        { type: { $exists: false } },
        { metadata: { $exists: false } }
      ]
    });

    console.log(`📊 [TASK FIX] Found ${tasks.length} volunteer shift tasks missing type/metadata`);

    if (tasks.length === 0) {
      return res.json({ 
        message: 'All volunteer shift tasks already have proper type and metadata',
        updatedCount: 0,
        failedCount: 0
      });
    }

    let updatedCount = 0;
    let failedCount = 0;

    for (const task of tasks) {
      try {
        console.log(`🔧 [TASK FIX] Updating task: ${task._id} - ${task.title}`);

        // Extract event and shift info from description
        const desc = task.description;
        const eventMatch = desc.match(/Event: (.+)/);
        const shiftMatch = desc.match(/Shift: (.+)/);

        if (eventMatch && shiftMatch) {
          const updateData = {
            type: 'volunteer_shift',
            metadata: {
              eventName: eventMatch[1].trim(),
              shiftTitle: shiftMatch[1].trim()
            }
          };

          await Task.updateOne({ _id: task._id }, updateData);
          console.log(`✅ [TASK FIX] Updated task ${task._id} with type and metadata`);
          updatedCount++;
        } else {
          console.log(`⚠️ [TASK FIX] Could not extract event/shift info from description for task ${task._id}`);
          failedCount++;
        }
      } catch (error) {
        console.error(`❌ [TASK FIX] Error updating task ${task._id}:`, error.message);
        failedCount++;
      }
    }

    console.log(`🎉 [TASK FIX] Fix complete: ${updatedCount} updated, ${failedCount} failed`);

    res.json({
      message: 'Volunteer shift task fix completed',
      updatedCount,
      failedCount,
      totalFound: tasks.length
    });

  } catch (error) {
    console.error('❌ [TASK FIX] Critical error:', error);
    res.status(500).json({ 
      message: 'Server error during task fix',
      error: error.message
    });
  }
});

// @route   GET /api/tasks/test-railway
// @desc    Test endpoint to verify Railway deployment
// @access  Public
router.get('/test-railway', (req, res) => {
  res.json({ 
    message: 'Railway deployment test successful', 
    timestamp: new Date().toISOString(),
    route: '/api/tasks/test-railway'
  });
});

// @route   GET /api/tasks/my-events
// @desc    Get all events for camps the user is a member of (for member view)
// @access  Private (Approved camp members)
router.get('/my-events', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 [MY EVENTS] Fetching events for member view');
    console.log('📝 [MY EVENTS] User ID:', req.user._id);

    // Find all camps where the user is an approved member
    const rosters = await db.findRosters({});
    console.log('📊 [MY EVENTS] Found rosters:', rosters.length);
    
    const userCampIds = [];

    for (const roster of rosters) {
      console.log('🔍 [MY EVENTS] Checking roster:', { 
        id: roster._id, 
        active: roster.active, 
        membersCount: roster.members?.length || 0,
        camp: roster.camp 
      });
      
      if (!roster.members || !roster.active) continue;

      for (const memberEntry of roster.members) {
        console.log('👤 [MY EVENTS] Checking member entry:', { 
          status: memberEntry.status, 
          memberId: memberEntry.member 
        });
        
        if (memberEntry.status !== 'approved' || !memberEntry.member) continue;

        const member = await db.findMember({ _id: memberEntry.member });
        console.log('🔍 [MY EVENTS] Found member:', { 
          id: member?._id, 
          user: member?.user, 
          status: member?.status 
        });
        
        if (member && member.user && member.status === 'active') {
          const memberId = typeof member.user === 'object' ? member.user._id : member.user;
          console.log('🔍 [MY EVENTS] Comparing IDs:', { 
            memberId: memberId.toString(), 
            userId: req.user._id.toString(),
            match: memberId.toString() === req.user._id.toString()
          });
          
          if (memberId.toString() === req.user._id.toString()) {
            userCampIds.push(roster.camp);
            console.log('✅ [MY EVENTS] User found in camp:', roster.camp);
            break;
          }
        }
      }
    }

    console.log('🏕️ [MY EVENTS] User is member of camps:', userCampIds);

    // If no camps found through roster lookup, try to find camps from user's tasks
    if (userCampIds.length === 0) {
      console.log('⚠️ [MY EVENTS] No camps found through roster, checking user tasks...');
      
      // Get user's tasks to find camp IDs
      const userTasks = await db.findTasks({ assignedTo: req.user._id });
      console.log('📋 [MY EVENTS] User tasks:', userTasks.length);
      
      const taskCampIds = [...new Set(userTasks.map(task => task.campId).filter(Boolean))];
      console.log('🏕️ [MY EVENTS] Camps from tasks:', taskCampIds);
      
      userCampIds.push(...taskCampIds);
    }

    if (userCampIds.length === 0) {
      console.log('❌ [MY EVENTS] No camps found for user');
      return res.json({ events: [] });
    }

    // Get all events for these camps
    const allEvents = [];
    for (const campId of userCampIds) {
      console.log('🔍 [MY EVENTS] Looking for events in camp:', campId);
      const events = await db.findEvents({ campId });
      console.log('📅 [MY EVENTS] Found events in camp:', events.length);
      allEvents.push(...events);
    }

    console.log('✅ [MY EVENTS] Total events found:', allEvents.length);

    res.json({ events: allEvents });
  } catch (error) {
    console.error('❌ [MY EVENTS] Error fetching events:', error);
    res.status(500).json({
      message: 'Server error fetching events',
      error: error.message
    });
  }
});

// @route   POST /api/tasks/:id/comments
// @desc    Add a comment to a task
// @access  Private (Camp owners, active roster members, assignees, and watchers)
router.post('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access to this task's camp, is assigned, or is a watcher
    const hasCampAccess = await canAccessCampResources(req, task.campId);
    const isAssigned = task.assignedTo && task.assignedTo.some(userId => userId.toString() === req.user._id.toString());
    const isWatcher = task.watchers && task.watchers.some(userId => userId.toString() === req.user._id.toString());
    
    if (!hasCampAccess && !isAssigned && !isWatcher) {
      return res.status(403).json({ message: 'Access denied - must be camp owner, active roster member, assigned to task, or watcher' });
    }

    // Add comment
    task.comments.push({
      user: req.user._id,
      text: text.trim(),
      createdAt: new Date()
    });

    await task.save();

    // Populate the user details for the new comment
    await task.populate({
      path: 'comments.user',
      select: 'firstName lastName email playaName profilePhoto'
    });

    // Return the newly added comment
    const newComment = task.comments[task.comments.length - 1];

    res.json(newComment);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/:id/comments
// @desc    Get all comments for a task
// @access  Private (Camp owners, active roster members, assignees, and watchers)
router.get('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findById(id).populate({
      path: 'comments.user',
      select: 'firstName lastName email playaName profilePhoto'
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access to this task's camp, is assigned, or is a watcher
    const hasCampAccess = await canAccessCampResources(req, task.campId);
    const isAssigned = task.assignedTo && task.assignedTo.some(userId => userId.toString() === req.user._id.toString());
    const isWatcher = task.watchers && task.watchers.some(userId => userId.toString() === req.user._id.toString());
    
    if (!hasCampAccess && !isAssigned && !isWatcher) {
      return res.status(403).json({ message: 'Access denied - must be camp owner, active roster member, assigned to task, or watcher' });
    }

    res.json(task.comments);
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

