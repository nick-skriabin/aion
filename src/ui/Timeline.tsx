import React, { useMemo, useEffect, useRef } from "react";
import { Box, Text, FocusScope, useInput, useApp } from "@nick-skriabin/glyph";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  dayLayoutAtom,
  selectedDayAtom,
  focusAtom,
  selectedEventIdAtom,
  dayEventsAtom,
  accountColorMapAtom,
} from "../state/atoms.ts";
import {
  toggleFocusAtom,
  openDetailsAtom,
  openEditDialogAtom,
  initiateDeleteAtom,
  openCommandAtom,
  jumpToNowAtom,
  moveEventSelectionAtom,
  openNotificationsAtom,
  newEventAtom,
} from "../state/actions.ts";
import { formatDayHeader, isToday, getNowMinutes, formatTime, getEventStart } from "../domain/time.ts";
import { getDisplayTitle, type ResponseStatus } from "../domain/gcalEvent.ts";
import { findNearestEvent } from "../domain/layout.ts";
import { handleKeyEvent } from "../keybinds/useKeybinds.tsx";
import { theme } from "./theme.ts";
import type { GCalEvent } from "../domain/gcalEvent.ts";
import type { TimedEventLayout } from "../domain/layout.ts";

// Get the user's response status for an event
function getSelfResponseStatus(event: GCalEvent): ResponseStatus | undefined {
  const selfAttendee = event.attendees?.find((a) => a.self);
  return selfAttendee?.responseStatus;
}

// Get attendance indicator character
function getAttendanceIndicator(status: ResponseStatus | undefined, hasAttendees: boolean): string {
  switch (status) {
    case "accepted":
      return "✓ ";
    case "declined":
      return "✗ ";
    case "tentative":
      return "? ";
    case "needsAction":
      return "! "; // New invite needing attention - exclamation mark is more urgent
    default:
      // Show indicator only if event has attendees (it's a meeting invite)
      return hasAttendees ? "! " : "";
  }
}

// Get attendance color
function getAttendanceColor(status: ResponseStatus | undefined, hasAttendees: boolean): string | undefined {
  switch (status) {
    case "accepted":
      return theme.status.accepted;
    case "declined":
      return theme.status.declined;
    case "tentative":
      return theme.status.tentative;
    case "needsAction":
      return theme.accent.warning; // Yellow/orange for urgency
    default:
      // Highlight if it's a meeting without response
      return hasAttendees ? theme.accent.warning : undefined;
  }
}

const HOUR_LABEL_WIDTH = 7;
const SLOTS_PER_HOUR = 4;
const MINUTES_PER_SLOT = 15;
const COLUMN_WIDTH = 28;

/**
 * Get color for an event based on its account
 * Falls back to event type color if no account
 */
function getEventColor(event: GCalEvent, accountColorMap: Record<string, number>): string {
  // If event has an account, use the account color
  if (event.accountEmail && accountColorMap[event.accountEmail]) {
    const colorIndex = accountColorMap[event.accountEmail];
    const colorKey = String(colorIndex) as keyof typeof theme.calendarColors;
    const color = theme.calendarColors?.[colorKey];
    if (color) return color;
  }

// Fallback to event type color
  switch (event.eventType) {
    case "outOfOffice":
      return theme.eventType.outOfOffice;
    case "focusTime":
      return theme.eventType.focusTime;
    case "birthday":
      return theme.eventType.birthday;
    default:
      return theme.eventType.default;
  }
}

function formatHourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

