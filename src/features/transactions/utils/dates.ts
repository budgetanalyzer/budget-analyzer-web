// src/features/transactions/utils/dates.ts
/**
 * Centralized date utilities for Budget Analyzer Web
 *
 * This module is the ONLY place in the codebase that should:
 * - Import from 'date-fns'
 * - Use the JavaScript Date constructor
 * - Perform date parsing, formatting, or manipulation
 *
 * Date Format Guidelines:
 * - LocalDate (YYYY-MM-DD): Transaction dates, date range filters - NO timezone info
 * - ISO 8601 (with timezone): createdAt, updatedAt timestamps - HAS timezone info
 */

import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  differenceInDays,
  isAfter,
  isBefore,
  isEqual,
} from 'date-fns';

// ============================================================================
// LocalDate Functions (YYYY-MM-DD format without timezone)
// ============================================================================

/**
 * Parse a LocalDate string (YYYY-MM-DD) into a Date object in local timezone.
 * This avoids the common pitfall where `new Date('2025-07-01')` treats the
 * string as UTC and converts to local time, causing off-by-one day errors.
 *
 * @param dateString - Date in YYYY-MM-DD format (e.g., "2025-07-01")
 * @returns Date object in local timezone
 *
 * @example
 * parseLocalDate('2025-07-01') // July 1, 2025 at 00:00:00 local time
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  // Create date in local timezone (months are 0-indexed in Date constructor)
  return new Date(year, month - 1, day);
}

/**
 * Format a LocalDate string for display to users.
 *
 * @param dateString - Date in YYYY-MM-DD format (e.g., "2025-07-01")
 * @returns Formatted date string (e.g., "Jul 1, 2025")
 *
 * @example
 * formatLocalDate('2025-07-01') // "Jul 1, 2025"
 */
