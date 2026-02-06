import { atom, type Getter, type Setter, type WritableAtom } from "jotai";
import { DateTime } from "luxon";
import type { GCalEvent } from "../domain/gcalEvent.ts";
import { findNearestEvent } from "../domain/layout.ts";
import { getNowMinutes, getLocalTimezone } from "../domain/time.ts";
import { eventsRepo } from "../db/eventsRepo.ts";
import {
  eventsAtom,
  selectedDayAtom,
  focusAtom,
  selectedEventIdAtom,
  timelineScrollAtom,
  overlayStackAtom,
  commandInputAtom,
  dialogEventAtom,
  isEditModeAtom,
  pendingActionAtom,
  dayLayoutAtom,
  dayEventsAtom,
  type FocusContext,
  type Overlay,
  type OverlayKind,
  type RecurrenceScope,
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
    // Set focus based on overlay kind
    set(focusAtom, overlay.kind as FocusContext);
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
export const moveDaySelectionAtom = atom(
  null,
  (get, set, direction: "up" | "down" | "start" | "end") => {
    const selectedDay = get(selectedDayAtom);
    
    switch (direction) {
      case "up":
        set(selectedDayAtom, selectedDay.minus({ days: 1 }));
        break;
      case "down":
        set(selectedDayAtom, selectedDay.plus({ days: 1 }));
        break;
      case "start":
        set(selectedDayAtom, selectedDay.minus({ days: 7 }));
        break;
      case "end":
        set(selectedDayAtom, selectedDay.plus({ days: 7 }));
        break;
    }
  }
);

// Select day and focus timeline
export const selectDayAtom = atom(null, (get, set, day: DateTime) => {
  set(selectedDayAtom, day.startOf("day"));
  set(focusAtom, "timeline");
  set(selectedEventIdAtom, null);
  
  // Auto-select first event if any
  const layout = get(dayLayoutAtom);
  const events = [...layout.allDayEvents, ...layout.timedEvents.map(t => t.event)];
  const firstEvent = events[0];
  if (firstEvent) {
    set(selectedEventIdAtom, firstEvent.id);
  }
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
export const openEditDialogAtom = atom(null, (get, set) => {
  const event = get(eventsAtom)[get(selectedEventIdAtom) || ""];
  if (!event) return;
  
  // Check if recurring - if so, show scope selector first
  const isRecurring = (event.recurrence && event.recurrence.length > 0) || !!event.recurringEventId;
  
  if (isRecurring) {
    set(pendingActionAtom, { eventId: event.id });
    set(pushOverlayAtom, { kind: "confirm", payload: { type: "editScope" } });
  } else {
    set(dialogEventAtom, { ...event });
    set(isEditModeAtom, true);
    set(pushOverlayAtom, { kind: "dialog" });
  }
});

// Continue edit after scope selection
export const continueEditWithScopeAtom = atom(
  null,
  (get, set, scope: RecurrenceScope) => {
    const pending = get(pendingActionAtom);
    if (!pending) return;
    
    const event = get(eventsAtom)[pending.eventId];
    if (!event) return;
    
    set(pendingActionAtom, { ...pending, scope });
    set(popOverlayAtom); // Close scope selector
    set(dialogEventAtom, { ...event });
    set(isEditModeAtom, true);
    set(pushOverlayAtom, { kind: "dialog" });
  }
);

// Save event (create or update)
export const saveEventAtom = atom(null, async (get, set) => {
  const dialogEvent = get(dialogEventAtom);
  const isEditMode = get(isEditModeAtom);
  
  if (!dialogEvent) return;
  
  const now = new Date().toISOString();
  
  if (isEditMode && dialogEvent.id) {
    // Update existing event
    const event: GCalEvent = {
      ...dialogEvent,
      updatedAt: now,
    } as GCalEvent;
    
    await eventsRepo.update(event);
    set(eventsAtom, (prev) => ({ ...prev, [event.id]: event }));
  } else {
    // Create new event
    const event: GCalEvent = {
      ...dialogEvent,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as GCalEvent;
    
    await eventsRepo.create(event);
    set(eventsAtom, (prev) => ({ ...prev, [event.id]: event }));
    set(selectedEventIdAtom, event.id);
  }
  
  // Close dialog
  set(popOverlayAtom);
  set(pendingActionAtom, null);
});

// Initiate delete
export const initiateDeleteAtom = atom(null, (get, set) => {
  const selectedId = get(selectedEventIdAtom);
  if (!selectedId) return;
  
  const event = get(eventsAtom)[selectedId];
  if (!event) return;
  
  const isRecurring = (event.recurrence && event.recurrence.length > 0) || !!event.recurringEventId;
  const hasOtherAttendees = event.attendees?.some(a => !a.self && !a.organizer) ?? false;
  
  set(pendingActionAtom, { eventId: selectedId });
  
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
  if (!pending) return;
  
  // For v0, we just delete the event regardless of scope
  // In real implementation, scope would affect which instances to delete
  await eventsRepo.delete(pending.eventId);
  
  set(eventsAtom, (prev) => {
    const next = { ...prev };
    delete next[pending.eventId];
    return next;
  });
  
  set(selectedEventIdAtom, null);
  set(pendingActionAtom, null);
  set(popOverlayAtom);
});

// Cancel delete
export const cancelDeleteAtom = atom(null, (get, set) => {
  set(pendingActionAtom, null);
  set(popOverlayAtom);
});

// ===== Command Actions =====

// Open command bar
export const openCommandAtom = atom(null, (get, set) => {
  set(pushOverlayAtom, { kind: "command" });
});

// Execute command
export const executeCommandAtom = atom(null, (get, set) => {
  const input = get(commandInputAtom).trim();
  
  if (input.startsWith("/new")) {
    const title = input.slice(4).trim();
    set(popOverlayAtom); // Close command bar first
    set(openNewDialogAtom, title || undefined);
  } else {
    // Unknown command - just close
    set(popOverlayAtom);
  }
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
