import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationItem as NotificationItemType } from '../../types';
import NotificationItem from './NotificationItem';

interface Props {
  notifications: NotificationItemType[];
  loading: boolean;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

const NotificationDropdown: React.FC<Props> = ({
  notifications,
  loading,
  onClose,
  onMarkRead,
  onMarkAllRead
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'invites' | 'assigned' | 'reminders' | 'updates'>('updates');
  const [snoozedIds, setSnoozedIds] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('notification_snoozed_ids') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  });

  const categorize = (item: NotificationItemType) => {
    const type = (item.type || '').toUpperCase();
    if (type.includes('INVITE') || type.includes('BULK')) return 'invites';
    if (type.includes('ASSIGNED')) return 'assigned';
    if (type.includes('SPOT_OPENED') || type.includes('REMINDER')) return 'reminders';
    return 'updates';
  };

  const filteredNotifications = useMemo(
    () => notifications.filter((item) => categorize(item) === activeTab && !snoozedIds.includes(item._id)),
    [notifications, activeTab, snoozedIds]
  );

  const snoozeNotification = (notificationId: string) => {
    const next = [...new Set([...snoozedIds, notificationId])];
    setSnoozedIds(next);
    localStorage.setItem('notification_snoozed_ids', JSON.stringify(next));
  };

  const handleItemClick = (item: NotificationItemType) => {
    onMarkRead(item._id);
    if (item.link) {
      navigate(item.link);
    }
    onClose();
  };

  return (
    <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-lg z-50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <div className="text-sm font-semibold text-custom-text">Notifications</div>
        <button className="text-xs text-custom-primary hover:underline" onClick={onMarkAllRead}>
          Mark all read
        </button>
      </div>
      <div className="px-3 pt-2 flex gap-2 border-b border-gray-100">
        {(['invites', 'assigned', 'reminders', 'updates'] as const).map((tab) => (
          <button
            key={tab}
            className={`text-xs px-2 py-1 rounded-t border ${activeTab === tab ? 'bg-orange-50 border-orange-200 text-custom-primary' : 'bg-white border-transparent text-gray-600'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      <div className="max-h-96 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="text-sm text-gray-500 p-2">Loading...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-sm text-gray-500 p-2">No notifications in this tab</div>
        ) : (
          filteredNotifications.map((item) => (
            <div key={item._id}>
              <NotificationItem item={item} onClick={handleItemClick} />
              {activeTab === 'reminders' && (
                <div className="px-3 pb-2">
                  <button
                    className="text-[11px] text-custom-primary hover:underline"
                    onClick={() => snoozeNotification(item._id)}
                  >
                    Snooze reminder
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
