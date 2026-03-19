import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import useNotifications from '../../hooks/useNotifications';
import NotificationDropdown from './NotificationDropdown';

interface Props {
  enabled: boolean;
}

const NotificationBell: React.FC<Props> = ({ enabled }) => {
  const { items, unreadCount, loading, markRead, markAllRead, refresh } = useNotifications(enabled);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!enabled) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="relative p-2 rounded-md hover:bg-custom-primary/10 text-custom-text"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) refresh();
        }}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          notifications={items}
          loading={loading}
          onClose={() => setOpen(false)}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
        />
      )}
    </div>
  );
};

export default NotificationBell;
