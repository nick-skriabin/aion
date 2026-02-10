import { atom } from "jotai";
import { DateTime } from "luxon";
import type { GCalEvent } from "../domain/gcalEvent.ts";
import { layoutDay, getChronologicalEvents, type DayLayout } from "../domain/layout.ts";
import { getDaysRange, getLocalTimezone } from "../domain/time.ts";

// ===== Focus Context =====
export type FocusContext =
  | "calendars"
  | "days"
  | "timeline"
  | "details"
  | "dialog"
  | "command"
  | "confirm"
  | "notifications"
  | "search";

// ===== Overlay Types =====
export type OverlayKind = "details" | "dialog" | "confirm" | "command" | "help" | "notifications" | "proposeTime" | "goto" | "meetWith" | "accounts" | "search";

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
  type?: "edit" | "delete" | "proposeTime";
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

// Whether all-day events section is expanded (shows all events vs collapsed summary)
export const allDayExpandedAtom = atom<boolean>(false);

// ===== Search =====

// Search query
export const searchQueryAtom = atom<string>("");

// Search results (event IDs)
export const searchResultsAtom = atom<GCalEvent[]>([]);

// Selected index in search results
export const searchSelectedIndexAtom = atom<number>(0);

// ===== Multi-Day View =====

// Number of columns to display (1 or 3)
export const columnCountAtom = atom<number>(1);

// Currently focused column (0-indexed, 0 = main column)
export const focusedColumnAtom = atom<number>(0);

// Shared scroll offset for synchronized timeline scrolling (slot index)
export const sharedScrollOffsetAtom = atom<number>(7 * 4); // Default to 7 AM (7 hours * 4 slots/hour)

// ===== Calendar Sidebar =====

// Whether the calendar sidebar is visible
export const calendarSidebarVisibleAtom = atom<boolean>(false);

// Set of enabled calendar IDs (format: "accountEmail:calendarId")
// Empty set means all calendars are enabled (default behavior)
export const enabledCalendarsAtom = atom<Set<string>>(new Set());

// Whether we've loaded the initial enabled calendars from disk
export const enabledCalendarsLoadedAtom = atom<boolean>(false);

// Selected index in the calendar sidebar for navigation
export const selectedCalendarIndexAtom = atom<number>(0);

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

// Flag to add Google Meet to new/edited events
export const addGoogleMeetAtom = atom<boolean>(false);

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

// ===== Calendars State =====

export interface CalendarInfo {
  id: string;
  summary: string;
  primary?: boolean;
  accountEmail: string;
  backgroundColor?: string;
  foregroundColor?: string;
}

// List of all calendars across all accounts
export const calendarsAtom = atom<CalendarInfo[]>([]);

// Calendars grouped by account email
export const calendarsByAccountAtom = atom((get) => {
  const calendars = get(calendarsAtom);
  const byAccount: Record<string, CalendarInfo[]> = {};
  
  for (const cal of calendars) {
    if (!byAccount[cal.accountEmail]) {
      byAccount[cal.accountEmail] = [];
    }
    byAccount[cal.accountEmail].push(cal);
  }
  
  return byAccount;
});

// Calendar color map: key is "accountEmail:calendarId", value is the background color
export const calendarColorMapAtom = atom((get) => {
  const calendars = get(calendarsAtom);
  const colorMap: Record<string, string> = {};
  
  for (const cal of calendars) {
    const key = `${cal.accountEmail}:${cal.id}`;
    colorMap[key] = cal.backgroundColor || "#4285f4"; // Default to Google blue
  }
  
  return colorMap;
});

// Helper to get calendar color for an event
export function getCalendarColor(
  accountEmail: string | undefined,
  calendarId: string | undefined,
  colorMap: Record<string, string>
): string {
  if (!accountEmail || !calendarId) return "#4285f4";
  const key = `${accountEmail}:${calendarId}`;
  return colorMap[key] || "#4285f4";
}

// ===== Derived Atoms =====

// Get selected event
export const selectedEventAtom = atom((get) => {
  const events = get(eventsAtom);
  const id = get(selectedEventIdAtom);
  return id ? events[id] || null : null;
});

// Get events as array sorted by start time (unfiltered)
export const eventsArrayAtom = atom((get) => {
  const events = get(eventsAtom);
  return Object.values(events);
});

// Get events filtered by enabled calendars
export const filteredEventsArrayAtom = atom((get) => {
  const events = get(eventsArrayAtom);
  const disabledCalendars = get(enabledCalendarsAtom);
  
  // If no calendars are disabled, return all events
  if (disabledCalendars.size === 0) {
    return events;
  }
  
  // Filter out events from disabled calendars
  return events.filter((event) => {
    const calendarKey = `${event.accountEmail}:${event.calendarId}`;
    return !disabledCalendars.has(calendarKey);
  });
});