// Keyboard handler
function TimelineKeybinds() {
  const toggleFocus = useSetAtom(toggleFocusAtom);
  const openDetails = useSetAtom(openDetailsAtom);
  const openEditDialog = useSetAtom(openEditDialogAtom);
  const initiateDelete = useSetAtom(initiateDeleteAtom);
  const openCommand = useSetAtom(openCommandAtom);
  const jumpToNow = useSetAtom(jumpToNowAtom);
  const moveEventSelection = useSetAtom(moveEventSelectionAtom);
  const openNotifications = useSetAtom(openNotificationsAtom);
  const newEvent = useSetAtom(newEventAtom);
  
  const lastKeyRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  
  const handlers = useMemo(() => ({
    nextEvent: () => moveEventSelection("next"),
    prevEvent: () => moveEventSelection("prev"),
    firstEvent: () => moveEventSelection("first"),
    lastEvent: () => moveEventSelection("last"),
    jumpToNow: () => jumpToNow(),
    openDetails: () => openDetails(),
    editEvent: () => openEditDialog(),
    deleteEvent: () => initiateDelete(),
    openCommand: () => openCommand(),
    toggleFocus: () => toggleFocus(),
  }), [moveEventSelection, jumpToNow, openDetails, openEditDialog, initiateDelete, openCommand, toggleFocus]);
  
  // Global keybind handlers (need to be handled here due to FocusScope trap)
  const globalHandlers = useMemo(() => ({
    openNotifications: () => openNotifications(),
    newEvent: () => newEvent(),
  }), [openNotifications, newEvent]);
  
  useInput((key) => {
    // Handle global keybinds first (FocusScope trap would otherwise block them)
    if (handleKeyEvent("global", key, globalHandlers)) return;
    
    // Handle double-tap 'g' for first event (gg)
    if (key.name === "g" && !key.shift) {
      const now = Date.now();
      if (lastKeyRef.current === "g" && now - lastKeyTimeRef.current < 500) {
        handlers.firstEvent();
        lastKeyRef.current = "";
        return;
      }
      lastKeyRef.current = "g";
      lastKeyTimeRef.current = now;
      return;
    }
    
    // Reset last key if not 'g'
    if (key.name !== "g") {
      lastKeyRef.current = "";
    }
    
    // Handle scoped keys through registry
    handleKeyEvent("timeline", key, handlers);
  });
  
  return null;
}

function minutesToSlot(minutes: number): number {
  return Math.floor(minutes / MINUTES_PER_SLOT);
}

interface SlotEvent {
  layout: TimedEventLayout;
  isStart: boolean;
}

function getEventsForSlot(slotIndex: number, allEvents: TimedEventLayout[]): {
  byColumn: Map<number, SlotEvent>;
  maxColumns: number;
} {
  const slotStart = slotIndex * MINUTES_PER_SLOT;
  const slotEnd = slotStart + MINUTES_PER_SLOT;
  const byColumn = new Map<number, SlotEvent>();
  let maxColumns = 1;
  
  for (const layout of allEvents) {
    if (layout.startMinutes < slotEnd && layout.endMinutes > slotStart) {
      const startSlot = minutesToSlot(layout.startMinutes);
      const isStart = startSlot === slotIndex;
      byColumn.set(layout.column, { layout, isStart });
      maxColumns = Math.max(maxColumns, layout.totalColumns);
    }
  }
  
  return { byColumn, maxColumns };
}

// Event column with background highlighting for selection
function EventColumn({
  slotEvent,
  isSelected,
  isFocused,
  width,
  accountColorMap,
}: {
  slotEvent: SlotEvent | null;
  isSelected: boolean;
  isFocused: boolean;
  width: number;
    accountColorMap: Record<string, number>;
}) {
  if (!slotEvent) {
    return <Box style={{ width }} />;
  }
  
  const { layout, isStart } = slotEvent;
  const event = layout.event;
  const eventColor = getEventColor(event, accountColorMap);
  const isHighlighted = isSelected && isFocused;
  const responseStatus = getSelfResponseStatus(event);
  const hasAttendees = (event.attendees?.length ?? 0) > 0;
  const attendanceIndicator = getAttendanceIndicator(responseStatus, hasAttendees);
  const attendanceColor = getAttendanceColor(responseStatus, hasAttendees);
  const isDeclined = responseStatus === "declined";
  
  const bgColor = isHighlighted ? theme.selection.background : undefined;
  const textColor = isHighlighted ? theme.selection.text : (isDeclined ? theme.text.dim : eventColor);
  
  if (isStart) {
    const start = getEventStart(event);
    const timeStr = formatTime(start);
    const title = getDisplayTitle(event);
    // Account for attendance indicator in width calculation (indicator is 2 chars with space)
    const indicatorWidth = attendanceIndicator.length;
    const titleWidth = Math.max(1, width - 8 - indicatorWidth);
    const displayTitle = title.length > titleWidth ? title.slice(0, titleWidth - 1) + "…" : title;
    
    return (
      <Box style={{ width, flexDirection: "row", bg: bgColor }}>
        <Text style={{ color: textColor, bold: isHighlighted }}>
          {isHighlighted ? "▸" : "○"}
        </Text>
        <Text style={{ color: isHighlighted ? theme.selection.text : theme.text.dim }}> {timeStr} </Text>
        {attendanceIndicator && (
          <Text style={{ color: isHighlighted ? theme.selection.text : attendanceColor }}>
            {attendanceIndicator}
          </Text>
        )}
        <Text style={{ color: textColor, bold: isHighlighted, dim: isDeclined }}>
          {displayTitle}
        </Text>
      </Box>
    );
  } else {
    return (
      <Box style={{ width, bg: bgColor }}>
        <Text style={{ color: textColor, dim: isDeclined }}>
          │
        </Text>
      </Box>
    );
  }
}

