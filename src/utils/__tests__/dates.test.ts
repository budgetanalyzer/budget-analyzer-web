import { describe, expect, it } from 'vitest';
import {
  compareLocalDates,
  formatISOTimestampAsLocalDate,
  formatTimestamp,
  isoTimestampToLocalDateInputValue,
  localDateToEndOfDayISOTimestamp,
  localDateToStartOfDayISOTimestamp,
} from '@/utils/dates';

describe('dates utilities', () => {
  it('converts a LocalDate into local-day ISO timestamp bounds', () => {
    expect(localDateToStartOfDayISOTimestamp('2026-01-15')).toBe('2026-01-15T08:00:00.000Z');
    expect(localDateToEndOfDayISOTimestamp('2026-01-15')).toBe('2026-01-16T07:59:59.999Z');
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
});
