import { DateTime, Interval } from "luxon";
import type { GCalEvent, TimeObject } from "./gcalEvent.ts";

// Get the default timezone
export function getLocalTimezone(): string {
  return DateTime.local().zoneName ?? "UTC";
}

// Parse a TimeObject to a Luxon DateTime in the target timezone
export function parseTimeObject(
  time: TimeObject,
  targetTz: string = getLocalTimezone()
): DateTime {
  if (time.dateTime) {
    // Parse ISO datetime in its original timezone, then convert to target timezone
    const originalTz = time.timeZone || targetTz;
    const dt = DateTime.fromISO(time.dateTime, { zone: originalTz });
    if (!dt.isValid) return DateTime.now().setZone(targetTz);
    // Convert to target timezone so display shows local time
    return dt.setZone(targetTz);
  }
  if (time.date) {
    // All-day event: parse as start of day in target timezone
    const dt = DateTime.fromISO(time.date, { zone: targetTz }).startOf("day");
    return dt.isValid ? dt : DateTime.now().setZone(targetTz);
  }
  return DateTime.now().setZone(targetTz);
}

// Create a TimeObject from DateTime
export function toTimeObject(
  dt: DateTime,
  isAllDay: boolean,
  tz?: string
): TimeObject {
  if (isAllDay) {
    return {
      date: dt.toFormat("yyyy-MM-dd"),
    };
  }
  return {
    dateTime: dt.toISO() ?? undefined,
    timeZone: tz || (dt.zoneName ?? undefined),
  };
}

// Get event start DateTime
export function getEventStart(
  event: GCalEvent,
  tz: string = getLocalTimezone()
): DateTime {
  return parseTimeObject(event.start, tz);
}

// Get event end DateTime
export function getEventEnd(
  event: GCalEvent,
  tz: string = getLocalTimezone()
): DateTime {
  return parseTimeObject(event.end, tz);
}

// Get minutes from midnight (0-1440)
export function getMinutesFromMidnight(dt: DateTime): number {
  return dt.hour * 60 + dt.minute;
}

// Get hour bucket (0-23)
export function getHourBucket(dt: DateTime): number {
  return dt.hour;
}

// Format time for display
export function formatTime(dt: DateTime): string {
  return dt.toFormat("HH:mm");
}

// Format time range
export function formatTimeRange(start: DateTime, end: DateTime): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

// Format date for sidebar
export function formatDayShort(dt: DateTime): string {
  return dt.toFormat("ccc d"); // e.g., "Mon 5"
}

// Format date header
export function formatDayHeader(dt: DateTime): string {
  return dt.toFormat("cccc, MMMM d"); // e.g., "Monday, February 5"
}

// Check if two dates are the same day
export function isSameDay(a: DateTime, b: DateTime): boolean {
  return a.hasSame(b, "day");
}

// Check if a DateTime is today
export function isToday(dt: DateTime): boolean {
  return isSameDay(dt, DateTime.now());
}

// Get days range around a given day
export function getDaysRange(
  center: DateTime,
  before: number = 7,
  after: number = 7
): DateTime[] {
  const days: DateTime[] = [];
  for (let i = -before; i <= after; i++) {
    days.push(center.plus({ days: i }).startOf("day"));
  }
  return days;
}

// Check if event falls on a specific day
export function eventFallsOnDay(
  event: GCalEvent,
  day: DateTime,
  tz: string = getLocalTimezone()
): boolean {
  const eventStart = getEventStart(event, tz);
  const eventEnd = getEventEnd(event, tz);
  const dayStart = day.startOf("day");
  const dayEnd = day.endOf("day");

  // For all-day events, Google uses exclusive end dates
  // So if start.date is "2024-02-05" and end.date is "2024-02-06"
  // the event is only on Feb 5
  if (event.start.date && event.end.date) {
    const startDate = DateTime.fromISO(event.start.date);
    const endDate = DateTime.fromISO(event.end.date);
    return startDate <= day && day < endDate;
  }

  // For timed events, check if there's any overlap
  const eventInterval = Interval.fromDateTimes(eventStart, eventEnd);
  const dayInterval = Interval.fromDateTimes(dayStart, dayEnd);
  return eventInterval.overlaps(dayInterval);
}

// Get current "now" minute of day
export function getNowMinutes(): number {
  return getMinutesFromMidnight(DateTime.now());
}

// Get the nearest hour
export function roundToNearestHour(dt: DateTime): DateTime {
  const minutes = dt.minute;
  if (minutes >= 30) {
    return dt.plus({ hours: 1 }).startOf("hour");
  }
  return dt.startOf("hour");
}

// Duration in minutes
export function getDurationMinutes(start: DateTime, end: DateTime): number {
  return end.diff(start, "minutes").minutes;
}
