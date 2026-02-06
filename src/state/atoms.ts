import { atom } from "jotai";
import { DateTime } from "luxon";
import type { GCalEvent } from "../domain/gcalEvent.ts";
import { layoutDay, getChronologicalEvents, type DayLayout } from "../domain/layout.ts";
import { getDaysRange, getLocalTimezone } from "../domain/time.ts";

// ===== Focus Context =====
export type FocusContext =
  | "days"
  | "timeline"
  | "details"
  | "dialog"
  | "command"
  | "confirm";

// ===== Overlay Types =====
export type OverlayKind = "details" | "dialog" | "confirm" | "command";

export interface Overlay {
  kind: OverlayKind;
  payload?: any;
  prevFocus?: FocusContext;
}

// Recurrence scope for edit/delete operations
export type RecurrenceScope = "this" | "following" | "all";

// Delete/Edit action state
export interface EventAction {
  eventId: string;
  scope?: RecurrenceScope;
  notifyAttendees?: boolean;
}

// ===== Core Atoms =====

// All events keyed by ID
export const eventsAtom = atom<Record<string, GCalEvent>>({});

// Anchor day for the visible days range (center of the list)
export const viewAnchorDayAtom = atom<DateTime>(DateTime.now().startOf("day"));

// Currently selected day (can move independently within the visible range)
export const selectedDayAtom = atom<DateTime>(DateTime.now().startOf("day"));

// Current focus context
export const focusAtom = atom<FocusContext>("timeline");

// Selected event ID
export const selectedEventIdAtom = atom<string | null>(null);

// Timeline scroll position (hour index 0-23)
export const timelineScrollAtom = atom<number>(8); // Default to 8 AM

// Overlay stack
export const overlayStackAtom = atom<Overlay[]>([]);

// Command input
export const commandInputAtom = atom<string>("");

// Command history
export const commandHistoryAtom = atom<string[]>([]);

// For dialog state - event being edited/created
export const dialogEventAtom = atom<Partial<GCalEvent> | null>(null);

// Edit mode flag
export const isEditModeAtom = atom<boolean>(false);

// Pending action (for delete/edit with recurrence scope)
export const pendingActionAtom = atom<EventAction | null>(null);

// Timezone
export const timezoneAtom = atom<string>(getLocalTimezone());

// ===== Derived Atoms =====

// Get selected event
export const selectedEventAtom = atom((get) => {
  const events = get(eventsAtom);
  const id = get(selectedEventIdAtom);
  return id ? events[id] || null : null;
});

// Get events as array sorted by start time
export const eventsArrayAtom = atom((get) => {
  const events = get(eventsAtom);
  return Object.values(events);
});

// Get events for the selected day
export const dayEventsAtom = atom((get) => {
  const events = get(eventsArrayAtom);
  const day = get(selectedDayAtom);
  const tz = get(timezoneAtom);
  const layout = layoutDay(events, day, tz);
  return getChronologicalEvents(layout);
});

// Get layout for the selected day
export const dayLayoutAtom = atom((get): DayLayout => {
  const events = get(eventsArrayAtom);
  const day = get(selectedDayAtom);
  const tz = get(timezoneAtom);
  return layoutDay(events, day, tz);
});

// Get days list for sidebar (uses anchor, not selected day)
export const daysListAtom = atom((get) => {
  const anchor = get(viewAnchorDayAtom);
  return getDaysRange(anchor, 7, 7); // 7 days before and after
});

// Get selected day index in days list
export const selectedDayIndexAtom = atom((get) => {
  const days = get(daysListAtom);
  const selectedDay = get(selectedDayAtom);
  return days.findIndex((d) => d.hasSame(selectedDay, "day"));
});

// Get top overlay
export const topOverlayAtom = atom((get) => {
  const stack = get(overlayStackAtom);
  return stack.length > 0 ? stack[stack.length - 1] : null;
});

// Check if there's any overlay open
export const hasOverlayAtom = atom((get) => {
  const stack = get(overlayStackAtom);
  return stack.length > 0;
});

// Check if event is recurring
export const isSelectedEventRecurringAtom = atom((get) => {
  const event = get(selectedEventAtom);
  if (!event) return false;
  return (event.recurrence && event.recurrence.length > 0) || !!event.recurringEventId;
});

// Check if selected event has other attendees (for notify prompt)
export const hasOtherAttendeesAtom = atom((get) => {
  const event = get(selectedEventAtom);
  if (!event || !event.attendees) return false;
  return event.attendees.some((a) => !a.self && !a.organizer);
});
