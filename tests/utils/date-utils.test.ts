/**
 * Date Utilities Unit Tests
 * Tests for date formatting, parsing, relative time
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatDate,
  formatRelativeTime,
  parseISODate,
  isToday,
  isYesterday,
  startOfDay,
  endOfDay,
  addDays,
  diffInDays,
  formatDuration,
} from '@/utils/date';

describe('Date Utilities', () => {
  const now = new Date('2024-01-15T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatDate', () => {
    it('should format ISO date string', () => {
      expect(formatDate('2024-01-15T10:30:00Z')).toBe('Jan 15, 2024');
      expect(formatDate('2024-12-25T00:00:00Z')).toBe('Dec 25, 2024');
    });

    it('should format with custom format', () => {
      expect(formatDate('2024-01-15T10:30:00Z', 'dd/MM/yyyy')).toBe('15/01/2024');
      expect(formatDate('2024-01-15T10:30:00Z', 'yyyy-MM-dd')).toBe('2024-01-15');
    });

    it('should handle Date objects', () => {
      expect(formatDate(new Date('2024-01-15T10:30:00Z'))).toBe('Jan 15, 2024');
    });

    it('should return empty string for invalid dates', () => {
      expect(formatDate('invalid')).toBe('');
      expect(formatDate(null as any)).toBe('');
      expect(formatDate(undefined as any)).toBe('');
    });
  });

  describe('formatRelativeTime', () => {
    it('should show "just now" for recent', () => {
      expect(formatRelativeTime(new Date(now.getTime() - 30000))).toBe('just now');
    });

    it('should show minutes ago', () => {
      expect(formatRelativeTime(new Date(now.getTime() - 5 * 60 * 1000))).toBe('5 minutes ago');
      expect(formatRelativeTime(new Date(now.getTime() - 30 * 60 * 1000))).toBe('30 minutes ago');
    });

    it('should show hours ago', () => {
      expect(formatRelativeTime(new Date(now.getTime() - 2 * 60 * 60 * 1000))).toBe('2 hours ago');
      expect(formatRelativeTime(new Date(now.getTime() - 12 * 60 * 60 * 1000))).toBe('12 hours ago');
    });

    it('should show "yesterday" for yesterday', () => {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(yesterday)).toBe('yesterday');
    });

    it('should show days ago', () => {
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
    });

    it('should show weeks ago', () => {
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoWeeksAgo)).toBe('2 weeks ago');
    });

    it('should show months ago', () => {
      const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoMonthsAgo)).toBe('2 months ago');
    });

    it('should show years ago', () => {
      const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoYearsAgo)).toBe('2 years ago');
    });
  });

  describe('parseISODate', () => {
    it('should parse valid ISO strings', () => {
      const date = parseISODate('2024-01-15T10:30:00Z');
      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2024);
      expect(date?.getMonth()).toBe(0); // January
      expect(date?.getDate()).toBe(15);
    });

    it('should return null for invalid strings', () => {
      expect(parseISODate('invalid')).toBeNull();
      expect(parseISODate('')).toBeNull();
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      expect(isToday(now)).toBe(true);
      expect(isToday('2024-01-15T10:00:00Z')).toBe(true);
    });

    it('should return false for other days', () => {
      expect(isToday('2024-01-14T10:00:00Z')).toBe(false);
      expect(isToday('2024-01-16T10:00:00Z')).toBe(false);
    });
  });

  describe('isYesterday', () => {
    it('should return true for yesterday', () => {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      expect(isYesterday(yesterday)).toBe(true);
    });

    it('should return false for other days', () => {
      expect(isYesterday(now)).toBe(false);
      expect(isYesterday('2024-01-13T10:00:00Z')).toBe(false);
    });
  });

  describe('startOfDay / endOfDay', () => {
    it('should return start of day', () => {
      const start = startOfDay(now);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    });

    it('should return end of day', () => {
      const end = endOfDay(now);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
      expect(end.getMilliseconds()).toBe(999);
    });
  });

  describe('addDays', () => {
    it('should add positive days', () => {
      const result = addDays(now, 5);
      expect(result.getDate()).toBe(20); // Jan 15 + 5 = Jan 20
    });

    it('should subtract days', () => {
      const result = addDays(now, -3);
      expect(result.getDate()).toBe(12); // Jan 15 - 3 = Jan 12
    });

    it('should handle month boundaries', () => {
      const jan31 = new Date('2024-01-31T12:00:00Z');
      const result = addDays(jan31, 1);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(1);
    });
  });

  describe('diffInDays', () => {
    it('should calculate positive difference', () => {
      const date1 = new Date('2024-01-15T12:00:00Z');
      const date2 = new Date('2024-01-10T12:00:00Z');
      expect(diffInDays(date1, date2)).toBe(5);
    });

    it('should calculate negative difference', () => {
      const date1 = new Date('2024-01-10T12:00:00Z');
      const date2 = new Date('2024-01-15T12:00:00Z');
      expect(diffInDays(date1, date2)).toBe(-5);
    });

    it('should return 0 for same day', () => {
      expect(diffInDays(now, now)).toBe(0);
    });
  });

  describe('formatDuration', () => {
    it('should format seconds', () => {
      expect(formatDuration(30)).toBe('30s');
      expect(formatDuration(59)).toBe('59s');
    });

    it('should format minutes', () => {
      expect(formatDuration(60)).toBe('1m');
      expect(formatDuration(120)).toBe('2m');
      expect(formatDuration(90)).toBe('1m 30s');
    });

    it('should format hours', () => {
      expect(formatDuration(3600)).toBe('1h');
      expect(formatDuration(7200)).toBe('2h');
      expect(formatDuration(5400)).toBe('1h 30m');
    });

    it('should format mixed', () => {
      expect(formatDuration(3661)).toBe('1h 1m 1s');
      expect(formatDuration(7320)).toBe('2h 2m');
    });

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0s');
    });
  });
});