// Single slot row (15 minutes)
function SlotRow({
  slotIndex,
  allEvents,
  selectedEventId,
  isFocused,
  isNowSlot,
  accountColorMap,
}: {
  slotIndex: number;
  allEvents: TimedEventLayout[];
  selectedEventId: string | null;
  isFocused: boolean;
  isNowSlot: boolean;
    accountColorMap: Record<string, number>;
}) {
  const { byColumn, maxColumns } = getEventsForSlot(slotIndex, allEvents);
  const hour = Math.floor(slotIndex / SLOTS_PER_HOUR);
  const slotInHour = slotIndex % SLOTS_PER_HOUR;
  const isHourStart = slotInHour === 0;
  const hasOverlap = maxColumns > 1;
  
  const columns: React.ReactNode[] = [];
  for (let col = 0; col < maxColumns; col++) {
    const slotEvent = byColumn.get(col) || null;
    const isSelected = slotEvent ? selectedEventId === slotEvent.layout.event.id : false;
    
    columns.push(
      <EventColumn
        key={col}
        slotEvent={slotEvent}
        isSelected={isSelected}
        isFocused={isFocused}
        width={COLUMN_WIDTH}
        accountColorMap={accountColorMap}
      />
    );
  }
  
  // Grid line character and color
  let gridChar = isHourStart ? "┼" : "│";
  let gridColor = hasOverlap ? theme.accent.warning : theme.text.dim;
  
  // For now slot, show indicator (use < instead of ◀ for consistent width)
  if (isNowSlot) {
    gridChar = "<";
    gridColor = theme.accent.error;
  }
  
  return (
    <Box style={{ flexDirection: "row" }}>
      {/* Hour label */}
      <Box style={{ width: HOUR_LABEL_WIDTH }}>
        {isHourStart && isNowSlot ? (
          <Text style={{ color: theme.accent.error, bold: true }}>
            {formatHourLabel(hour).padStart(HOUR_LABEL_WIDTH - 1)}
          </Text>
        ) : isHourStart ? (
          <Text style={{ color: theme.text.dim }}>
            {formatHourLabel(hour).padStart(HOUR_LABEL_WIDTH - 1)}
          </Text>
        ) : isNowSlot ? (
          <Text style={{ color: theme.accent.error, bold: true }}>
            {"now".padStart(HOUR_LABEL_WIDTH - 1)}
          </Text>
        ) : null}
      </Box>
      
      {/* Grid line */}
      <Text style={{ color: gridColor }}>
        {gridChar}
      </Text>
      
      {/* Event columns */}
      <Box style={{ flexDirection: "row", paddingLeft: 1 }}>
        {columns}
      </Box>
    </Box>
  );
}

