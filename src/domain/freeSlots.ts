/**
 * Calculate free time slots from busy periods
 */

import { DateTime, Interval } from "luxon";
import type { BusyPeriod } from "../api/calendar.ts";

export interface FreeSlot {
  start: DateTime;
  end: DateTime;
  duration: number; // in minutes
}

export interface FindSlotsOptions {
  minDuration: number; // Minimum slot duration in minutes
  workingHoursStart: number; // Hour to start (e.g., 9 for 9 AM)
  workingHoursEnd: number; // Hour to end (e.g., 17 for 5 PM)
  includeWeekends: boolean;
  timezone: string;
}

const DEFAULT_OPTIONS: FindSlotsOptions = {
  minDuration: 30,
  workingHoursStart: 9,
  workingHoursEnd: 17,
  includeWeekends: false,
  timezone: "local",
};

/**
 * Find available time slots within a date range, excluding busy periods
 * 
 * @param busyPeriods - Combined busy periods from all participants
 * @param rangeStart - Start of the search range
 * @param rangeEnd - End of the search range
 * @param options - Slot finding options
 * @returns Array of free slots sorted by start time
 */
export function findFreeSlots(
  busyPeriods: BusyPeriod[],
  rangeStart: DateTime,
  rangeEnd: DateTime,
  options: Partial<FindSlotsOptions> = {}
): FreeSlot[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const slots: FreeSlot[] = [];
  
  // Parse and sort busy periods
  const busy = busyPeriods
    .map((p) => ({
      start: DateTime.fromISO(p.start, { zone: opts.timezone }),
      end: DateTime.fromISO(p.end, { zone: opts.timezone }),
    }))
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());
  
  // Iterate through each day in the range
  let currentDay = rangeStart.startOf("day");
  const endDay = rangeEnd.startOf("day");
  
  while (currentDay <= endDay) {
    // Skip weekends if not included
    if (!opts.includeWeekends && (currentDay.weekday === 6 || currentDay.weekday === 7)) {
      currentDay = currentDay.plus({ days: 1 });
      continue;
    }
    
    // Define working hours for this day
    const dayStart = currentDay.set({ hour: opts.workingHoursStart, minute: 0, second: 0 });
    const dayEnd = currentDay.set({ hour: opts.workingHoursEnd, minute: 0, second: 0 });
    
    // Skip if this day is before range start or after range end
    if (dayEnd < rangeStart || dayStart > rangeEnd) {
      currentDay = currentDay.plus({ days: 1 });
      continue;
    }
    
    // Adjust for actual range boundaries
    const effectiveStart = dayStart < rangeStart ? rangeStart : dayStart;
    const effectiveEnd = dayEnd > rangeEnd ? rangeEnd : dayEnd;
    
    // Skip if effective start is in the past
    const now = DateTime.now();
    const actualStart = effectiveStart < now ? now : effectiveStart;
    
    if (actualStart >= effectiveEnd) {
      currentDay = currentDay.plus({ days: 1 });
      continue;
    }
    
    // Find free slots in this day's working hours
    const daySlots = findFreeSlotsInRange(actualStart, effectiveEnd, busy, opts.minDuration);
    slots.push(...daySlots);
    
    currentDay = currentDay.plus({ days: 1 });
  }
  
  return slots;
}

/**
 * Find free slots within a specific time range
 */
function findFreeSlotsInRange(
  start: DateTime,
  end: DateTime,
  busy: Array<{ start: DateTime; end: DateTime }>,
  minDuration: number
): FreeSlot[] {
  const slots: FreeSlot[] = [];
  
  // Filter busy periods that overlap with this range
  const relevantBusy = busy.filter(
    (b) => b.start < end && b.end > start
  );
  
  // If no busy periods, the entire range is free
  if (relevantBusy.length === 0) {
    const duration = end.diff(start, "minutes").minutes;
    if (duration >= minDuration) {
      slots.push({ start, end, duration: Math.floor(duration) });
    }
    return slots;
  }
  
  // Walk through the range, finding gaps between busy periods
  let currentStart = start;
  
  for (const busyPeriod of relevantBusy) {
    // If there's a gap before this busy period, it's a free slot
    if (busyPeriod.start > currentStart) {
      const gapEnd = busyPeriod.start < end ? busyPeriod.start : end;
      const duration = gapEnd.diff(currentStart, "minutes").minutes;
      
      if (duration >= minDuration) {
        slots.push({
          start: currentStart,
          end: gapEnd,
          duration: Math.floor(duration),
        });
      }
    }
    
    // Move current start to end of busy period
    if (busyPeriod.end > currentStart) {
      currentStart = busyPeriod.end;
    }
  }
  
  // Check for free time after the last busy period
  if (currentStart < end) {
    const duration = end.diff(currentStart, "minutes").minutes;
    if (duration >= minDuration) {
      slots.push({
        start: currentStart,
        end,
        duration: Math.floor(duration),
      });
    }
  }
  
  return slots;
}

/**
 * Split free slots into fixed-duration meeting slots
 * 
 * @param freeSlots - Available free time periods
 * @param meetingDuration - Desired meeting duration in minutes
 * @param gapBetweenSlots - Gap between suggested slots (default: meeting duration)
 * @returns Array of exact meeting slots
 */
export function splitIntoMeetingSlots(
  freeSlots: FreeSlot[],
  meetingDuration: number,
  gapBetweenSlots?: number
): FreeSlot[] {
  const gap = gapBetweenSlots ?? meetingDuration;
  const meetingSlots: FreeSlot[] = [];
  
  for (const slot of freeSlots) {
    // Only process slots that can fit at least one meeting
    if (slot.duration < meetingDuration) continue;
    
    let slotStart = slot.start;
    
    while (slotStart.plus({ minutes: meetingDuration }) <= slot.end) {
      meetingSlots.push({
        start: slotStart,
        end: slotStart.plus({ minutes: meetingDuration }),
        duration: meetingDuration,
      });
      
      slotStart = slotStart.plus({ minutes: gap });
    }
  }
  
  return meetingSlots;
}

/**
 * Combine busy periods from multiple people
 */
export function combineBusyPeriods(
  busyByPerson: Map<string, BusyPeriod[]>
): BusyPeriod[] {
  const allBusy: BusyPeriod[] = [];
  
  for (const busy of busyByPerson.values()) {
    allBusy.push(...busy);
  }
  
  // Sort and merge overlapping periods
  return mergeBusyPeriods(allBusy);
}

/**
 * Merge overlapping busy periods
 */
function mergeBusyPeriods(periods: BusyPeriod[]): BusyPeriod[] {
  if (periods.length === 0) return [];
  
  // Sort by start time
  const sorted = [...periods].sort((a, b) => a.start.localeCompare(b.start));
  
  const first = sorted[0];
  if (!first) return [];
  
  const merged: BusyPeriod[] = [{ start: first.start, end: first.end }];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (!current || !last) continue;
    
    // If current overlaps or is adjacent to last, merge them
    if (current.start <= last.end) {
      if (current.end > last.end) {
        last.end = current.end;
      }
    } else {
      merged.push({ start: current.start, end: current.end });
    }
  }
  
  return merged;
}
