import { useCallback, useEffect, useState } from 'react';
import apiService from '../services/api';
import { NotificationItem } from '../types';

export const useNotifications = (enabled: boolean) => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const response = await apiService.getNotifications({ page: 1, limit: 20 });
      setItems(response.notifications || []);
      setUnreadCount(response.unreadCount || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const markRead = useCallback(async (notificationId: string) => {
    try {
      await apiService.markNotificationRead(notificationId);
      setItems((prev) =>
        prev.map((item) =>
          item._id === notificationId ? { ...item, readAt: new Date().toISOString() } : item
        )
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));
    } catch (error) {
      console.error('Failed to mark notification read:', error);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiService.markAllNotificationsRead();
      setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications read:', error);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return {
    items,
    unreadCount,
    loading,
    refresh: loadNotifications,
    markRead,
    markAllRead
  };
};

export default useNotifications;
