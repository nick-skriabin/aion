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
  // Column layout for overlapping events
  column: number; // 0-indexed column position
  totalColumns: number; // total columns in this overlap group
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

  // Sort timed events by start time, then by duration (longer first)
  timedEventsRaw.sort((a, b) => {
    const startDiff = a.start.toMillis() - b.start.toMillis();
    if (startDiff !== 0) return startDiff;
    // Longer events first for better visual layout
    return b.end.toMillis() - b.start.toMillis() - (a.end.toMillis() - a.start.toMillis());
  });

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
      endMinutes: endMinutes === 0 ? dayEndMinutes : endMinutes,
      hourBucketStart,
      hourBucketEnd: endMinutes === 0 ? 23 : hourBucketEnd,
      durationMinutes: getDurationMinutes(eventDayStart, eventDayEnd),
      offsetInHour,
      column: 0,
      totalColumns: 1,
    });
  }

  // Assign columns for overlapping events
  assignColumns(timedLayouts);

  // Group by hour bucket
  const hourBuckets = new Map<number, TimedEventLayout[]>();
  for (let hour = 0; hour < 24; hour++) {
    hourBuckets.set(hour, []);
  }

  for (const layout of timedLayouts) {
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

// Check if two events overlap in time
function eventsOverlap(a: TimedEventLayout, b: TimedEventLayout): boolean {
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

// Assign columns to overlapping events using a greedy algorithm
function assignColumns(layouts: TimedEventLayout[]): void {
  if (layouts.length === 0) return;

  // Find all overlap clusters
  const clusters: TimedEventLayout[][] = [];
  const assigned = new Set<TimedEventLayout>();

  for (const layout of layouts) {
    if (assigned.has(layout)) continue;

    // Find all events that overlap with this one (transitively)
    const cluster: TimedEventLayout[] = [];
    const queue: TimedEventLayout[] = [layout];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (assigned.has(current)) continue;

      assigned.add(current);
      cluster.push(current);

      // Find all overlapping events
      for (const other of layouts) {
        if (!assigned.has(other) && eventsOverlap(current, other)) {
          queue.push(other);
        }
      }
    }

    if (cluster.length > 0) {
      clusters.push(cluster);
    }
  }

  // Assign columns within each cluster
  for (const cluster of clusters) {
    // Sort by start time, then by duration (longer first)
    cluster.sort((a, b) => {
      const startDiff = a.startMinutes - b.startMinutes;
      if (startDiff !== 0) return startDiff;
      return b.durationMinutes - a.durationMinutes;
    });

    // Greedy column assignment
    const columnEnds: number[] = []; // Track when each column becomes free

    for (const layout of cluster) {
      // Find the first column where this event fits
      let col = 0;
      while (col < columnEnds.length && columnEnds[col]! > layout.startMinutes) {
        col++;
      }

      layout.column = col;
      
      // Update or add column end time
      if (col < columnEnds.length) {
        columnEnds[col] = layout.endMinutes;
      } else {
        columnEnds.push(layout.endMinutes);
      }
    }

    // Set total columns for all events in cluster
    const totalCols = columnEnds.length;
    for (const layout of cluster) {
      layout.totalColumns = totalCols;
    }
  }
}

// Get all events in chronological order (for j/k navigation)
export function getChronologicalEvents(layout: DayLayout): GCalEvent[] {
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
