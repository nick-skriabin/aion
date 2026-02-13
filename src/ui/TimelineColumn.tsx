import React, { useMemo, useEffect, useRef } from "react";
import { Box, Text, useInput, useApp, type Color } from "@semos-labs/glyph";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { DateTime } from "luxon";
import {
  selectedDayAtom,
  focusAtom,
  selectedEventIdAtom,
  calendarColorMapAtom,
  allDayExpandedAtom,
  filteredEventsArrayAtom,
  timezoneAtom,
  sharedScrollOffsetAtom,
  focusedColumnAtom,
} from "../state/atoms.ts";
import {
  toggleFocusAtom,
  openDetailsAtom,
  openEditDialogAtom,
  proposeNewTimeAtom,
  openCommandAtom,
  jumpToNowAtom,
  moveEventSelectionAtom,
  openNotificationsAtom,
  newEventAtom,
  toggleAllDayExpandedAtom,
  toggleCalendarSidebarAtom,
  openGotoDialogAtom,
  openMeetWithDialogAtom,
  toggleColumnsAtom,
  moveColumnAtom,
} from "../state/actions.ts";
import { useDeleteEvent } from "./hooks/useDeleteEvent.tsx";
import { formatDayHeader, isToday, getNowMinutes, formatTime, getEventStart, getEventEnd, getLocalTimezone, formatHourLabel } from "../domain/time.ts";
import { getDisplayTitle, type ResponseStatus } from "../domain/gcalEvent.ts";
import { layoutDay, getChronologicalEvents, findNearestEvent } from "../domain/layout.ts";
import { handleKeyEvent } from "../keybinds/useKeybinds.tsx";
import { theme } from "./theme.ts";
import type { GCalEvent } from "../domain/gcalEvent.ts";
import type { TimedEventLayout } from "../domain/layout.ts";

const HOUR_LABEL_WIDTH = 7;
const SLOTS_PER_HOUR = 4;
const MINUTES_PER_SLOT = 15;

function getSelfResponseStatus(event: GCalEvent): ResponseStatus | undefined {
  const selfAttendee = event.attendees?.find((a) => a.self);
  return selfAttendee?.responseStatus;
}

function getAttendanceIndicator(status: ResponseStatus | undefined, hasAttendees: boolean): string {
  switch (status) {
    case "accepted": return "✓ ";
    case "declined": return "✗ ";
    case "tentative": return "? ";
    case "needsAction": return "! ";
    default: return hasAttendees ? "! " : "";
  }
}

function getAttendanceColor(status: ResponseStatus | undefined, hasAttendees: boolean): string | undefined {
  switch (status) {
    case "accepted": return theme.status.accepted;
    case "declined": return theme.status.declined;
    case "tentative": return theme.status.tentative;
    case "needsAction": return theme.accent.warning;
    default: return hasAttendees ? theme.accent.warning : undefined;
  }
}

function isEventPast(event: GCalEvent, tz: string): boolean {
  const end = getEventEnd(event, tz);
  return end < DateTime.now();
}

function getEventColor(event: GCalEvent, calendarColorMap: Record<string, string>): string {
  const key = `${event.accountEmail}:${event.calendarId}`;
  const calendarColor = calendarColorMap[key] || "#4285f4";

  if (calendarColor !== "#4285f4") return calendarColor;

  switch (event.eventType) {
    case "outOfOffice": return theme.eventType.outOfOffice;
    case "focusTime": return theme.eventType.focusTime;
    case "birthday": return theme.eventType.birthday;
    default: return calendarColor;
  }
}

function minutesToSlot(minutes: number): number {
  return Math.floor(minutes / MINUTES_PER_SLOT);
}

