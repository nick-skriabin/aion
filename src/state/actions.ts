import { atom, type Getter, type Setter, type WritableAtom } from "jotai";
import { DateTime } from "luxon";
import type { GCalEvent, ResponseStatus } from "../domain/gcalEvent.ts";
import { findNearestEvent } from "../domain/layout.ts";
import { getNowMinutes, getLocalTimezone } from "../domain/time.ts";
import { eventsRepo } from "../db/eventsRepo.ts";
import { appLogger } from "../lib/logger.ts";
import {
  eventsAtom,
  selectedDayAtom,
  viewAnchorDayAtom,
  focusAtom,
  selectedEventIdAtom,
  timelineScrollAtom,
  overlayStackAtom,
  commandInputAtom,
  commandSelectedIndexAtom,
  dialogEventAtom,
  isEditModeAtom,
  addGoogleMeetAtom,
  pendingActionAtom,
  dayLayoutAtom,
  dayEventsAtom,
  messageAtom,
  messageVisibleAtom,
  sidebarHeightAtom,
  allDayExpandedAtom,
  timezoneAtom,
  calendarsAtom,
  calendarSidebarVisibleAtom,
  type FocusContext,
  type Overlay,
  type OverlayKind,
  type RecurrenceScope,
  type Message,
  type MessageType,
} from "./atoms.ts";

// Helper to create action atoms
type ActionAtom<T> = WritableAtom<null, [T], void>;

// ===== Overlay Actions =====

// Push overlay onto stack
export const pushOverlayAtom = atom(
  null,
  (get, set, overlay: { kind: OverlayKind; payload?: any }) => {
    const currentFocus = get(focusAtom);
    const stack = get(overlayStackAtom);
    set(overlayStackAtom, [
      ...stack,
      { ...overlay, prevFocus: currentFocus },
    ]);
    // Set focus based on overlay kind (help doesn't change focus)
    if (overlay.kind !== "help") {
      set(focusAtom, overlay.kind as FocusContext);
    }
  }
);

// Pop overlay from stack
export const popOverlayAtom = atom(null, (get, set) => {
  const stack = get(overlayStackAtom);
  const top = stack[stack.length - 1];
  if (!top) return;
  
  set(overlayStackAtom, stack.slice(0, -1));
  
  // Restore previous focus
  if (top.prevFocus) {
    set(focusAtom, top.prevFocus);
  } else {
    set(focusAtom, "timeline");
  }
  
  // Clear dialog state if closing dialog
  if (top.kind === "dialog") {
    set(dialogEventAtom, null);
    set(isEditModeAtom, false);
    set(addGoogleMeetAtom, false);
  }
  
  // Clear pending action if closing confirm
  if (top.kind === "confirm") {
    set(pendingActionAtom, null);
  }
  
  // Clear command input if closing command
  if (top.kind === "command") {
    set(commandInputAtom, "");
  }
});

// ===== Focus Actions =====

// Toggle focus between days and timeline
export const toggleFocusAtom = atom(null, (get, set) => {
  const focus = get(focusAtom);
  const hasOverlay = get(overlayStackAtom).length > 0;
  
  if (hasOverlay) return; // Don't toggle if overlay is open
  
  if (focus === "days") {
    set(focusAtom, "timeline");
  } else if (focus === "timeline") {
    set(focusAtom, "days");
  }
});

// ===== Navigation Actions =====

// Move day selection (for sidebar)
// Also shifts the visible range when selection goes near edges
export const moveDaySelectionAtom = atom(
  null,
  (get, set, direction: "up" | "down" | "start" | "end") => {
    const selectedDay = get(selectedDayAtom);
    const anchor = get(viewAnchorDayAtom);
    const sidebarHeight = get(sidebarHeightAtom);
    
    // Calculate visible range bounds (days before/after anchor)
    const halfDays = Math.floor(sidebarHeight / 2);
    const daysBefore = halfDays;
    const daysAfter = sidebarHeight - halfDays - 1;
    
    let newDay: DateTime;
    switch (direction) {
      case "up":
        newDay = selectedDay.minus({ days: 1 });
        break;
      case "down":
        newDay = selectedDay.plus({ days: 1 });
        break;
      case "start":
        // Jump by roughly half the visible range
        newDay = selectedDay.minus({ days: halfDays });
        break;
      case "end":
        // Jump by roughly half the visible range
        newDay = selectedDay.plus({ days: halfDays });
        break;
      default:
        return;
    }
    
    set(selectedDayAtom, newDay);
    
    // Shift anchor if new day is outside visible range
    const diffFromAnchor = newDay.diff(anchor, "days").days;
    if (diffFromAnchor > daysAfter) {
      // Selection went past the end - shift anchor forward
      set(viewAnchorDayAtom, newDay.minus({ days: daysAfter }));
    } else if (diffFromAnchor < -daysBefore) {
      // Selection went past the start - shift anchor backward
      set(viewAnchorDayAtom, newDay.plus({ days: daysBefore }));
    }
  }
);

// Select day and focus timeline (pass explicit day)
export const selectDayAtom = atom(null, (get, set, day: DateTime) => {
  set(selectedDayAtom, day.startOf("day"));
  set(focusAtom, "timeline");
  set(selectedEventIdAtom, null);
});

// Confirm current day selection and focus timeline (reads current selectedDay internally)
export const confirmDaySelectionAtom = atom(null, (get, set) => {
  // Just switch focus - selectedDayAtom is already set by navigation
  set(focusAtom, "timeline");
  set(selectedEventIdAtom, null);
});

