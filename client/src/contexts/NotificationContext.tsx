import React, { createContext, useContext, useState, ReactNode } from 'react';
import Notification from '../components/ui/Notification';

export interface NotificationData {
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  autoClose?: boolean;
  duration?: number;
}

interface NotificationContextType {
  showNotification: (notification: NotificationData) => void;
  hideNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const showNotification = (notificationData: NotificationData) => {
    setNotification(notificationData);
    setIsOpen(true);
  };

  const hideNotification = () => {
    setIsOpen(false);
    // Delay setting notification to null to allow for exit animation
    setTimeout(() => setNotification(null), 300);
  };

  return (
    <NotificationContext.Provider value={{ showNotification, hideNotification }}>
      {children}
      {notification && (
        <Notification
          type={notification.type}
          title={notification.title}
          message={notification.message}
          isOpen={isOpen}
          onClose={hideNotification}
          autoClose={notification.autoClose}
          duration={notification.duration}
        />
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