// All-day events bar
function AllDayBar({
  events,
  selectedEventId,
  isFocused,
  accountColorMap,
}: {
  events: GCalEvent[];
  selectedEventId: string | null;
  isFocused: boolean;
    accountColorMap: Record<string, number>;
}) {
  if (events.length === 0) return null;
  
  return (
    <Box style={{ paddingBottom: 1 }}>
      {events.map((event) => {
        const isSelected = selectedEventId === event.id;
        const eventColor = getEventColor(event, accountColorMap);
        const isHighlighted = isSelected && isFocused;
        const responseStatus = getSelfResponseStatus(event);
        const hasAttendees = (event.attendees?.length ?? 0) > 0;
        const attendanceIndicator = getAttendanceIndicator(responseStatus, hasAttendees);
        const attendanceColor = getAttendanceColor(responseStatus, hasAttendees);
        const isDeclined = responseStatus === "declined";
        
        const bgColor = isHighlighted ? theme.selection.background : undefined;
        const textColor = isHighlighted ? theme.selection.text : (isDeclined ? theme.text.dim : eventColor);
        
        return (
          <Box key={event.id} style={{ flexDirection: "row" }}>
            <Box style={{ width: HOUR_LABEL_WIDTH }}>
              <Text style={{ color: theme.text.dim }}>all-day</Text>
            </Box>
            <Text style={{ color: theme.text.dim }}>│</Text>
            <Box style={{ paddingLeft: 1, flexDirection: "row", bg: bgColor }}>
              <Text style={{ color: textColor, bold: isHighlighted }}>
                {isHighlighted ? "▸" : "○"}
              </Text>
              <Text> </Text>
              {attendanceIndicator && (
                <Text style={{ color: isHighlighted ? theme.selection.text : attendanceColor }}>
                  {attendanceIndicator}
                </Text>
              )}
              <Text style={{ color: textColor, bold: isHighlighted, dim: isDeclined }}>
                {getDisplayTitle(event)}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// Sticky header for events that started above visible area
function StickyEventHeaders({
  timedEvents,
  scrollOffset,
  selectedEventId,
  isFocused,
  accountColorMap,
}: {
  timedEvents: TimedEventLayout[];
  scrollOffset: number;
  selectedEventId: string | null;
  isFocused: boolean;
    accountColorMap: Record<string, number>;
}) {
  const visibleStartMinutes = scrollOffset * MINUTES_PER_SLOT;
  
  // Find events that started before visible area but are still ongoing
  const stickyEvents = timedEvents.filter((layout) => {
    const startSlot = minutesToSlot(layout.startMinutes);
    return startSlot < scrollOffset && layout.endMinutes > visibleStartMinutes;
  });
  
  if (stickyEvents.length === 0) return null;
  
  return (
    <Box style={{ flexDirection: "column" }}>
      {stickyEvents.map((layout) => {
        const event = layout.event;
        const isSelected = selectedEventId === event.id;
        const isHighlighted = isSelected && isFocused;
        const eventColor = getEventColor(event, accountColorMap);
        const responseStatus = getSelfResponseStatus(event);
        const hasAttendees = (event.attendees?.length ?? 0) > 0;
        const attendanceIndicator = getAttendanceIndicator(responseStatus, hasAttendees);
        const attendanceColor = getAttendanceColor(responseStatus, hasAttendees);
        const isDeclined = responseStatus === "declined";
        
        const bgColor = isHighlighted ? theme.selection.background : undefined;
        const textColor = isHighlighted ? theme.selection.text : (isDeclined ? theme.text.dim : eventColor);
        
        return (
          <Box key={event.id} style={{ flexDirection: "row" }}>
            <Box style={{ width: HOUR_LABEL_WIDTH }}>
              <Text style={{ color: theme.text.dim, dim: true }}>{"↑".padStart(HOUR_LABEL_WIDTH - 1)}</Text>
            </Box>
            <Text style={{ color: textColor }}>┬</Text>
            <Box style={{ paddingLeft: 1 + layout.column * COLUMN_WIDTH, flexDirection: "row", bg: bgColor }}>
              {attendanceIndicator && (
                <Text style={{ color: isHighlighted ? theme.selection.text : attendanceColor }}>
                  {attendanceIndicator}
                </Text>
              )}
              <Text style={{ color: textColor, bold: isHighlighted, dim: isDeclined }}>
                {getDisplayTitle(event)}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export function Timeline() {
  const { rows: terminalHeight } = useApp();
  const layout = useAtomValue(dayLayoutAtom);
  const selectedDay = useAtomValue(selectedDayAtom);
  const focus = useAtomValue(focusAtom);
  const [selectedEventId, setSelectedEventId] = useAtom(selectedEventIdAtom);
  const events = useAtomValue(dayEventsAtom);
  const accountColorMap = useAtomValue(accountColorMapAtom);
  
  const isFocused = focus === "timeline";
  const isTodayView = isToday(selectedDay);
  const nowMinutes = isTodayView ? getNowMinutes() : -1;
  const nowSlot = nowMinutes >= 0 ? minutesToSlot(nowMinutes) : -1;
  
  // Count lines used by headers
  const allDayLines = layout.allDayEvents.length > 0 ? layout.allDayEvents.length + 1 : 0; // +1 for padding
  const stickyEvents = layout.timedEvents.filter((l) => {
    const startSlot = minutesToSlot(l.startMinutes);
    return startSlot < 0; // Will be recalculated with actual scrollOffset
  });

  // Calculate available height for timeline grid
  // Total height minus: app header (1) + timeline header (1) + all-day events + sticky headers + status bar (1)
  const headerLines = 3; // app header + timeline header + status bar
  const availableHeight = Math.max(1, terminalHeight - headerLines - allDayLines);

  const totalSlots = 24 * SLOTS_PER_HOUR;

  // Maximum scroll offset - can't scroll past the end
  const maxScrollOffset = Math.max(0, totalSlots - availableHeight);

  const scrollOffset = useMemo(() => {
    let offset: number;

    if (selectedEventId) {
      const selectedLayout = layout.timedEvents.find(
        (l) => l.event.id === selectedEventId
      );
      if (selectedLayout) {
        const slot = minutesToSlot(selectedLayout.startMinutes);
        // Keep selected event roughly in the middle of the viewport
        const padding = Math.floor(availableHeight / 3);
        offset = slot - padding;
      } else {
        offset = 7 * SLOTS_PER_HOUR; // Default to 7 AM
      }
    } else if (isTodayView && nowSlot >= 0) {
      const padding = Math.floor(availableHeight / 3);
      offset = nowSlot - padding;
    } else {
      offset = 7 * SLOTS_PER_HOUR; // Default to 7 AM
    }

    // Clamp to valid range [0, maxScrollOffset]
    return Math.max(0, Math.min(offset, maxScrollOffset));
  }, [selectedEventId, layout.timedEvents, isTodayView, nowSlot, availableHeight, maxScrollOffset]);
  
  // Auto-select event closest to current time (for today) or first event (for other days)
  useEffect(() => {
    const hasValidSelection = selectedEventId && events.some((e) => e.id === selectedEventId);
    
    if (!hasValidSelection && events.length > 0) {
      if (isTodayView && nowMinutes >= 0) {
        // For today: select event nearest to current time
        const nearestEvent = findNearestEvent(layout, nowMinutes);
        if (nearestEvent) {
          setSelectedEventId(nearestEvent.id);
        }
      } else {
        // For other days: select first event
        const firstEvent = events[0];
        if (firstEvent) {
          setSelectedEventId(firstEvent.id);
        }
      }
    }
  }, [events, selectedEventId, setSelectedEventId, isTodayView, nowMinutes, layout]);
  
  // Calculate visible slot range
  const visibleSlots = useMemo(() => {
    const start = Math.max(0, scrollOffset);
    const end = Math.min(totalSlots, start + availableHeight);
    return Array.from({ length: end - start }, (_, i) => start + i);
  }, [scrollOffset, availableHeight, totalSlots]);

  // Recalculate sticky events based on actual scroll offset
  const actualStickyEvents = useMemo(() => {
    const visibleStartMinutes = scrollOffset * MINUTES_PER_SLOT;
    return layout.timedEvents.filter((l) => {
      const startSlot = minutesToSlot(l.startMinutes);
      return startSlot < scrollOffset && l.endMinutes > visibleStartMinutes;
    });
  }, [layout.timedEvents, scrollOffset]);

  return (
    <Box
      style={{
        flexGrow: 1,
        height: "100%",
        flexDirection: "column",
        paddingLeft: 1,
        clip: true,
      }}
    >
      {/* Header */}
      <Box style={{ flexDirection: "row", gap: 2 }}>
        <Text style={{ color: isFocused ? theme.accent.primary : theme.text.dim, bold: isFocused }}>
          {isFocused ? "▶ " : "  "}{formatDayHeader(selectedDay)}
        </Text>
        {isTodayView && (
          <Text style={{ color: theme.accent.success }}>today</Text>
        )}
      </Box>
      
      {/* All-day events */}
      <AllDayBar
        events={layout.allDayEvents}
        selectedEventId={selectedEventId}
        isFocused={isFocused}
        accountColorMap={accountColorMap}
      />
      
      {/* Keybinds when focused */}
      {isFocused && (
        <FocusScope trap>
          <TimelineKeybinds />
        </FocusScope>
      )}
      
      {/* Sticky headers for events scrolled out of view */}
      <StickyEventHeaders
        timedEvents={layout.timedEvents}
        scrollOffset={scrollOffset}
        selectedEventId={selectedEventId}
        isFocused={isFocused}
        accountColorMap={accountColorMap}
      />
      
      {/* Timeline grid - manually sliced for visible range */}
      <Box style={{ flexGrow: 1, clip: true }}>
        {visibleSlots.map((slotIndex) => (
          <SlotRow
            key={slotIndex}
            slotIndex={slotIndex}
            allEvents={layout.timedEvents}
            selectedEventId={selectedEventId}
            isFocused={isFocused}
            isNowSlot={nowSlot === slotIndex}
            accountColorMap={accountColorMap}
          />
        ))}
      </Box>
    </Box>
  );
}