// Move event selection in timeline
export const moveEventSelectionAtom = atom(
  null,
  (get, set, direction: "next" | "prev" | "first" | "last") => {
    const events = get(dayEventsAtom);
    const currentId = get(selectedEventIdAtom);
    
    if (events.length === 0) return;
    
    const currentIndex = currentId
      ? events.findIndex((e) => e.id === currentId)
      : -1;
    
    let newIndex: number;
    switch (direction) {
      case "next":
        newIndex = currentIndex < events.length - 1 ? currentIndex + 1 : currentIndex;
        break;
      case "prev":
        newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        break;
      case "first":
        newIndex = 0;
        break;
      case "last":
        newIndex = events.length - 1;
        break;
    }
    
    const selectedEvent = events[newIndex];
    if (selectedEvent) {
      set(selectedEventIdAtom, selectedEvent.id);
    }
  }
);

// Jump to now
export const jumpToNowAtom = atom(null, (get, set) => {
  const today = DateTime.now().startOf("day");
  set(selectedDayAtom, today);
  
  const layout = get(dayLayoutAtom);
  const nowMinutes = getNowMinutes();
  const nearestEvent = findNearestEvent(layout, nowMinutes);
  
  if (nearestEvent) {
    set(selectedEventIdAtom, nearestEvent.id);
  }
  
  // Scroll to current hour
  const currentHour = Math.floor(nowMinutes / 60);
  set(timelineScrollAtom, Math.max(0, currentHour - 2));
});

// Scroll timeline
export const scrollTimelineAtom = atom(
  null,
  (get, set, direction: "up" | "down" | number) => {
    const current = get(timelineScrollAtom);
    
    if (typeof direction === "number") {
      set(timelineScrollAtom, Math.max(0, Math.min(23, direction)));
    } else if (direction === "up") {
      set(timelineScrollAtom, Math.max(0, current - 6));
    } else {
      set(timelineScrollAtom, Math.min(23, current + 6));
    }
  }
);

// Toggle all-day events section expanded/collapsed
export const toggleAllDayExpandedAtom = atom(null, (get, set) => {
  const current = get(allDayExpandedAtom);
  set(allDayExpandedAtom, !current);
});

// Toggle calendar sidebar visibility
export const toggleCalendarSidebarAtom = atom(null, (get, set) => {
  const current = get(calendarSidebarVisibleAtom);
  set(calendarSidebarVisibleAtom, !current);
  
  // If opening the sidebar, focus it
  if (!current) {
    set(focusAtom, "calendars");
  } else {
    // If closing, return focus to days
    set(focusAtom, "days");
  }
});

// ===== Event Actions =====

// Open details panel for selected event
export const openDetailsAtom = atom(null, (get, set) => {
  const selectedId = get(selectedEventIdAtom);
  if (!selectedId) return;
  
  set(pushOverlayAtom, { kind: "details", payload: { eventId: selectedId } });
});

// Open event dialog for creating new event
export const openNewDialogAtom = atom(null, (get, set, prefillTitle?: string) => {
  const selectedDay = get(selectedDayAtom);
  const now = DateTime.now();
  const tz = getLocalTimezone();
  
  // Default to next hour
  const startHour = now.hour < 23 ? now.hour + 1 : now.hour;
  const start = selectedDay.set({ hour: startHour, minute: 0 });
  const end = start.plus({ hours: 1 });
  
  const newEvent: Partial<GCalEvent> = {
    summary: prefillTitle || "",
    status: "confirmed",
    eventType: "default",
    start: { dateTime: start.toISO() ?? undefined, timeZone: tz },
    end: { dateTime: end.toISO() ?? undefined, timeZone: tz },
  };
  
  set(dialogEventAtom, newEvent);
  set(isEditModeAtom, false);
  set(pushOverlayAtom, { kind: "dialog" });
});

// Open event dialog for editing
export const openEditDialogAtom = atom(null, async (get, set) => {
  const event = get(eventsAtom)[get(selectedEventIdAtom) || ""];
  if (!event) return;
  
  const { canEdit } = await import("../domain/gcalEvent.ts");
  
  // Check if user can edit this event
  if (!canEdit(event)) {
    set(showMessageAtom, { 
      text: "Can't edit - you're not the organizer. Press 'p' to propose new time.", 
      type: "warning" 
    });
    return;
  }
  
  // Open edit dialog directly - scope selection happens on save for recurring events
  set(dialogEventAtom, { ...event });
  set(isEditModeAtom, true);
  set(pendingActionAtom, null); // Clear any pending action
  set(pushOverlayAtom, { kind: "dialog" });
});

// Propose new time for an event (for non-organizers)
export const proposeNewTimeAtom = atom(null, async (get, set) => {
  const event = get(eventsAtom)[get(selectedEventIdAtom) || ""];
  if (!event) return;
  
  const { isOrganizer } = await import("../domain/gcalEvent.ts");
  
  // If user is the organizer, just open full edit
  if (isOrganizer(event)) {
    set(openEditDialogAtom);
    return;
  }
  
  // Open propose time dialog
  set(dialogEventAtom, { ...event });
  set(isEditModeAtom, true);
  set(pendingActionAtom, { eventId: event.id, type: "proposeTime" });
  set(pushOverlayAtom, { kind: "proposeTime" });
});

// Continue edit after scope selection (for recurring events)
export const continueEditWithScopeAtom = atom(
  null,
  (get, set, scope: RecurrenceScope) => {
    const pending = get(pendingActionAtom);
    if (!pending) return;
    
    // Set the scope and perform the save
    set(pendingActionAtom, { ...pending, scope });
    set(popOverlayAtom); // Close scope selector
    set(performSaveAtom); // Now actually save with the scope
  }
);

