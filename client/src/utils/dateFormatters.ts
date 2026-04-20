/**
 * Shared date formatting utilities for consistent date display across the application.
 * All event and shift times are displayed in PDT (America/Los_Angeles) — Black Rock City Time.
 */

export const PDT_TIMEZONE = 'America/Los_Angeles';
export const PDT_LABEL = 'PDT (Black Rock City Time)';

/**
 * Formats a standard date for general use (e.g., Applied date, Created date)
 * Output: "Jun 15, 2025"
 * Uses PDT timezone so dates align with Black Rock City Time.
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
      day: 'numeric',
      timeZone: PDT_TIMEZONE
    });
  } catch (error) {
    return 'Not specified';
  }
};

/**
 * Formats arrival/departure dates and other event dates
 * Output: "Sun, Mar 15"
 * Uses PDT timezone so dates align with Black Rock City Time.
 */
export const formatArrivalDepartureDate = (dateString: string | Date): string => {
  if (!dateString || dateString === '' || dateString === 'undefined' || dateString === 'null') {
    return 'Not specified';
  }

  try {
    let date: Date;

    if (dateString instanceof Date) {
      date = dateString;
    } else if (typeof dateString === 'string') {
      if (dateString.includes('T')) {
        date = new Date(dateString);
      } else {
        // Date-only strings: noon PDT avoids date-boundary shift when converting to PDT
        date = new Date(`${dateString}T12:00:00-07:00`);
      }
    } else {
      return 'Not specified';
    }

    if (isNaN(date.getTime())) {
      return 'Not specified';
    }

    // "Thu, Mar 26"
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: PDT_TIMEZONE });
    const month   = date.toLocaleDateString('en-US', { month: 'short',   timeZone: PDT_TIMEZONE });
    const day     = date.toLocaleDateString('en-US', { day: 'numeric',   timeZone: PDT_TIMEZONE });
    return `${weekday}, ${month} ${day}`;
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
 * Formats time for display in PDT (Black Rock City Time)
 * Output: "2:30 PM PDT"
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
      hour12: true,
      timeZone: PDT_TIMEZONE
    });
  } catch (error) {
    return 'Not specified';
  }
};

/**
 * Formats date for shifts in PDT (Black Rock City Time)
 * Output: "Sun, Mar 15"
 */
export const formatShiftDate = (dateString: string | Date): string => {
  if (!dateString) return 'Not specified';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return 'Not specified';

    // "Thu, Mar 26"
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: PDT_TIMEZONE });
    const month   = date.toLocaleDateString('en-US', { month: 'short',   timeZone: PDT_TIMEZONE });
    const day     = date.toLocaleDateString('en-US', { day: 'numeric',   timeZone: PDT_TIMEZONE });
    return `${weekday}, ${month} ${day}`;
  } catch (error) {
    return 'Not specified';
  }
};

/**
 * Formats time for shifts in PDT (Black Rock City Time)
 * Output: "2:30 PM"
 */
export const formatShiftTime = (timeString: string | Date): string => {
  if (!timeString) return 'Not specified';

  try {
    const date = typeof timeString === 'string' ? new Date(timeString) : timeString;
    if (isNaN(date.getTime())) return 'Not specified';

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: PDT_TIMEZONE
    });
  } catch (error) {
    return 'Not specified';
  }
};

/**
 * Formats date and time together in PDT
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
 * Output: "Oct 20, 2025 at 3:45 PM PDT"
 */
export const formatTaskHistoryTimestamp = (dateString: string | Date): string => {
  if (!dateString) return 'Not specified';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

    if (isNaN(date.getTime())) {
      return 'Not specified';
    }

    const dateStr = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: PDT_TIMEZONE
    });

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: PDT_TIMEZONE
    });

    // Determine if PST or PDT based on UTC offset at that time
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

/**
 * Converts a UTC date/time value to a YYYY-MM-DD string in PDT, suitable for <input type="date"> values.
 * Use when pre-filling edit forms with stored UTC timestamps.
 */
export const utcToPdtDateInput = (value: string | Date | null | undefined): string => {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '';
  // en-CA locale returns YYYY-MM-DD format
  return date.toLocaleDateString('en-CA', { timeZone: PDT_TIMEZONE });
};

/**
 * Converts a UTC date/time value to an HH:MM string in PDT, suitable for <input type="time"> values.
 * Use when pre-filling edit forms with stored UTC timestamps.
 */
export const utcToPdtTimeInput = (value: string | Date | null | undefined): string => {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', {
    timeZone: PDT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};
