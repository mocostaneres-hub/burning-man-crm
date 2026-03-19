import React from 'react';
import { NotificationItem as NotificationItemType } from '../../types';
import { formatDate } from '../../utils/dateFormatters';

interface Props {
  item: NotificationItemType;
  onClick: (item: NotificationItemType) => void;
}

const NotificationItem: React.FC<Props> = ({ item, onClick }) => {
  const isUnread = !item.readAt;
  return (
    <button
      onClick={() => onClick(item)}
      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
        isUnread ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-50'
      }`}
    >
      <div className="text-sm font-medium text-custom-text">{item.title}</div>
      <div className="text-xs text-gray-600 mt-1">{item.message}</div>
      <div className="text-[11px] text-gray-500 mt-1">{formatDate(item.createdAt)}</div>
    </button>
  );
};

export default NotificationItem;
