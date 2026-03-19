import React from 'react';
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
      <div className="max-h-96 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="text-sm text-gray-500 p-2">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="text-sm text-gray-500 p-2">No notifications</div>
        ) : (
          notifications.map((item) => (
            <NotificationItem key={item._id} item={item} onClick={handleItemClick} />
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