// Save event (create or update)
export const saveEventAtom = atom(null, async (get, set) => {
  const dialogEvent = get(dialogEventAtom);
  const isEditMode = get(isEditModeAtom);
  const pendingAction = get(pendingActionAtom);
  
  if (!dialogEvent) return;
  
  // Check if editing a recurring event without scope selected yet
  if (isEditMode && dialogEvent.id) {
    const { isRecurring } = await import("../domain/gcalEvent.ts");
    const eventIsRecurring = isRecurring(dialogEvent as GCalEvent);
    
    // If recurring and no scope set, show scope selection dialog
    if (eventIsRecurring && !pendingAction?.scope) {
      set(pendingActionAtom, { eventId: dialogEvent.id });
      set(pushOverlayAtom, { kind: "confirm", payload: { type: "editScope" } });
      return; // Wait for scope selection
    }
  }
  
  // Proceed with actual save
  set(performSaveAtom);
});

// Perform the actual save (called after scope selection for recurring events)
export const performSaveAtom = atom(null, async (get, set) => {
  const dialogEvent = get(dialogEventAtom);
  const isEditMode = get(isEditModeAtom);
  const pendingAction = get(pendingActionAtom);
  
  if (!dialogEvent) return;
  
  const now = new Date().toISOString();
  const { isLoggedInAtom } = await import("./atoms.ts");
  const isLoggedIn = get(isLoggedInAtom);
  
  if (isEditMode && dialogEvent.id) {
    // Update existing event
    const originalEvent = get(eventsAtom)[dialogEvent.id];
    let event: GCalEvent = {
      ...dialogEvent,
      updatedAt: now,
    } as GCalEvent;
    
    // Try to update on Google Calendar first if logged in
    if (isLoggedIn && dialogEvent.accountEmail) {
      try {
        set(showMessageAtom, { text: "Updating event...", type: "progress" });
        
        const { updateEvent } = await import("../api/calendar.ts");
        const { addGoogleMeetAtom } = await import("./atoms.ts");
        const addGoogleMeet = get(addGoogleMeetAtom);
        
        const updatedEvent = await updateEvent(
          dialogEvent.id,
          {
            summary: dialogEvent.summary,
            description: dialogEvent.description,
            location: dialogEvent.location,
            start: dialogEvent.start,
            end: dialogEvent.end,
            attendees: dialogEvent.attendees,
            eventType: dialogEvent.eventType,
            recurrence: dialogEvent.recurrence,
          },
          dialogEvent.calendarId || "primary",
          dialogEvent.accountEmail,
          pendingAction?.scope, // Pass the recurrence scope
          originalEvent, // Pass original event for recurring event handling
          addGoogleMeet // Add Google Meet link
        );
        event = { ...event, ...updatedEvent, updatedAt: now };
        set(showMessageAtom, { text: "Event updated", type: "success" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        set(showMessageAtom, { text: `Update failed: ${message}`, type: "error" });
        return; // Don't save locally if API failed
      }
    }
    
    await eventsRepo.update(event);
    set(eventsAtom, (prev) => ({ ...prev, [event.id]: event }));
  } else {
    // Create new event
    let event: GCalEvent = {
      ...dialogEvent,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as GCalEvent;
    
    // Try to create on Google Calendar first if logged in
    if (isLoggedIn) {
      try {
        set(showMessageAtom, { text: "Creating event...", type: "progress" });
        
        const { createEvent } = await import("../api/calendar.ts");
        const { getDefaultAccount } = await import("../auth/index.ts");
        const { addGoogleMeetAtom } = await import("./atoms.ts");
        const addGoogleMeet = get(addGoogleMeetAtom);
        
        // Use selected account from dialog, or fall back to default account
        let accountEmail = dialogEvent.accountEmail;
        if (!accountEmail) {
          const defaultAccount = await getDefaultAccount();
          accountEmail = defaultAccount?.account.email;
        }
        
        if (accountEmail) {
          const createdEvent = await createEvent(
            {
              summary: dialogEvent.summary || "New Event",
              description: dialogEvent.description,
              location: dialogEvent.location,
              start: dialogEvent.start,
              end: dialogEvent.end,
              attendees: dialogEvent.attendees,
              eventType: dialogEvent.eventType,
              recurrence: dialogEvent.recurrence,
            },
            dialogEvent.calendarId || "primary",
            accountEmail,
            addGoogleMeet // Add Google Meet link
          );
          event = { ...event, ...createdEvent, createdAt: now, updatedAt: now };
          set(showMessageAtom, { text: "Event created", type: "success" });
        } else {
          set(showMessageAtom, { text: "No account selected", type: "error" });
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        set(showMessageAtom, { text: `Create failed: ${message}`, type: "error" });
        return; // Don't save locally if API failed
      }
    }
    
    await eventsRepo.create(event);
    set(eventsAtom, (prev) => ({ ...prev, [event.id]: event }));
    set(selectedEventIdAtom, event.id);
    
    // Navigate to the day of the new event
    const { parseTimeObject, getLocalTimezone } = await import("../domain/time.ts");
    const tz = get(timezoneAtom) || getLocalTimezone();
    if (event.start) {
      const eventDay = parseTimeObject(event.start, tz).startOf("day");
      set(selectedDayAtom, eventDay);
    }
  }
  
  // Close dialog
  set(popOverlayAtom);
  set(pendingActionAtom, null);
});

// Initiate delete
export const initiateDeleteAtom = atom(null, async (get, set) => {
  const selectedId = get(selectedEventIdAtom);
  if (!selectedId) return;
  
  const event = get(eventsAtom)[selectedId];
  if (!event) return;
  
  const { isOrganizer } = await import("../domain/gcalEvent.ts");
  
  // Check if user is the organizer - non-organizers can only leave (decline)
  if (!isOrganizer(event)) {
    set(pushOverlayAtom, { kind: "confirm", payload: { type: "leaveEvent", eventId: selectedId } });
    return;
  }
  
  const isRecurring = (event.recurrence && event.recurrence.length > 0) || !!event.recurringEventId;
  const hasOtherAttendees = event.attendees?.some(a => !a.self && !a.organizer) ?? false;
  
  set(pendingActionAtom, { eventId: selectedId, type: "delete" });
  
  if (isRecurring) {
    // Show scope selector first
    set(pushOverlayAtom, { kind: "confirm", payload: { type: "deleteScope" } });
  } else if (hasOtherAttendees) {
    // Show notify prompt
    set(pushOverlayAtom, { kind: "confirm", payload: { type: "notifyAttendees" } });
  } else {
    // Direct delete confirmation
    set(pushOverlayAtom, { kind: "confirm", payload: { type: "deleteConfirm" } });
  }
});

// Continue delete after scope selection
export const continueDeleteWithScopeAtom = atom(
  null,
  (get, set, scope: RecurrenceScope) => {
    const pending = get(pendingActionAtom);
    if (!pending) return;
    
    const event = get(eventsAtom)[pending.eventId];
    if (!event) return;
    
    set(pendingActionAtom, { ...pending, scope });
    set(popOverlayAtom); // Close scope selector
    
    const hasOtherAttendees = event.attendees?.some(a => !a.self && !a.organizer) ?? false;
    
    if (hasOtherAttendees) {
      set(pushOverlayAtom, { kind: "confirm", payload: { type: "notifyAttendees" } });
    } else {
      set(pushOverlayAtom, { kind: "confirm", payload: { type: "deleteConfirm" } });
    }
  }
);

// Continue delete after notify selection
export const continueDeleteWithNotifyAtom = atom(
  null,
  (get, set, notify: boolean) => {
    const pending = get(pendingActionAtom);
    if (!pending) return;
    
    set(pendingActionAtom, { ...pending, notifyAttendees: notify });
    set(popOverlayAtom); // Close notify prompt
    set(pushOverlayAtom, { kind: "confirm", payload: { type: "deleteConfirm" } });
  }
);

// Confirm delete
export const confirmDeleteAtom = atom(null, async (get, set) => {
  const pending = get(pendingActionAtom);
  if (!pending) {
    set(popOverlayAtom);
    return;
  }
  
  const event = get(eventsAtom)[pending.eventId];
  if (!event) {
    set(pendingActionAtom, null);
    set(popOverlayAtom);
    return;
  }
  
  // Close overlay and clear state first
  set(popOverlayAtom);
  set(selectedEventIdAtom, null);
  
  const { isLoggedInAtom } = await import("./atoms.ts");
  const isLoggedIn = get(isLoggedInAtom);
  
  // Try to delete on Google Calendar first if logged in
  if (isLoggedIn && event.accountEmail) {
    try {
      set(showMessageAtom, { text: "Deleting event...", type: "progress" });
      
      const { deleteEvent } = await import("../api/calendar.ts");
      await deleteEvent(
        pending.eventId,
        event.calendarId || "primary",
        pending.notifyAttendees ?? false,
        event.accountEmail,
        pending.scope,
        event.recurringEventId
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set(showMessageAtom, { text: `Delete failed: ${message}`, type: "error" });
      set(pendingActionAtom, null);
      return; // Don't delete locally if API failed
    }
  }
  
  // Delete locally - do state update first, then persist
  const eventId = pending.eventId;
  const recurringId = event.recurringEventId;
  const deleteAll = pending.scope === "all" && recurringId;
  
  // Update state immediately
  if (deleteAll) {
    set(eventsAtom, (prev) => {
      const next = { ...prev };
      for (const id of Object.keys(next)) {
        if (next[id]?.recurringEventId === recurringId) {
          delete next[id];
        }
      }
      return next;
    });
  } else {
    set(eventsAtom, (prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  }
  
  // Then persist to database
  try {
    if (deleteAll) {
      const allEvents = await eventsRepo.getAll();
      const toDelete = allEvents
        .filter(e => e.recurringEventId === recurringId)
        .map(e => e.id);
      
      for (const id of toDelete) {
        await eventsRepo.delete(id);
      }
    } else {
      await eventsRepo.delete(eventId);
    }
  } catch (error) {
    // Log error but state is already updated
    console.error("Database delete failed:", error);
  }
  
  set(pendingActionAtom, null);
  set(showMessageAtom, { text: "Event deleted", type: "success" });
});

// Cancel delete
export const cancelDeleteAtom = atom(null, (get, set) => {
  set(pendingActionAtom, null);
  set(popOverlayAtom);
});

// Update attendance status
export const updateAttendanceAtom = atom(
  null,
  async (get, set, { eventId, status }: { eventId: string; status: ResponseStatus }) => {
    const event = get(eventsAtom)[eventId];
    if (!event) return;
    
    const { isLoggedInAtom } = await import("./atoms.ts");
    const isLoggedIn = get(isLoggedInAtom);
    
    // Try to update on Google Calendar first if logged in
    if (isLoggedIn && event.accountEmail) {
      try {
        const { updateAttendance } = await import("../api/calendar.ts");
        await updateAttendance(
          eventId,
          status as "accepted" | "declined" | "tentative",
          event.calendarId || "primary",
          event.accountEmail
        );
        const statusLabel = status === "accepted" ? "Accepted" : status === "declined" ? "Declined" : "Maybe";
        set(showMessageAtom, { text: statusLabel, type: "success" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        set(showMessageAtom, { text: `RSVP failed: ${message}`, type: "error" });
        // Continue with local update anyway
      }
    }
    
    // Find or create self attendee
    let attendees = event.attendees ? [...event.attendees] : [];
    const selfIndex = attendees.findIndex((a) => a.self);
    
    if (selfIndex >= 0) {
      // Update existing self attendee
      attendees[selfIndex] = {
        ...attendees[selfIndex],
        responseStatus: status,
      };
    } else {
      // Add self as attendee (using a placeholder email for v0)
      attendees.push({
        email: "me@example.com",
        displayName: "Me",
        self: true,
        responseStatus: status,
      });
    }
    
    const updatedEvent: GCalEvent = {
      ...event,
      attendees,
      updatedAt: new Date().toISOString(),
    };
    
    await eventsRepo.update(updatedEvent);
    set(eventsAtom, (prev) => ({ ...prev, [eventId]: updatedEvent }));
  }
);

// ===== Message Actions (Vim-style messages) =====

let messageIdCounter = 0;

/**
 * Show a message in the command bar area
 * Returns the message ID for updates
 */
export const showMessageAtom = atom(
  null,
  (get, set, options: { text: string; type?: MessageType; autoDismiss?: number }) => {
    const id = `msg-${++messageIdCounter}`;
    const message: Message = {
      id,
      text: options.text,
      type: options.type || "info",
    };
    
    set(messageAtom, message);
    set(messageVisibleAtom, true);
    
    // Auto-dismiss after timeout (default: don't auto-dismiss)
    if (options.autoDismiss && options.autoDismiss > 0) {
      setTimeout(() => {
        const current = get(messageAtom);
        if (current?.id === id) {
          set(messageAtom, null);
        }
      }, options.autoDismiss);
    }
    
    return id;
  }
);

/**
 * Update an existing message (for progress updates)
 */
export const updateMessageAtom = atom(
  null,
  (get, set, options: { 
    text?: string; 
    type?: MessageType;
    progress?: Message["progress"];
  }) => {
    const current = get(messageAtom);
    if (!current) return;
    
    set(messageAtom, {
      ...current,
      text: options.text ?? current.text,
      type: options.type ?? current.type,
      progress: options.progress !== undefined ? options.progress : current.progress,
    });
  }
);

/**
 * Dismiss the current message
 */
export const dismissMessageAtom = atom(null, (get, set) => {
  set(messageAtom, null);
});

/**
 * Hide message visibility (when command bar opens)
 */
export const hideMessageAtom = atom(null, (get, set) => {
  set(messageVisibleAtom, false);
});

// ===== Command Actions =====

// Open command bar
export const openCommandAtom = atom(null, (get, set) => {
  set(commandInputAtom, ""); // Reset input
  set(commandSelectedIndexAtom, 0); // Reset selection
  set(messageVisibleAtom, false); // Hide any message when command bar opens
  set(pushOverlayAtom, { kind: "command" });
});

// Execute command from registry
export const executeCommandAtom = atom(null, (get, set) => {
  const input = get(commandInputAtom).trim();
  set(popOverlayAtom); // Close command bar first
  
  if (!input) return;
  
  // Import findCommand dynamically to avoid circular deps
  const { findCommand } = require("../keybinds/registry.ts");
  const cmd = findCommand(input);
  
  if (!cmd) return;
  
  // Execute action based on command
  switch (cmd.action) {
    case "newEvent":
      set(openNewDialogAtom, cmd.args || undefined);
      break;
    case "openHelp":
      set(pushOverlayAtom, { kind: "help" });
      break;
    case "openNotifications":
      set(pushOverlayAtom, { kind: "notifications" });
      break;
    case "editEvent":
      set(openEditDialogAtom);
      break;
    case "proposeNewTime":
      set(proposeNewTimeAtom);
      break;
    case "deleteEvent":
      set(initiateDeleteAtom);
      break;
    case "jumpToNow":
      set(jumpToNowAtom);
      break;
    case "quit":
      process.exit(0);
      break;
    case "login":
      set(loginAtom);
      break;
    case "logout":
      set(logoutAtom);
      break;
    case "sync":
      set(syncAtom);
      break;
    case "accounts":
      set(showAccountsAtom);
      break;
    case "toggleAllDay":
      set(toggleAllDayExpandedAtom);
      break;
    case "toggleCalendars":
      set(toggleCalendarSidebarAtom);
      break;
    case "openGoto":
      set(openGotoDialogAtom);
      break;
    case "gotoDate":
      if (cmd.args) {
        set(gotoDateAtom, cmd.args);
      } else {
        // No args, open the dialog instead
        set(openGotoDialogAtom);
      }
      break;
    case "openMeetWith":
      set(openMeetWithDialogAtom);
      break;
    case "upgrade":
      set(upgradePermissionsAtom);
      break;
    default:
      // Unknown action
      break;
  }
});

// Open help dialog
export const openHelpAtom = atom(null, (get, set) => {
  set(pushOverlayAtom, { kind: "help" });
});

// Open notifications panel
export const openNotificationsAtom = atom(null, (get, set) => {
  set(pushOverlayAtom, { kind: "notifications" });
});

// Open goto date dialog (for Ctrl+G global keybind)
export const openGotoDialogAtom = atom(null, (get, set) => {
  set(pushOverlayAtom, { kind: "goto" });
});

// Open meet with dialog (for Ctrl+M global keybind)
export const openMeetWithDialogAtom = atom(null, (get, set) => {
  set(pushOverlayAtom, { kind: "meetWith" });
});

// Go to a specific date directly (for :goto <date> command)
export const gotoDateAtom = atom(null, async (get, set, dateString: string) => {
  const { parseNaturalDate } = await import("../domain/naturalDate.ts");
  const { DateTime } = await import("luxon");
  
  const parsed = parseNaturalDate(dateString);
  
  if (parsed && parsed.date.isValid) {
    const targetDay = parsed.date.startOf("day");
    set(selectedDayAtom, targetDay);
    set(viewAnchorDayAtom, targetDay);
    set(focusAtom, "timeline");
    set(showMessageAtom, `Jumped to ${targetDay.toFormat("EEEE, MMMM d, yyyy")}`);
  } else {
    // Try direct ISO date
    const iso = DateTime.fromISO(dateString);
    if (iso.isValid) {
      const targetDay = iso.startOf("day");
      set(selectedDayAtom, targetDay);
      set(viewAnchorDayAtom, targetDay);
      set(focusAtom, "timeline");
      set(showMessageAtom, `Jumped to ${targetDay.toFormat("EEEE, MMMM d, yyyy")}`);
    } else {
      set(showMessageAtom, `Could not parse date: ${dateString}`);
    }
  }
});

// Create new event (for Ctrl+N global keybind)
export const newEventAtom = atom(null, (get, set) => {
  set(openNewDialogAtom);
});

// ===== Data Loading =====

// Load events from database
export const loadEventsAtom = atom(null, async (get, set) => {
  const events = await eventsRepo.getAll();
  const eventsMap: Record<string, GCalEvent> = {};
  for (const event of events) {
    eventsMap[event.id] = event;
  }
  set(eventsAtom, eventsMap);
});

// ===== Auth Actions =====

// Login to Google Calendar (adds a new account)
export const loginAtom = atom(null, async (get, set) => {
  const { startLoginFlow, getAccounts } = await import("../auth/index.ts");
  const { isLoggedInAtom, isAuthLoadingAtom, accountsAtom } = await import("./atoms.ts");
  const { startBackgroundSync, isBackgroundSyncRunning } = await import("../sync/backgroundSync.ts");
  
  set(isAuthLoadingAtom, true);
  set(showMessageAtom, { text: "Opening browser for authentication...", type: "progress" });
  
  const result = await startLoginFlow({
    onAuthUrl: () => {
      set(updateMessageAtom, { text: "Waiting for Google sign-in...", type: "progress" });
    },
    onSuccess: (account) => {
      set(showMessageAtom, { text: `Logged in as ${account.email}`, type: "success" });
    },
    onError: (error) => {
      set(showMessageAtom, { text: `Login failed: ${error}`, type: "error" });
    },
  });
  
  set(isAuthLoadingAtom, false);
  
  if (result.success && result.account) {
    // Refresh accounts list
    const accounts = await getAccounts();
    set(accountsAtom, accounts.map((a) => ({
      email: a.account.email,
      name: a.account.name,
      picture: a.account.picture,
    })));
    set(isLoggedInAtom, accounts.length > 0);
    
    // Fetch calendars for all accounts
    try {
      const { getAllCalendars } = await import("../api/calendar.ts");
      appLogger.debug("loginAtom: Fetching calendars...");
      const calendars = await getAllCalendars();
      appLogger.info(`loginAtom: Fetched ${calendars.length} calendars`);
      set(calendarsAtom, calendars.map((cal) => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary,
        accountEmail: cal.accountEmail || "",
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor,
      })));
    } catch (error) {
      appLogger.error("loginAtom: Failed to fetch calendars", { error });
    }
    
    // Auto-sync after login (full sync)
    await set(syncAtom, { force: true });
    
    // Start background sync if not already running
    if (!isBackgroundSyncRunning()) {
      startBackgroundSync(async () => {
        await set(backgroundSyncAtom);
      });
    }
  }
});

// Upgrade permissions (grant new OAuth scopes without re-login)
export const upgradePermissionsAtom = atom(null, async (get, set) => {
  const { upgradePermissions, getAccounts, getDefaultAccount } = await import("../auth/index.ts");
  const { accountsAtom } = await import("./atoms.ts");
  
  const accounts = await getAccounts();
  if (accounts.length === 0) {
    set(showMessageAtom, { text: "No accounts. Run 'login' first.", type: "warning" });
    return;
  }
  
  // Get default account or first account
  const defaultAccount = await getDefaultAccount();
  const accountToUpgrade = defaultAccount?.account.email || accounts[0].account.email;
  
  set(showMessageAtom, { text: "Opening browser to upgrade permissions...", type: "progress" });
  
  const result = await upgradePermissions(accountToUpgrade, {
    onAuthUrl: () => {
      set(updateMessageAtom, { text: "Waiting for permission grant...", type: "progress" });
    },
    onSuccess: (account) => {
      set(showMessageAtom, { text: `Permissions upgraded for ${account.email}`, type: "success" });
    },
    onError: (error) => {
      set(showMessageAtom, { text: `Upgrade failed: ${error}`, type: "error" });
    },
  });
  
  if (result.success) {
    // Refresh accounts list
    const updatedAccounts = await getAccounts();
    set(accountsAtom, updatedAccounts.map((a) => ({
      email: a.account.email,
      name: a.account.name,
      picture: a.account.picture,
    })));
    
    // Do a fresh sync to take advantage of new permissions
    await set(syncAtom, { force: true });
  }
});

// Logout from Google Calendar
// If email is provided, logs out that specific account
// Otherwise logs out all accounts
export const logoutAtom = atom(null, async (get, set, email?: string) => {
  const { logoutAccount, logoutAll, getAccounts, isLoggedIn } = await import("../auth/index.ts");
  const { isLoggedInAtom, accountsAtom } = await import("./atoms.ts");
  const { stopBackgroundSync } = await import("../sync/backgroundSync.ts");
  const { clearAllSyncTokens } = await import("../sync/syncTokens.ts");
  
  if (!(await isLoggedIn())) {
    set(showMessageAtom, { text: "Not logged in", type: "warning" });
    return;
  }
  
  if (email) {
    // Logout specific account
    await logoutAccount(email);
    
    // Remove events from this account from local database
    const currentEvents = get(eventsAtom);
    const remainingEvents: Record<string, GCalEvent> = {};
    for (const [id, event] of Object.entries(currentEvents)) {
      if (event.accountEmail !== email) {
        remainingEvents[id] = event;
      }
    }
    set(eventsAtom, remainingEvents);
    
    // Also remove from database
    await eventsRepo.deleteByAccount(email);
    
    set(showMessageAtom, { text: `Logged out: ${email}`, type: "info" });
  } else {
    // Logout all accounts
    await logoutAll();
    // Clear all events from local database
    await eventsRepo.clear();
    set(eventsAtom, {});
    // Clear sync tokens since all accounts are gone
    await clearAllSyncTokens();
    // Stop background sync
    stopBackgroundSync();
    set(showMessageAtom, { text: "Logged out", type: "info" });
  }
  
  // Refresh accounts list
  const accounts = await getAccounts();
  set(accountsAtom, accounts.map((a) => ({
    email: a.account.email,
    name: a.account.name,
    picture: a.account.picture,
  })));
  set(isLoggedInAtom, accounts.length > 0);
  
  // If no accounts left, stop background sync
  if (accounts.length === 0) {
    stopBackgroundSync();
  }
});

// Sync events with Google Calendar (from all accounts)
// Supports both full sync and incremental sync
export const syncAtom = atom(null, async (get, set, options?: { force?: boolean; silent?: boolean }) => {
  const { isLoggedIn, getAccounts } = await import("../auth/index.ts");
  const { isAuthLoadingAtom, accountsAtom, isSyncingAtom } = await import("./atoms.ts");
  const { getSyncToken, setSyncToken, clearAllSyncTokens } = await import("../sync/syncTokens.ts");
  const { incrementalSyncAll, fetchAllEvents } = await import("../api/calendar.ts");
  const { appLogger } = await import("../lib/logger.ts");
  
  // Prevent concurrent syncs
  const isSyncing = get(isSyncingAtom);
  if (isSyncing) {
    appLogger.debug("Sync already in progress, skipping");
    return;
  }
  
  if (!(await isLoggedIn())) {
    if (!options?.silent) {
      set(showMessageAtom, { text: "Not logged in. Run 'login' first.", type: "warning" });
    }
    return;
  }
  
  set(isSyncingAtom, true);
  
  // Only show loading UI for manual syncs (not background)
  const isBackgroundSync = options?.silent;
  if (!isBackgroundSync) {
    set(isAuthLoadingAtom, true);
  }
  
  try {
    // Update accounts list
    const accounts = await getAccounts();
    set(accountsAtom, accounts.map((a) => ({
      email: a.account.email,
      name: a.account.name,
      picture: a.account.picture,
    })));
    
    // Fetch and store calendars for all accounts
    try {
      const { getAllCalendars } = await import("../api/calendar.ts");
      const calendars = await getAllCalendars();
      appLogger.debug(`syncAtom: Fetched ${calendars.length} calendars`);
      set(calendarsAtom, calendars.map((cal) => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary,
        accountEmail: cal.accountEmail || "",
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor,
      })));
    } catch (error) {
      appLogger.error("syncAtom: Failed to fetch calendars", { error });
    }
    
    // Force full sync if requested
    if (options?.force) {
      await clearAllSyncTokens();
    }
    
    // Try incremental sync first
    if (!options?.force) {
      appLogger.debug("Attempting incremental sync...");
      const incrementalResult = await incrementalSyncAll(getSyncToken);
      appLogger.debug("Incremental sync result", {
        changed: incrementalResult.changed.length,
        deleted: incrementalResult.deleted.length,
        calendarsRequiringFullSync: incrementalResult.calendarsRequiringFullSync.length,
      });
      
      // Check if any calendar needs full sync
      if (incrementalResult.calendarsRequiringFullSync.length === 0) {
        // Pure incremental sync - apply changes
        if (incrementalResult.changed.length > 0 || incrementalResult.deleted.length > 0) {
          appLogger.info(`Incremental sync: ${incrementalResult.changed.length} changed, ${incrementalResult.deleted.length} deleted`);
          
          // Apply changes to local database
          for (const event of incrementalResult.changed) {
            const eventWithMeta: GCalEvent = {
              ...event,
              createdAt: event.created || new Date().toISOString(),
              updatedAt: event.updated || new Date().toISOString(),
            };
            // Upsert - try update first, create if not exists
            try {
              await eventsRepo.update(eventWithMeta);
            } catch {
              await eventsRepo.create(eventWithMeta);
            }
          }
          
          // Delete removed events
          for (const deletedId of incrementalResult.deleted) {
            try {
              await eventsRepo.delete(deletedId);
            } catch {
              // Event might not exist locally, that's fine
            }
          }
          
          // Save new sync tokens
          for (const [key, token] of incrementalResult.syncTokens) {
            const [accountEmail, calendarId] = key.split(":");
            await setSyncToken(accountEmail, calendarId, token);
          }
          
          // Reload events into state
          const allEvents = await eventsRepo.getAll();
          const eventsMap: Record<string, GCalEvent> = {};
          for (const event of allEvents) {
            eventsMap[event.id] = event;
          }
          set(eventsAtom, eventsMap);
          
          if (!isBackgroundSync) {
            set(showMessageAtom, { 
              text: `Synced: ${incrementalResult.changed.length} updated, ${incrementalResult.deleted.length} removed`, 
              type: "success",
              autoDismiss: 3000,
            });
          }
        } else {
          appLogger.debug("Incremental sync: no changes");
          // Still update sync tokens
          for (const [key, token] of incrementalResult.syncTokens) {
            const [accountEmail, calendarId] = key.split(":");
            await setSyncToken(accountEmail, calendarId, token);
          }
        }
        
        set(isSyncingAtom, false);
        if (!isBackgroundSync) {
          set(isAuthLoadingAtom, false);
        }
        return;
      }
      
      // Some calendars need full sync
      appLogger.info(`Full sync required for ${incrementalResult.calendarsRequiringFullSync.length} calendars`);
    }
    
    // Full sync
    appLogger.info("Starting full sync...");
    if (!isBackgroundSync) {
      set(showMessageAtom, { 
        text: "Full sync...", 
        type: "progress",
        progress: { phase: "connecting" }
      });
    }
    
    // Fetch events for a 2-month window (1 month back, 1 month forward)
    const now = DateTime.now();
    const timeMin = now.minus({ months: 1 }).startOf("day").toISO();
    const timeMax = now.plus({ months: 1 }).endOf("day").toISO();
    
    if (!timeMin || !timeMax) {
      throw new Error("Failed to calculate date range");
    }
    
    if (!isBackgroundSync) {
      set(updateMessageAtom, { 
        text: "Fetching events...", 
        progress: { phase: "fetching" }
      });
    }
    
    const { events: fetchedEvents, syncTokens } = await fetchAllEvents({
      timeMin,
      timeMax,
    });
    
    if (!isBackgroundSync) {
      set(updateMessageAtom, { 
        text: "Saving events...", 
        progress: { current: 0, total: fetchedEvents.length }
      });
    }
    
    // Clear existing events and replace with fetched ones
    await eventsRepo.clear();
    
    // Deduplicate events by ID before saving
    const eventById = new Map<string, GCalEvent>();
    for (const event of fetchedEvents) {
      if (!eventById.has(event.id)) {
        eventById.set(event.id, event);
      }
    }
    
    const uniqueEvents = Array.from(eventById.values());
    let saved = 0;
    
    for (const event of uniqueEvents) {
      const eventWithMeta: GCalEvent = {
        ...event,
        createdAt: event.created || new Date().toISOString(),
        updatedAt: event.updated || new Date().toISOString(),
      };
      await eventsRepo.create(eventWithMeta);
      saved++;
      
      if (!isBackgroundSync && saved % 10 === 0) {
        set(updateMessageAtom, { 
          progress: { current: saved, total: uniqueEvents.length }
        });
      }
    }
    
    // Save sync tokens for incremental sync
    for (const [key, token] of syncTokens) {
      const [accountEmail, calendarId] = key.split(":");
      await setSyncToken(accountEmail, calendarId, token);
    }
    
    // Update the events atom
    const eventsMap: Record<string, GCalEvent> = {};
    for (const event of uniqueEvents) {
      eventsMap[event.id] = {
        ...event,
        createdAt: event.created || new Date().toISOString(),
        updatedAt: event.updated || new Date().toISOString(),
      };
    }
    set(eventsAtom, eventsMap);
    
    if (!isBackgroundSync) {
      set(showMessageAtom, { 
        text: `Synced ${uniqueEvents.length} events`, 
        type: "success" 
      });
    } else {
      appLogger.info(`Full sync complete: ${uniqueEvents.length} events`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (!isBackgroundSync) {
      set(showMessageAtom, { text: `Sync failed: ${message}`, type: "error" });
    } else {
      appLogger.error("Background sync failed", { error: message });
    }
  }
  
  set(isSyncingAtom, false);
  if (!isBackgroundSync) {
    set(isAuthLoadingAtom, false);
  }
});

// Background sync action (silent, incremental)
export const backgroundSyncAtom = atom(null, async (get, set) => {
  await set(syncAtom, { silent: true });
});

// Fetch calendars for all accounts
export const fetchCalendarsAtom = atom(null, async (get, set) => {
  const { getAllCalendars } = await import("../api/calendar.ts");
  
  try {
    appLogger.debug("fetchCalendarsAtom: Fetching calendars...");
    const calendars = await getAllCalendars();
    appLogger.info(`fetchCalendarsAtom: Fetched ${calendars.length} calendars`, { 
      calendars: calendars.map(c => ({ id: c.id, summary: c.summary, account: c.accountEmail }))
    });
    set(calendarsAtom, calendars.map((cal) => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary,
      accountEmail: cal.accountEmail || "",
      backgroundColor: cal.backgroundColor,
      foregroundColor: cal.foregroundColor,
    })));
  } catch (error) {
    appLogger.error("fetchCalendarsAtom: Failed to fetch calendars", { error });
  }
});

// Check auth status on startup and load accounts
export const checkAuthStatusAtom = atom(null, async (get, set) => {
  appLogger.info("checkAuthStatusAtom: Starting...");
  const { isLoggedIn, getAccounts } = await import("../auth/index.ts");
  const { isLoggedInAtom, accountsAtom } = await import("./atoms.ts");
  const { startBackgroundSync, isBackgroundSyncRunning } = await import("../sync/backgroundSync.ts");
  
  const loggedIn = await isLoggedIn();
  appLogger.debug(`checkAuthStatusAtom: loggedIn=${loggedIn}`);
  set(isLoggedInAtom, loggedIn);
  
  if (loggedIn) {
    const accounts = await getAccounts();
    set(accountsAtom, accounts.map((a) => ({
      email: a.account.email,
      name: a.account.name,
      picture: a.account.picture,
    })));
    
    // Fetch calendars for all accounts
    try {
      const { getAllCalendars } = await import("../api/calendar.ts");
      appLogger.debug("checkAuthStatusAtom: Fetching calendars...");
      const calendars = await getAllCalendars();
      appLogger.info(`checkAuthStatusAtom: Fetched ${calendars.length} calendars`);
      set(calendarsAtom, calendars.map((cal) => ({
        id: cal.id,
        summary: cal.summary,
        primary: cal.primary,
        accountEmail: cal.accountEmail || "",
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor,
      })));
    } catch (error) {
      appLogger.error("checkAuthStatusAtom: Failed to fetch calendars", { error });
    }
    
    // Start background sync if logged in
    if (!isBackgroundSyncRunning()) {
      startBackgroundSync(async () => {
        await set(backgroundSyncAtom);
      });
    }
    
    // Do an initial sync on startup
    set(syncAtom, { silent: true });
  }
});

// Open accounts management dialog
export const showAccountsAtom = atom(null, async (get, set) => {
  set(pushOverlayAtom, { kind: "accounts" });
});
