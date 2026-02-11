/**
 * Shared date formatting utilities for consistent date display across the application
 */

/**
 * Formats a standard date for general use (e.g., Applied date, Created date)
 * Output: "Jun 15, 2025"
 */
export const formatDate = (dateString: string | Date): string => {
  if (!dateString) return 'Not specified';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(date.getTime())) {
      return 'Not specified';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return 'Not specified';
  }
};

/**
 * Formats arrival/departure dates and other event dates
 * Output: "Sun, 06/15"
 */
export const formatArrivalDepartureDate = (dateString: string | Date): string => {
  if (!dateString || dateString === '' || dateString === 'undefined' || dateString === 'null') {
    return 'Not specified';
  }
  
  try {
    let date;
    
    if (dateString instanceof Date) {
      date = dateString;
    } else if (typeof dateString === 'string') {
      // Handle different date formats
      if (dateString.includes('T')) {
        // Already has time component: "2026-09-25T07:00:00.000Z"
        date = new Date(dateString);
      } else {
        // Handle date-only format: "2025-06-15"
        date = new Date(dateString + 'T12:00:00');
      }
    } else {
      return 'Not specified';
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Not specified';
    }
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: '2-digit',
      day: '2-digit'
    }).replace(/(\w+),\s*(\d+)\/(\d+)/, '$1, $2/$3');
  } catch (error) {
    return 'Not specified';
  }
};

/**
 * Alias for formatArrivalDepartureDate for Tasks, Events, and Shifts
 * Output: "Sun, 06/15"
 */
export const formatEventDate = formatArrivalDepartureDate;

/**
 * Formats time for display
 * Output: "2:30 PM"
 */
export const formatTime = (timeString: string | Date): string => {
  if (!timeString) return 'Not specified';
  
  try {
    const date = typeof timeString === 'string' ? new Date(timeString) : timeString;
    
    if (isNaN(date.getTime())) {
      return 'Not specified';
    }
    
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return 'Not specified';
  }
};

/**
 * Formats date for shifts in Pacific Time
 * Output: "Sun, 06/15 (PT)"
 */
export const formatShiftDate = (dateString: string | Date): string => {
  if (!dateString) return 'Not specified';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return 'Not specified';

    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'America/Los_Angeles'
    }).replace(/(\w+),\s*(\d+)\/(\d+)/, '$1, $2/$3');

    return `${dateStr} (PT)`;
  } catch (error) {
    return 'Not specified';
  }
};

/**
 * Formats time for shifts in Pacific Time
 * Output: "2:30 PM PT"
 */
export const formatShiftTime = (timeString: string | Date): string => {
  if (!timeString) return 'Not specified';

  try {
    const date = typeof timeString === 'string' ? new Date(timeString) : timeString;
    if (isNaN(date.getTime())) return 'Not specified';

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Los_Angeles'
    });

    return `${timeStr} PT`;
  } catch (error) {
    return 'Not specified';
  }
};

/**
 * Formats date and time together
 * Output: "Sun, 06/15 at 2:30 PM"
 */
export const formatDateTime = (dateString: string | Date): string => {
  if (!dateString) return 'Not specified';
  
  const datePart = formatEventDate(dateString);
  const timePart = formatTime(dateString);
  
  if (datePart === 'Not specified' || timePart === 'Not specified') {
    return 'Not specified';
  }
  
  return `${datePart} at ${timePart}`;
};

/**
 * Formats timestamp for task history with Pacific Time
 * Output: "Oct 20, 2025 at 3:45 PM PST"
 */
export const formatTaskHistoryTimestamp = (dateString: string | Date): string => {
  if (!dateString) return 'Not specified';
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(date.getTime())) {
      return 'Not specified';
    }
    
    // Format date and time in Pacific timezone
    const dateStr = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Los_Angeles'
    });
    
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Los_Angeles'
    });
    
    // Determine if PST or PDT based on date
    const jan = new Date(date.getFullYear(), 0, 1);
    const jul = new Date(date.getFullYear(), 6, 1);
    const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    const isDST = date.getTimezoneOffset() < stdOffset;
    const timezone = isDST ? 'PDT' : 'PST';
    
    return `${dateStr} at ${timeStr} ${timezone}`;
  } catch (error) {
    return 'Not specified';
  }
};
