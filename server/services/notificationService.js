const mongoose = require('mongoose');
const Notification = require('../models/Notification');

const useMongo = !!process.env.MONGODB_URI || !!process.env.MONGO_URI;

const toObjectId = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && value._id) {
    return mongoose.Types.ObjectId.isValid(value._id) ? new mongoose.Types.ObjectId(value._id) : value._id;
  }
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return value;
};

const sanitizeLink = (link) => {
  if (!link || typeof link !== 'string') return null;
  const trimmed = link.trim();
  if (!trimmed.startsWith('/')) return null;
  return trimmed;
};

async function createNotification(payload) {
  if (!useMongo) {
    return null;
  }

  const recipient = toObjectId(payload?.recipient);
  if (!recipient) return null;

  const doc = await Notification.create({
    recipient,
    actor: toObjectId(payload?.actor),
    campId: toObjectId(payload?.campId),
    type: payload?.type,
    title: payload?.title || 'Notification',
    message: payload?.message || '',
    link: sanitizeLink(payload?.link),
    metadata: payload?.metadata || {}
  });

  return doc;
}

async function createBulkNotifications(recipients, payload) {
  if (!useMongo || !Array.isArray(recipients) || recipients.length === 0) {
    return [];
  }

  const docs = recipients
    .map((recipient) => toObjectId(recipient))
    .filter(Boolean)
    .map((recipient) => ({
      recipient,
      actor: toObjectId(payload?.actor),
      campId: toObjectId(payload?.campId),
      type: payload?.type,
      title: payload?.title || 'Notification',
      message: payload?.message || '',
      link: sanitizeLink(payload?.link),
      metadata: payload?.metadata || {}
    }));

  if (docs.length === 0) return [];
  return Notification.insertMany(docs);
}

async function getUserNotifications(recipientId, opts = {}) {
  if (!useMongo) {
    return { notifications: [], unreadCount: 0, page: 1, limit: 20, total: 0 };
  }

  const page = Math.max(parseInt(opts.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const recipient = toObjectId(recipientId);
  const query = { recipient };
  if (opts.unreadOnly === true) {
    query.readAt = null;
  }

  const [notifications, unreadCount, total] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ recipient, readAt: null }),
    Notification.countDocuments(query)
  ]);

  return {
    notifications,
    unreadCount,
    page,
    limit,
    total
  };
}

async function markNotificationRead(notificationId, userId) {
  if (!useMongo) return null;

  const recipient = toObjectId(userId);
  const updated = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient },
    { $set: { readAt: new Date() } },
    { new: true }
  ).lean();

  return updated;
}

async function markAllNotificationsRead(userId) {
  if (!useMongo) return { modifiedCount: 0 };

  const recipient = toObjectId(userId);
  const result = await Notification.updateMany(
    { recipient, readAt: null },
    { $set: { readAt: new Date() } }
  );

  return result;
}

module.exports = {
  createNotification,
  createBulkNotifications,
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead
};
