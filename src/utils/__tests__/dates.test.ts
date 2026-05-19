import { describe, expect, it } from 'vitest';
import {
  compareLocalDates,
  formatISOTimestampAsLocalDate,
  formatLocalDate,
  formatTimestamp,
  getDaysBetween,
  getMonthBounds,
  getMonthKey,
  isoTimestampToLocalDateInputValue,
  isDateInRange,
  localDateToEndOfDayISOTimestamp,
  localDateToStartOfDayISOTimestamp,
  parseLocalDate,
} from '@/utils/dates';

describe('dates utilities', () => {
  it('converts a LocalDate into local-day ISO timestamp bounds', () => {
    expect(localDateToStartOfDayISOTimestamp('2026-01-15')).toBe('2026-01-15T08:00:00.000Z');
    expect(localDateToEndOfDayISOTimestamp('2026-01-15')).toBe('2026-01-16T07:59:59.999Z');
  });

  it('preserves local-day bounds across daylight saving time changes', () => {
    expect(localDateToStartOfDayISOTimestamp('2025-03-09')).toBe('2025-03-09T08:00:00.000Z');
    expect(localDateToEndOfDayISOTimestamp('2025-03-09')).toBe('2025-03-10T06:59:59.999Z');
  });

  it('parses and formats LocalDate strings without UTC day shifts', () => {
    const parsed = parseLocalDate('2026-01-15');

    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(0);
    expect(parsed.getDate()).toBe(15);
    expect(formatLocalDate('2026-01-15')).toBe('Jan 15, 2026');
  });

  it('converts ISO timestamps into local date input values', () => {
    expect(isoTimestampToLocalDateInputValue('2026-01-16T07:59:59.999Z')).toBe('2026-01-15');
  });

  it('formats ISO timestamps as local calendar dates', () => {
    expect(formatISOTimestampAsLocalDate('2026-01-15T01:30:00Z')).toBe('Jan 14, 2026');
  });

  it('returns a placeholder for missing timestamps', () => {
    expect(formatTimestamp(undefined)).toBe('Not available');
  });

  it('compares LocalDate strings in calendar order', () => {
    const dates = ['2026-01-15', '2025-12-31', '2026-01-01'];

    expect([...dates].sort(compareLocalDates)).toEqual(['2025-12-31', '2026-01-01', '2026-01-15']);
  });

  it('treats LocalDate filter bounds as inclusive', () => {
    expect(isDateInRange('2026-01-01', '2026-01-01', '2026-01-31')).toBe(true);
    expect(isDateInRange('2026-01-31', '2026-01-01', '2026-01-31')).toBe(true);
    expect(isDateInRange('2026-02-01', '2026-01-01', '2026-01-31')).toBe(false);
  });

  it('derives month keys and leap-year bounds from LocalDate values', () => {
    expect(getMonthKey('2024-02-29')).toBe('2024-02');
    expect(getMonthBounds(2024, 2)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('counts calendar days across daylight saving time boundaries', () => {
    expect(getDaysBetween('2025-03-08', '2025-03-10')).toBe(2);
  });
});
