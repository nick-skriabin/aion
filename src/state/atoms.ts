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
  | "confirm"
  | "notifications";

// ===== Overlay Types =====
export type OverlayKind = "details" | "dialog" | "confirm" | "command" | "help" | "notifications";

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

// Command palette selection index
export const commandSelectedIndexAtom = atom<number>(0);

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

// ===== Auth State =====

// Whether the user is logged in (has any account)
export const isLoggedInAtom = atom<boolean>(false);

// Auth status message (for displaying login progress) - DEPRECATED, use messageAtom
export const authStatusAtom = atom<string | null>(null);

// Whether auth operation is in progress
export const isAuthLoadingAtom = atom<boolean>(false);

// Whether sync is currently running (prevents concurrent syncs)
export const isSyncingAtom = atom<boolean>(false);

// ===== Message System (Vim-style) =====

export type MessageType = "info" | "success" | "warning" | "error" | "progress";

export interface Message {
  id: string;
  text: string;
  type: MessageType;
  // For progress messages - optional progress indicator
  progress?: {
    current?: number;
    total?: number;
    phase?: string;
  };
}

// Current message to display in the command bar area
export const messageAtom = atom<Message | null>(null);

// Message visibility (hidden when command bar opens)
export const messageVisibleAtom = atom<boolean>(true);

// ===== Multi-Account State =====

export interface AccountState {
  email: string;
  name?: string;
  picture?: string;
}

// List of all logged-in accounts
export const accountsAtom = atom<AccountState[]>([]);

// Number of logged-in accounts
export const accountsCountAtom = atom((get) => get(accountsAtom).length);

// Map account email to color index (1-based to match calendarColors config)
export const accountColorMapAtom = atom((get) => {
  const accounts = get(accountsAtom);
  const colorMap: Record<string, number> = {};
  accounts.forEach((account, index) => {
    // Color indices are 1-based in the config (1-6)
    colorMap[account.email] = (index % 6) + 1;
  });
  return colorMap;
});

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

// Available height for the days sidebar (set by DaysSidebar component)
export const sidebarHeightAtom = atom<number>(15); // Default fallback

// Get days list for sidebar (dynamic based on available height)
export const daysListAtom = atom((get) => {
  const anchor = get(viewAnchorDayAtom);
  const availableHeight = get(sidebarHeightAtom);
  
  // Calculate how many days to show based on available height
  // Each day takes 1 line, we want roughly equal days before and after anchor
  const halfDays = Math.floor(availableHeight / 2);
  const daysBefore = halfDays;
  const daysAfter = availableHeight - halfDays - 1; // -1 for the anchor day itself
  
  return getDaysRange(anchor, daysBefore, daysAfter);
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

// Get all pending invites (events needing action)
export const pendingInvitesAtom = atom((get) => {
  const events = get(eventsArrayAtom);
  return events.filter((event) => {
    if (!event.attendees) return false;
    const selfAttendee = event.attendees.find((a) => a.self);
    return selfAttendee?.responseStatus === "needsAction";
  });
});
