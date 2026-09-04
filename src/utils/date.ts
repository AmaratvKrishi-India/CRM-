/**
 * Small, dependency-free date helpers for CRM presentation and scheduling.
 * Inputs are never mutated; invalid values return an explicit empty/null value.
 */

export type DateInput = Date | string | number | null | undefined;

function toValidDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Formats a date with a stable, locale-independent default for app copy. */
export function formatDate(value: DateInput, format: 'dd/MM/yyyy' | 'yyyy-MM-dd' | string = 'MMM d, yyyy'): string {
  const date = toValidDate(value);
  if (!date) return '';

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (format === 'dd/MM/yyyy') return `${pad(day)}/${pad(month + 1)}/${year}`;
  if (format === 'yyyy-MM-dd') return `${year}-${pad(month + 1)}-${pad(day)}`;

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date);
  return `${monthName} ${day}, ${year}`;
}

/** Human-readable elapsed time, using the caller's current clock. */
export function formatRelativeTime(value: DateInput, now: Date = new Date()): string {
  const date = toValidDate(value);
  if (!date) return '';

  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (elapsedSeconds < 60) return 'just now';

  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  if (hours < 48) return 'yesterday';

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} days ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export function parseISODate(value: string): Date | null {
  if (!value || typeof value !== 'string') return null;
  return toValidDate(value);
}

function sameCalendarDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function isToday(value: DateInput, now: Date = new Date()): boolean {
  const date = toValidDate(value);
  return !!date && sameCalendarDay(date, now);
}

export function isYesterday(value: DateInput, now: Date = new Date()): boolean {
  const date = toValidDate(value);
  if (!date) return false;
  const yesterday = startOfDay(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return sameCalendarDay(date, yesterday);
}

export function startOfDay(value: DateInput): Date {
  const date = toValidDate(value);
  if (!date) return new Date(NaN);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value: DateInput): Date {
  const date = toValidDate(value);
  if (!date) return new Date(NaN);
  date.setHours(23, 59, 59, 999);
  return date;
}

export function addDays(value: DateInput, days: number): Date {
  const date = toValidDate(value);
  if (!date) return new Date(NaN);
  date.setDate(date.getDate() + days);
  return date;
}

export function diffInDays(left: DateInput, right: DateInput): number {
  const leftDate = toValidDate(left);
  const rightDate = toValidDate(right);
  if (!leftDate || !rightDate) return Number.NaN;
  return Math.trunc((leftDate.getTime() - rightDate.getTime()) / 86_400_000);
}

export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`);
  return parts.join(' ');
}
