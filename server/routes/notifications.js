const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead
} = require('../services/notificationService');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    const result = await getUserNotifications(req.user._id, {
      page: req.query.page,
      limit: req.query.limit,
      unreadOnly
    });
    return res.json(result);
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const updated = await markNotificationRead(req.params.id, req.user._id);
    if (!updated) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    return res.json({ notification: updated });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const result = await markAllNotificationsRead(req.user._id);
    return res.json({
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount || result.nModified || 0
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