// Keyboard handler
function TimelineKeybinds() {
  const toggleFocus = useSetAtom(toggleFocusAtom);
  const openDetails = useSetAtom(openDetailsAtom);
  const openEditDialog = useSetAtom(openEditDialogAtom);
  const proposeNewTime = useSetAtom(proposeNewTimeAtom);
  const { deleteEvent } = useDeleteEvent();
  const openCommand = useSetAtom(openCommandAtom);
  const jumpToNow = useSetAtom(jumpToNowAtom);
  const moveEventSelection = useSetAtom(moveEventSelectionAtom);
  const openNotifications = useSetAtom(openNotificationsAtom);
  const newEvent = useSetAtom(newEventAtom);
  const toggleAllDayExpanded = useSetAtom(toggleAllDayExpandedAtom);
  const toggleCalendarSidebar = useSetAtom(toggleCalendarSidebarAtom);
  const openGotoDialog = useSetAtom(openGotoDialogAtom);
  const openMeetWithDialog = useSetAtom(openMeetWithDialogAtom);
  const toggleColumns = useSetAtom(toggleColumnsAtom);
  const moveColumn = useSetAtom(moveColumnAtom);

  const lastKeyRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  const handlers = useMemo(() => ({
    nextEvent: () => moveEventSelection("next"),
    prevEvent: () => moveEventSelection("prev"),
    firstEvent: () => moveEventSelection("first"),
    lastEvent: () => moveEventSelection("last"),
    prevColumn: () => moveColumn("left"),
    nextColumn: () => moveColumn("right"),
    jumpToNow: () => jumpToNow(),
    openDetails: () => openDetails(),
    editEvent: () => openEditDialog(),
    proposeNewTime: () => proposeNewTime(),
    deleteEvent: () => deleteEvent(),
    openCommand: () => openCommand(),
    toggleFocus: () => toggleFocus(),
  }), [moveEventSelection, jumpToNow, openDetails, openEditDialog, proposeNewTime, deleteEvent, openCommand, toggleFocus, moveColumn]);

  const globalHandlers = useMemo(() => ({
    toggleFocus: () => toggleFocus(),
    openNotifications: () => openNotifications(),
    newEvent: () => newEvent(),
    toggleAllDay: () => toggleAllDayExpanded(),
    toggleCalendars: () => toggleCalendarSidebar(),
    openGoto: () => openGotoDialog(),
    openMeetWith: () => openMeetWithDialog(),
    toggleColumns: () => toggleColumns(),
  }), [toggleFocus, openNotifications, newEvent, toggleAllDayExpanded, toggleCalendarSidebar, openGotoDialog, openMeetWithDialog, toggleColumns]);

  useInput((key) => {
    if (handleKeyEvent("global", key, globalHandlers)) return;

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

    if (key.name !== "g") lastKeyRef.current = "";
    handleKeyEvent("timeline", key, handlers);
  });

  return null;
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

// Event cell in a slot
function EventCell({
  slotEvent,
  isSelected,
  isFocused,
  calendarColorMap,
}: {
  slotEvent: SlotEvent | null;
  isSelected: boolean;
  isFocused: boolean;
  calendarColorMap: Record<string, string>;
}) {
  if (!slotEvent) {
    return <Box style={{ flexGrow: 1, width: 0, clip: true }} />;
  }

  const { layout, isStart } = slotEvent;
  const event = layout.event;
  const eventColor = getEventColor(event, calendarColorMap) as Color;
  const isHighlighted = isSelected && isFocused;
  const responseStatus = getSelfResponseStatus(event);
  const hasAttendees = (event.attendees?.length ?? 0) > 0;
  const attendanceIndicator = getAttendanceIndicator(responseStatus, hasAttendees);
  const attendanceColor = getAttendanceColor(responseStatus, hasAttendees) as Color | undefined;
  const isDeclined = responseStatus === "declined";
  const isPast = isEventPast(event, getLocalTimezone());
  const shouldDim = isDeclined || isPast;

  const textColor: Color = isHighlighted
    ? theme.selection.text
    : (shouldDim ? theme.text.dim : eventColor);
  const bg = isHighlighted ? theme.selection.background : undefined;

  if (isStart) {
    const start = getEventStart(event);
    const timeStr = formatTime(start);
    const title = getDisplayTitle(event);

    return (
      <Box style={{ flexGrow: 1, width: 0, flexDirection: "row", clip: true }}>
        <Text style={{ bg, color: isHighlighted ? theme.selection.text : eventColor, dim: shouldDim }}>●</Text>
        <Text style={{ bg, color: isHighlighted ? theme.selection.text : theme.text.dim }}>{isHighlighted ? "▸" : " "}{timeStr} </Text>
        {attendanceIndicator && (
          <Text style={{ bg, color: isHighlighted ? theme.selection.text : attendanceColor }}>{attendanceIndicator}</Text>
        )}
        <Box style={{ flexGrow: 1, width: 0, clip: true }}>
          <Text style={{ bg, color: textColor, bold: isHighlighted, dim: shouldDim }}>{title}</Text>
        </Box>
      </Box>
    );
  } else {
    return (
      <Box style={{ flexGrow: 1, width: 0, clip: true }}>
        <Text style={{ bg, color: isHighlighted ? theme.selection.text : eventColor, dim: shouldDim }}>│</Text>
      </Box>
    );
  }
}

// Slot row (15 minutes)
function SlotRow({
  slotIndex,
  allEvents,
  selectedEventId,
  isFocused,
  isNowSlot,
  calendarColorMap,
  showHourLabel,
}: {
  slotIndex: number;
  allEvents: TimedEventLayout[];
  selectedEventId: string | null;
  isFocused: boolean;
  isNowSlot: boolean;
  calendarColorMap: Record<string, string>;
  showHourLabel: boolean;
}) {
  const { byColumn, maxColumns } = getEventsForSlot(slotIndex, allEvents);
  const hour = Math.floor(slotIndex / SLOTS_PER_HOUR);
  const slotInHour = slotIndex % SLOTS_PER_HOUR;
  const isHourStart = slotInHour === 0;
  const hasOverlap = maxColumns > 1;

  // Build columns for overlapping events
  const columns: React.ReactNode[] = [];
  for (let col = 0; col < maxColumns; col++) {
    const slotEvent = byColumn.get(col) || null;
    const isSelected = slotEvent ? selectedEventId === slotEvent.layout.event.id : false;
    columns.push(
      <EventCell
        key={col}
        slotEvent={slotEvent}
        isSelected={isSelected}
        isFocused={isFocused}
        calendarColorMap={calendarColorMap}
      />
    );
  }

  // Grid line
  let gridChar = isHourStart ? "┼" : "│";
  let gridColor = hasOverlap ? theme.accent.warning : theme.text.dim;
  if (isNowSlot) {
    gridChar = "◀";
    gridColor = theme.accent.error;
  }

  return (
    <Box style={{ flexDirection: "row", height: 1 }}>
      {/* Hour label */}
      {showHourLabel && (
        <Box style={{ width: HOUR_LABEL_WIDTH }}>
          {isHourStart && isNowSlot ? (
            <Text style={{ color: theme.accent.error, bold: true }}>{formatHourLabel(hour).padStart(HOUR_LABEL_WIDTH - 1)}</Text>
          ) : isHourStart ? (
            <Text style={{ color: theme.text.dim }}>{formatHourLabel(hour).padStart(HOUR_LABEL_WIDTH - 1)}</Text>
          ) : isNowSlot ? (
            <Text style={{ color: theme.accent.error, bold: true }}>{"now".padStart(HOUR_LABEL_WIDTH - 1)}</Text>
          ) : null}
        </Box>
      )}

      {/* Grid line */}
      <Text style={{ color: gridColor }}>{gridChar}</Text>

      {/* Event columns - with padding */}
      <Box style={{ flexGrow: 1, flexDirection: "row", paddingLeft: 1 }}>
        {columns}
      </Box>
    </Box>
  );
}

// All-day event row
function AllDayEventRow({
  event,
  isSelected,
  isFocused,
  calendarColorMap,
  showLabel,
  isFirst,
}: {
  event: GCalEvent | null;
  isSelected: boolean;
  isFocused: boolean;
  calendarColorMap: Record<string, string>;
  showLabel: boolean;
  isFirst: boolean;
}) {
  if (!event) {
    return (
      <Box style={{ flexDirection: "row", height: 1 }}>
        {showLabel && <Box style={{ width: HOUR_LABEL_WIDTH }}>{isFirst && <Text style={{ color: theme.text.dim }}>all-day</Text>}</Box>}
        <Text style={{ color: theme.text.dim }}>│</Text>
      </Box>
    );
  }

  const eventColor = getEventColor(event, calendarColorMap);
  const isHighlighted = isSelected && isFocused;
  const responseStatus = getSelfResponseStatus(event);
  const hasAttendees = (event.attendees?.length ?? 0) > 0;
  const attendanceIndicator = getAttendanceIndicator(responseStatus, hasAttendees);
  const attendanceColor = getAttendanceColor(responseStatus, hasAttendees);
  const isDeclined = responseStatus === "declined";
  const isPast = isEventPast(event, getLocalTimezone());
  const shouldDim = isDeclined || isPast;

  const bgColor = isHighlighted ? theme.selection.background : undefined;
  const eventColorTyped = eventColor as Color;
  const attendanceColorTyped = attendanceColor as Color | undefined;
  const textColor: Color = isHighlighted ? theme.selection.text : (shouldDim ? theme.text.dim : eventColorTyped);

  return (
    <Box style={{ flexDirection: "row", height: 1 }}>
      {showLabel && <Box style={{ width: HOUR_LABEL_WIDTH }}>{isFirst && <Text style={{ color: theme.text.dim }}>all-day</Text>}</Box>}
      <Text style={{ color: theme.text.dim }}>│</Text>
      <Box style={{ flexGrow: 1, flexDirection: "row", bg: bgColor, paddingLeft: 1 }}>
        <Text style={{ color: eventColorTyped, dim: shouldDim }}>●</Text>
        <Text style={{ color: isHighlighted ? theme.selection.text : theme.text.dim }}>{isHighlighted ? "▸" : " "}</Text>
        {attendanceIndicator && <Text style={{ color: isHighlighted ? theme.selection.text : attendanceColorTyped }}>{attendanceIndicator}</Text>}
        <Text style={{ color: textColor, bold: isHighlighted, dim: shouldDim }}>{getDisplayTitle(event)}</Text>
      </Box>
    </Box>
  );
}

// All-day section - uses allDayLines for consistent height across columns
function AllDaySection({
  events,
  selectedEventId,
  isFocused,
  calendarColorMap,
  isExpanded,
  maxAllDayCount,
  allDayLines,
  showLabel,
}: {
  events: GCalEvent[];
  selectedEventId: string | null;
  isFocused: boolean;
  calendarColorMap: Record<string, string>;
  isExpanded: boolean;
  maxAllDayCount: number;
  allDayLines: number;
  showLabel: boolean;
}) {
  if (maxAllDayCount === 0) return null;

  const COLLAPSE_THRESHOLD = 2;
  const shouldCollapse = maxAllDayCount > COLLAPSE_THRESHOLD && !isExpanded;
  const visibleCount = shouldCollapse ? COLLAPSE_THRESHOLD : maxAllDayCount;
  const hiddenCount = events.length - COLLAPSE_THRESHOLD;
  const hasHiddenEvents = events.length > COLLAPSE_THRESHOLD;
  const selectedInHidden = shouldCollapse && events.slice(COLLAPSE_THRESHOLD).some(e => e.id === selectedEventId);

  return (
    <Box style={{ flexDirection: "column", height: allDayLines }}>
      {Array.from({ length: visibleCount }).map((_, index) => (
        <AllDayEventRow
          key={index}
          event={events[index] || null}
          isSelected={events[index] ? selectedEventId === events[index].id : false}
          isFocused={isFocused}
          calendarColorMap={calendarColorMap}
          showLabel={showLabel}
          isFirst={index === 0}
        />
      ))}

      {/* Show "+X more" only if this day has hidden events, otherwise show empty row for alignment */}
      {shouldCollapse && (
        <Box style={{ flexDirection: "row", height: 1 }}>
          {showLabel && <Box style={{ width: HOUR_LABEL_WIDTH }} />}
          {hasHiddenEvents ? (
            <>
              <Text style={{ color: theme.text.dim }}>│</Text>
              <Text style={{ color: selectedInHidden ? theme.accent.warning : theme.text.dim }}>
                {selectedInHidden ? " ▸" : "  "}+{hiddenCount} more (a)
              </Text>
            </>
          ) : (
            <Text style={{ color: theme.text.dim }}>│</Text>
          )}
        </Box>
      )}

      {isExpanded && maxAllDayCount > COLLAPSE_THRESHOLD && (
        <Box style={{ flexDirection: "row", height: 1 }}>
          {showLabel && <Box style={{ width: HOUR_LABEL_WIDTH }} />}
          <Text style={{ color: theme.text.dim }}>│  (a to collapse)</Text>
        </Box>
      )}
    </Box>
  );
}

interface TimelineColumnProps {
  day: DateTime;
  columnIndex: number;
  maxAllDayCount: number;
  allDayLines: number;
  showHourLabels: boolean;
}

export function TimelineColumn({ day, columnIndex, maxAllDayCount, allDayLines, showHourLabels }: TimelineColumnProps) {
  const { rows: terminalHeight } = useApp();
  const allEvents = useAtomValue(filteredEventsArrayAtom);
  const tz = useAtomValue(timezoneAtom);
  const focus = useAtomValue(focusAtom);
  const [selectedEventId, setSelectedEventId] = useAtom(selectedEventIdAtom);
  const calendarColorMap = useAtomValue(calendarColorMapAtom);
  const allDayExpanded = useAtomValue(allDayExpandedAtom);
  const [sharedScrollOffset, setSharedScrollOffset] = useAtom(sharedScrollOffsetAtom);
  const focusedColumn = useAtomValue(focusedColumnAtom);

  const layout = useMemo(() => layoutDay(allEvents, day, tz), [allEvents, day, tz]);
  const events = useMemo(() => getChronologicalEvents(layout), [layout]);

  const isFocused = focus === "timeline";
  const isColumnFocused = isFocused && focusedColumn === columnIndex;
  const isTodayView = isToday(day);
  const nowMinutes = isTodayView ? getNowMinutes() : -1;
  const nowSlot = nowMinutes >= 0 ? minutesToSlot(nowMinutes) : -1;

  // Calculate available height
  const headerLines = 3;
  const availableHeight = Math.max(1, terminalHeight - headerLines - allDayLines);
  const totalSlots = 24 * SLOTS_PER_HOUR;
  const maxScrollOffset = Math.max(0, totalSlots - availableHeight);

  // Focused column updates scroll offset - only when we have a valid event to scroll to
  useEffect(() => {
    if (!isColumnFocused) return;

    let offset: number | null = null;
    
    if (selectedEventId) {
      // Check if selected event exists in THIS column's events
      const selectedLayout = layout.timedEvents.find((l) => l.event.id === selectedEventId);
      if (selectedLayout) {
        const slot = minutesToSlot(selectedLayout.startMinutes);
        offset = slot - Math.floor(availableHeight / 3);
      }
      // If selected event not in this column, don't change scroll - let auto-select handle it
    } else if (isTodayView && nowSlot >= 0) {
      offset = nowSlot - Math.floor(availableHeight / 3);
    }
    // Don't default to 7 AM - keep current scroll if no valid target
    
    if (offset !== null) {
      setSharedScrollOffset(Math.max(0, Math.min(offset, maxScrollOffset)));
    }
  }, [selectedEventId, layout.timedEvents, isTodayView, nowSlot, availableHeight, maxScrollOffset, isColumnFocused, setSharedScrollOffset]);

  // Auto-select nearest event
  useEffect(() => {
    if (!isColumnFocused) return;
    const hasValidSelection = selectedEventId && events.some((e) => e.id === selectedEventId);
    if (!hasValidSelection && events.length > 0) {
      if (isTodayView && nowMinutes >= 0) {
        const nearestEvent = findNearestEvent(layout, nowMinutes);
        if (nearestEvent) setSelectedEventId(nearestEvent.id);
      } else {
        const firstEvent = events[0];
        if (firstEvent) setSelectedEventId(firstEvent.id);
      }
    }
  }, [events, selectedEventId, setSelectedEventId, isTodayView, nowMinutes, layout, isColumnFocused]);

  const visibleSlots = useMemo(() => {
    const start = Math.max(0, sharedScrollOffset);
    const end = Math.min(totalSlots, start + availableHeight);
    return Array.from({ length: end - start }, (_, i) => start + i);
  }, [sharedScrollOffset, availableHeight, totalSlots]);

  return (
    <Box
      style={{
        flexGrow: 1,
        width: 0,
        height: "100%",
        flexDirection: "column",
        clip: true,
      }}
    >
      {/* Header */}
      <Box style={{ flexDirection: "row", gap: 1 }}>
        {showHourLabels && <Box style={{ width: HOUR_LABEL_WIDTH }} />}
        <Text style={{ color: isColumnFocused ? theme.accent.primary : theme.text.dim, bold: isColumnFocused }}>
          {isColumnFocused ? "▶ " : "  "}{formatDayHeader(day)}
        </Text>
        {isTodayView && <Text style={{ color: theme.accent.success }}>today</Text>}
      </Box>

      {/* All-day events */}
      <AllDaySection
        events={layout.allDayEvents}
        selectedEventId={selectedEventId}
        isFocused={isFocused}
        calendarColorMap={calendarColorMap}
        isExpanded={allDayExpanded}
        maxAllDayCount={maxAllDayCount}
        allDayLines={allDayLines}
        showLabel={showHourLabels}
      />

      {/* Keybinds - focused column only */}
      {isColumnFocused && <TimelineKeybinds />}

      {/* Timeline grid */}
      <Box style={{ flexGrow: 1, clip: true }}>
        {visibleSlots.map((slotIndex) => (
          <SlotRow
            key={slotIndex}
            slotIndex={slotIndex}
            allEvents={layout.timedEvents}
            selectedEventId={selectedEventId}
            isFocused={isFocused}
            isNowSlot={nowSlot === slotIndex}
            calendarColorMap={calendarColorMap}
            showHourLabel={showHourLabels}
          />
        ))}
      </Box>
    </Box>
  );
}