export function formatLocalDate(dateString: string): string {
  const dateObj = parseLocalDate(dateString);
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Compare two LocalDate strings for sorting.
 *
 * @param a - First date in YYYY-MM-DD format
 * @param b - Second date in YYYY-MM-DD format
 * @returns Negative if a < b, positive if a > b, 0 if equal
 *
 * @example
 * compareDates('2025-07-01', '2025-08-01') // -1 (July comes before August)
 */
export function compareDates(a: string, b: string): number {
  const dateA = parseLocalDate(a);
  const dateB = parseLocalDate(b);
  return dateA.getTime() - dateB.getTime();
}

/**
 * Check if a LocalDate falls within a date range (inclusive).
 *
 * @param date - Date to check in YYYY-MM-DD format
 * @param from - Start of range in YYYY-MM-DD format
 * @param to - End of range in YYYY-MM-DD format
 * @returns true if date is within range (inclusive)
 *
 * @example
 * isDateInRange('2025-07-15', '2025-07-01', '2025-07-31') // true
 * isDateInRange('2025-08-01', '2025-07-01', '2025-07-31') // false
 */
export function isDateInRange(date: string, from: string, to: string): boolean {
  const dateObj = parseLocalDate(date);
  const fromObj = parseLocalDate(from);
  const toObj = parseLocalDate(to);

  return (
    (isAfter(dateObj, fromObj) || isEqual(dateObj, fromObj)) &&
    (isBefore(dateObj, toObj) || isEqual(dateObj, toObj))
  );
}

// ============================================================================
// ISO Timestamp Functions (ISO 8601 with timezone)
// ============================================================================

/**
 * Format an ISO 8601 timestamp for display to users.
 * Shows full date and time in user's local timezone.
 *
 * @param isoString - ISO 8601 timestamp (e.g., "2025-07-01T12:34:56Z")
 * @returns Formatted timestamp (e.g., "Jul 1, 2025, 12:34:56 PM")
 *
 * @example
 * formatTimestamp('2025-07-01T12:34:56Z') // "Jul 1, 2025, 12:34:56 PM" (in user's timezone)
 */
export function formatTimestamp(isoString: string): string {
  return format(new Date(isoString), 'PPpp');
}

/**
 * Parse an ISO 8601 timestamp string into a Date object.
 * Use this for any timestamp with timezone information (createdAt, updatedAt, etc.)
 *
 * @param isoString - ISO 8601 timestamp (e.g., "2025-07-01T12:34:56Z")
 * @returns Date object
 *
 * @example
 * parseISOTimestamp('2025-07-01T12:34:56Z')
 */
export function parseISOTimestamp(isoString: string): Date {
  return parseISO(isoString);
}

// ============================================================================
// Month/Year Operations (for Analytics)
// ============================================================================

/**
 * Format a Date object as "MMM yyyy" for analytics charts.
 *
 * @param date - Date object
 * @returns Formatted month string (e.g., "Jul 2025")
 *
 * @example
 * formatMonthYear(new Date(2025, 6, 1)) // "Jul 2025"
 */
export function formatMonthYear(date: Date): string {
  return format(date, 'MMM yyyy');
}

/**
 * Create a Date object for the first day of a given month.
 *
 * @param year - Year (e.g., 2025)
 * @param month - Month (1-12, NOT 0-indexed)
 * @returns Date object for first day of month
 *
 * @example
 * createMonthDate(2025, 7) // July 1, 2025
 */
export function createMonthDate(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

/**
 * Get the first and last day of a month as LocalDate strings (YYYY-MM-DD).
 *
 * @param year - Year (e.g., 2025)
 * @param month - Month (1-12, NOT 0-indexed)
 * @returns Object with from and to dates in YYYY-MM-DD format
 *
 * @example
 * getMonthBounds(2025, 7) // { from: '2025-07-01', to: '2025-07-31' }
 */
export function getMonthBounds(year: number, month: number): { from: string; to: string } {
  const monthDate = createMonthDate(year, month);
  const firstDay = startOfMonth(monthDate);
  const lastDay = endOfMonth(monthDate);

  return {
    from: format(firstDay, 'yyyy-MM-dd'),
    to: format(lastDay, 'yyyy-MM-dd'),
  };
}

/**
 * Extract month and year from a LocalDate string for grouping.
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Month key in YYYY-MM format
 *
 * @example
 * getMonthKey('2025-07-15') // '2025-07'
 */
export function getMonthKey(dateString: string): string {
  const date = parseLocalDate(dateString);
  return format(date, 'yyyy-MM');
}

/**
 * Get the first and last day of a year as LocalDate strings (YYYY-MM-DD).
 *
 * @param year - Year (e.g., 2025)
 * @returns Object with from and to dates in YYYY-MM-DD format
 *
 * @example
 * getYearBounds(2025) // { from: '2025-01-01', to: '2025-12-31' }
 */
export function getYearBounds(year: number): { from: string; to: string } {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}

/**
 * Get the current year.
 *
 * @returns Current year (e.g., 2025)
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

// ============================================================================
// Date Range Calculations
// ============================================================================

/**
 * Calculate the number of days between two LocalDate strings.
 *
 * @param from - Start date in YYYY-MM-DD format
 * @param to - End date in YYYY-MM-DD format
 * @returns Number of days between dates
 *
 * @example
 * getDaysBetween('2025-07-01', '2025-07-31') // 30
 */
export function getDaysBetween(from: string, to: string): number {
  const fromDate = parseLocalDate(from);
  const toDate = parseLocalDate(to);
  return differenceInDays(toDate, fromDate);
}

/**
 * Find the earliest and latest dates from an array of LocalDate strings.
 *
 * @param dates - Array of dates in YYYY-MM-DD format
 * @returns Object with earliest and latest dates, or null if array is empty
 *
 * @example
 * getDateRange(['2025-07-15', '2025-07-01', '2025-07-31'])
 * // { earliest: '2025-07-01', latest: '2025-07-31' }
 */
export function getDateRange(dates: string[]): { earliest: string; latest: string } | null {
  if (dates.length === 0) return null;

  let earliest = dates[0];
  let latest = dates[0];

  for (const date of dates) {
    if (compareDates(date, earliest) < 0) earliest = date;
    if (compareDates(date, latest) > 0) latest = date;
  }

  return { earliest, latest };
}
