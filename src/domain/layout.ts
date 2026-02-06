import { DateTime } from "luxon";
import type { GCalEvent } from "./gcalEvent.ts";
import { isAllDay } from "./gcalEvent.ts";
import {
  getEventStart,
  getEventEnd,
  getMinutesFromMidnight,
  getHourBucket,
  getDurationMinutes,
  eventFallsOnDay,
  getLocalTimezone,
} from "./time.ts";

// Layout item for a timed event
export interface TimedEventLayout {
  event: GCalEvent;
  startMinutes: number; // 0-1440
  endMinutes: number; // 0-1440
  hourBucketStart: number; // 0-23
  hourBucketEnd: number; // 0-23
  durationMinutes: number;
  offsetInHour: number; // minutes past the hour start
  hasOverlap: boolean;
  overlapGroup: number; // for grouping overlapping events
  overlapIndex: number; // position within overlap group
  overlapCount: number; // total in overlap group
}

// Layout result for a day
export interface DayLayout {
  day: DateTime;
  timezone: string;
  allDayEvents: GCalEvent[];
  timedEvents: TimedEventLayout[];
  hourBuckets: Map<number, TimedEventLayout[]>;
}

// Pure function to compute layout for a day
export function layoutDay(
  events: GCalEvent[],
  day: DateTime,
  tz: string = getLocalTimezone()
): DayLayout {
  const dayStart = day.startOf("day");

  // Filter events that fall on this day
  const dayEvents = events.filter(
    (e) => e.status !== "cancelled" && eventFallsOnDay(e, dayStart, tz)
  );

  // Separate all-day and timed events
  const allDayEvents: GCalEvent[] = [];
  const timedEventsRaw: Array<{
    event: GCalEvent;
    start: DateTime;
    end: DateTime;
  }> = [];

  for (const event of dayEvents) {
    if (isAllDay(event)) {
      allDayEvents.push(event);
    } else {
      const start = getEventStart(event, tz);
      const end = getEventEnd(event, tz);
      timedEventsRaw.push({ event, start, end });
    }
  }

  // Sort timed events by start time
  timedEventsRaw.sort((a, b) => a.start.toMillis() - b.start.toMillis());

  // Compute layout info for each timed event
  const timedLayouts: TimedEventLayout[] = [];
  const dayEndMinutes = 24 * 60; // 1440

  for (const { event, start, end } of timedEventsRaw) {
    // Clamp to day boundaries
    const eventDayStart = start < dayStart ? dayStart : start;
    const dayEnd = dayStart.plus({ days: 1 });
    const eventDayEnd = end > dayEnd ? dayEnd : end;

    const startMinutes = Math.max(0, getMinutesFromMidnight(eventDayStart));
    const endMinutes = Math.min(
      dayEndMinutes,
      getMinutesFromMidnight(eventDayEnd)
    );
    const hourBucketStart = getHourBucket(eventDayStart);
    const hourBucketEnd = Math.min(23, Math.floor((endMinutes - 1) / 60));
    const offsetInHour = startMinutes % 60;

    timedLayouts.push({
      event,
      startMinutes,
      endMinutes: endMinutes === 0 ? dayEndMinutes : endMinutes, // Handle midnight wrap
      hourBucketStart,
      hourBucketEnd: endMinutes === 0 ? 23 : hourBucketEnd,
      durationMinutes: getDurationMinutes(eventDayStart, eventDayEnd),
      offsetInHour,
      hasOverlap: false,
      overlapGroup: 0,
      overlapIndex: 0,
      overlapCount: 1,
    });
  }

  // Detect overlaps
  detectOverlaps(timedLayouts);

  // Group by hour bucket
  const hourBuckets = new Map<number, TimedEventLayout[]>();
  for (let hour = 0; hour < 24; hour++) {
    hourBuckets.set(hour, []);
  }

  for (const layout of timedLayouts) {
    // Add to the start hour bucket
    const bucket = hourBuckets.get(layout.hourBucketStart);
    if (bucket) {
      bucket.push(layout);
    }
  }

  return {
    day: dayStart,
    timezone: tz,
    allDayEvents,
    timedEvents: timedLayouts,
    hourBuckets,
  };
}

// Detect and mark overlapping events
function detectOverlaps(layouts: TimedEventLayout[]): void {
  if (layouts.length === 0) return;

  let currentGroup = 0;
  const groups: TimedEventLayout[][] = [];

  // Sort by start time
  const sorted = [...layouts].sort(
    (a, b) => a.startMinutes - b.startMinutes
  );

  let currentGroupLayouts: TimedEventLayout[] = [];
  let groupEnd = 0;

  for (const layout of sorted) {
    if (currentGroupLayouts.length === 0) {
      // Start new group
      currentGroupLayouts.push(layout);
      groupEnd = layout.endMinutes;
    } else if (layout.startMinutes < groupEnd) {
      // Overlaps with current group
      currentGroupLayouts.push(layout);
      groupEnd = Math.max(groupEnd, layout.endMinutes);
    } else {
      // No overlap, save current group and start new
      if (currentGroupLayouts.length > 1) {
        groups.push(currentGroupLayouts);
      }
      currentGroupLayouts = [layout];
      groupEnd = layout.endMinutes;
      currentGroup++;
    }
  }

  // Don't forget last group
  if (currentGroupLayouts.length > 1) {
    groups.push(currentGroupLayouts);
  }

  // Mark overlapping events
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    if (!group) continue;
    for (let i = 0; i < group.length; i++) {
      const item = group[i];
      if (!item) continue;
      item.hasOverlap = true;
      item.overlapGroup = g;
      item.overlapIndex = i;
      item.overlapCount = group.length;
    }
  }
}

// Get all events in chronological order (for j/k navigation)
export function getChronologicalEvents(layout: DayLayout): GCalEvent[] {
  // All-day events first, then timed events by start time
  return [
    ...layout.allDayEvents,
    ...layout.timedEvents.map((l) => l.event),
  ];
}

// Find the event nearest to a given minute
export function findNearestEvent(
  layout: DayLayout,
  minuteOfDay: number
): GCalEvent | null {
  if (layout.timedEvents.length === 0) {
    return layout.allDayEvents[0] ?? null;
  }

  const firstEvent = layout.timedEvents[0];
  if (!firstEvent) return null;

  let nearest = firstEvent;
  let minDistance = Math.abs(nearest.startMinutes - minuteOfDay);

  for (const item of layout.timedEvents) {
    const distance = Math.abs(item.startMinutes - minuteOfDay);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = item;
    }
  }

  return nearest.event;
}

// Get layout for a specific event
export function getEventLayout(
  layout: DayLayout,
  eventId: string
): TimedEventLayout | undefined {
  return layout.timedEvents.find((l) => l.event.id === eventId);
}