// Get events for the selected day
export const dayEventsAtom = atom((get) => {
  const events = get(filteredEventsArrayAtom);
  const day = get(selectedDayAtom);
  const tz = get(timezoneAtom);
  const layout = layoutDay(events, day, tz);
  return getChronologicalEvents(layout);
});

// Get the day for the currently focused column
export const focusedColumnDayAtom = atom((get) => {
  const selectedDay = get(selectedDayAtom);
  const focusedColumn = get(focusedColumnAtom);
  return selectedDay.plus({ days: focusedColumn });
});

// Get events for the currently focused column (respects all-day collapse state)
const ALL_DAY_COLLAPSE_THRESHOLD = 2;

export const focusedColumnEventsAtom = atom((get) => {
  const events = get(filteredEventsArrayAtom);
  const day = get(focusedColumnDayAtom);
  const tz = get(timezoneAtom);
  const allDayExpanded = get(allDayExpandedAtom);
  const layout = layoutDay(events, day, tz);
  
  // When collapsed, only include visible all-day events
  const shouldCollapse = layout.allDayEvents.length > ALL_DAY_COLLAPSE_THRESHOLD && !allDayExpanded;
  const visibleAllDayEvents = shouldCollapse 
    ? layout.allDayEvents.slice(0, ALL_DAY_COLLAPSE_THRESHOLD)
    : layout.allDayEvents;
  
  return [
    ...visibleAllDayEvents,
    ...layout.timedEvents.map((l) => l.event),
  ];
});

// Get layout for the selected day
export const dayLayoutAtom = atom((get): DayLayout => {
  const events = get(filteredEventsArrayAtom);
  const day = get(selectedDayAtom);
  const tz = get(timezoneAtom);
  return layoutDay(events, day, tz);
});

// Helper function to create a layout for any day
export function createDayLayout(events: GCalEvent[], day: DateTime, tz: string): DayLayout {
  return layoutDay(events, day, tz);
}

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
  const events = get(filteredEventsArrayAtom);
  return events.filter((event) => {
    if (!event.attendees) return false;
    const selfAttendee = event.attendees.find((a) => a.self);
    return selfAttendee?.responseStatus === "needsAction";
  });
});

// ===== Meet With Feature =====

// Contact for people picker
export interface Contact {
  email: string;
  displayName?: string;
  photoUrl?: string;
}

// Meet With state
export interface MeetWithState {
  step: "people" | "slots";
  selectedPeople: Contact[];
  duration: number; // in minutes
  dateRange: {
    start: DateTime;
    end: DateTime;
  };
}

// Meet With state atom
export const meetWithStateAtom = atom<MeetWithState>({
  step: "people",
  selectedPeople: [],
  duration: 30, // default 30 minutes
  dateRange: {
    start: DateTime.now().startOf("day"),
    end: DateTime.now().plus({ days: 7 }).endOf("day"),
  },
});

// Available time slot
export interface TimeSlot {
  start: DateTime;
  end: DateTime;
  duration: number; // in minutes
}

// Busy period (taken time)
export interface BusyPeriod {
  start: DateTime;
  end: DateTime;
}

// Fetched available slots
export const availableSlotsAtom = atom<TimeSlot[]>([]);

// Fetched busy periods (for visualization)
export const busyPeriodsAtom = atom<BusyPeriod[]>([]);

// Loading state for slots
export const slotsLoadingAtom = atom<boolean>(false);

// Known contacts (extracted from event attendees)
export const knownContactsAtom = atom<Contact[]>([]);

// Derive known contacts from events
export const deriveContactsAtom = atom((get) => {
  const events = get(eventsArrayAtom);
  const contactMap = new Map<string, Contact>();
  
  for (const event of events) {
    // Add organizer
    if (event.organizer?.email && !event.organizer.self) {
      const existing = contactMap.get(event.organizer.email);
      if (!existing || (!existing.displayName && event.organizer.displayName)) {
        contactMap.set(event.organizer.email, {
          email: event.organizer.email,
          displayName: event.organizer.displayName,
        });
      }
    }
    
    // Add attendees
    if (event.attendees) {
      for (const attendee of event.attendees) {
        if (attendee.self) continue; // Skip self
        const existing = contactMap.get(attendee.email);
        if (!existing || (!existing.displayName && attendee.displayName)) {
          contactMap.set(attendee.email, {
            email: attendee.email,
            displayName: attendee.displayName,
          });
        }
      }
    }
  }
  
  // Sort by display name or email
  return Array.from(contactMap.values()).sort((a, b) => {
    const nameA = a.displayName || a.email;
    const nameB = b.displayName || b.email;
    return nameA.localeCompare(nameB);
  });
});
