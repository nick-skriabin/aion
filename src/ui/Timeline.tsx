import React, { useMemo, useEffect, useRef } from "react";
import { Box, Text, ScrollView, FocusScope, useInput } from "@nick-skriabin/glyph";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  dayLayoutAtom,
  selectedDayAtom,
  focusAtom,
  selectedEventIdAtom,
  dayEventsAtom,
} from "../state/atoms.ts";
import {
  toggleFocusAtom,
  openDetailsAtom,
  openEditDialogAtom,
  initiateDeleteAtom,
  openCommandAtom,
  jumpToNowAtom,
  moveEventSelectionAtom,
} from "../state/actions.ts";
import { formatDayHeader, isToday, getNowMinutes, formatTime, getEventStart } from "../domain/time.ts";
import { getDisplayTitle } from "../domain/gcalEvent.ts";
import { findNearestEvent } from "../domain/layout.ts";
import { theme } from "./theme.ts";
import type { GCalEvent } from "../domain/gcalEvent.ts";
import type { TimedEventLayout } from "../domain/layout.ts";

const HOUR_LABEL_WIDTH = 7;
const SLOTS_PER_HOUR = 4;
const MINUTES_PER_SLOT = 15;
const COLUMN_WIDTH = 28;

function getEventTypeColor(event: GCalEvent) {
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
  
  const lastKeyRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  
  useInput((key) => {
    const now = Date.now();
    
    if (key.name === "j" || key.name === "down") {
      moveEventSelection("next");
      return;
    }
    if (key.name === "k" || key.name === "up") {
      moveEventSelection("prev");
      return;
    }
    
    if (key.name === "g" && !key.shift) {
      if (lastKeyRef.current === "g" && now - lastKeyTimeRef.current < 500) {
        moveEventSelection("first");
        lastKeyRef.current = "";
      } else {
        lastKeyRef.current = "g";
        lastKeyTimeRef.current = now;
      }
      return;
    }
    
    if (key.name === "g" && key.shift) {
      moveEventSelection("last");
      return;
    }
    
    if (key.name === "n" && !key.ctrl) {
      jumpToNow();
      return;
    }
    
    if (key.name === "return" || key.name === "space") {
      openDetails();
      return;
    }
    
    if (key.name === "e") {
      openEditDialog();
      return;
    }
    
    if (key.name === "d" && key.shift) {
      initiateDelete();
      return;
    }
    
    if (key.sequence === ":") {
      openCommand();
      return;
    }
    
    if (key.name === "h" || key.name === "l" || key.name === "tab") {
      toggleFocus();
      return;
    }
    
    if (key.name !== "g") {
      lastKeyRef.current = "";
    }
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
}: {
  slotEvent: SlotEvent | null;
  isSelected: boolean;
  isFocused: boolean;
  width: number;
}) {
  if (!slotEvent) {
    return <Box style={{ width }} />;
  }
  
  const { layout, isStart } = slotEvent;
  const event = layout.event;
  const eventColor = getEventTypeColor(event);
  const isHighlighted = isSelected && isFocused;
  
  const bgColor = isHighlighted ? theme.selection.background : undefined;
  const textColor = isHighlighted ? theme.selection.text : eventColor;
  
  if (isStart) {
    const start = getEventStart(event);
    const timeStr = formatTime(start);
    const title = getDisplayTitle(event);
    const titleWidth = Math.max(1, width - 8);
    const displayTitle = title.length > titleWidth ? title.slice(0, titleWidth - 1) + "…" : title;
    
    return (
      <Box style={{ width, flexDirection: "row", bg: bgColor }}>
        <Text style={{ color: textColor, bold: isHighlighted }}>
          {isHighlighted ? "▸" : "○"}
        </Text>
        <Text style={{ color: isHighlighted ? theme.selection.text : theme.text.dim }}> {timeStr} </Text>
        <Text style={{ color: textColor, bold: isHighlighted }}>
          {displayTitle}
        </Text>
      </Box>
    );
  } else {
    return (
      <Box style={{ width, bg: bgColor }}>
        <Text style={{ color: textColor }}>
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
}: {
  slotIndex: number;
  allEvents: TimedEventLayout[];
  selectedEventId: string | null;
  isFocused: boolean;
  isNowSlot: boolean;
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
      />
    );
  }
  
  // Grid line character and color
  let gridChar = isHourStart ? "┼" : "│";
  let gridColor = hasOverlap ? theme.accent.warning : theme.text.dim;
  
  if (isNowSlot) {
    gridChar = "◀"; // Current time indicator pointing at events
    gridColor = theme.accent.error;
  }
  
  return (
    <Box style={{ flexDirection: "row" }}>
      {/* Hour label */}
      <Box style={{ width: HOUR_LABEL_WIDTH }}>
        {isHourStart ? (
          <Text style={{ color: theme.text.dim }}>
            {formatHourLabel(hour).padStart(HOUR_LABEL_WIDTH - 1)}
          </Text>
        ) : isNowSlot ? (
          <Text style={{ color: theme.accent.error, bold: true }}>
            {"now".padStart(HOUR_LABEL_WIDTH - 1)}
          </Text>
        ) : null}
      </Box>
      
      {/* Grid line with current time indicator */}
      <Text style={{ color: gridColor, bold: isNowSlot }}>
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
}: {
  events: GCalEvent[];
  selectedEventId: string | null;
  isFocused: boolean;
}) {
  if (events.length === 0) return null;
  
  return (
    <Box style={{ paddingBottom: 1 }}>
      {events.map((event) => {
        const isSelected = selectedEventId === event.id;
        const eventColor = getEventTypeColor(event);
        const isHighlighted = isSelected && isFocused;
        const bgColor = isHighlighted ? theme.selection.background : undefined;
        const textColor = isHighlighted ? theme.selection.text : eventColor;
        
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
              <Text style={{ color: textColor, bold: isHighlighted }}>
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
  const layout = useAtomValue(dayLayoutAtom);
  const selectedDay = useAtomValue(selectedDayAtom);
  const focus = useAtomValue(focusAtom);
  const [selectedEventId, setSelectedEventId] = useAtom(selectedEventIdAtom);
  const events = useAtomValue(dayEventsAtom);
  
  const isFocused = focus === "timeline";
  const isTodayView = isToday(selectedDay);
  const nowMinutes = isTodayView ? getNowMinutes() : -1;
  const nowSlot = nowMinutes >= 0 ? minutesToSlot(nowMinutes) : -1;
  
  const scrollOffset = useMemo(() => {
    if (selectedEventId) {
      const selectedLayout = layout.timedEvents.find(
        (l) => l.event.id === selectedEventId
      );
      if (selectedLayout) {
        const slot = minutesToSlot(selectedLayout.startMinutes);
        return Math.max(0, slot - 8);
      }
    }
    if (isTodayView && nowSlot >= 0) {
      return Math.max(0, nowSlot - 8);
    }
    return 7 * SLOTS_PER_HOUR;
  }, [selectedEventId, layout.timedEvents, isTodayView, nowSlot]);
  
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
  
  const totalSlots = 24 * SLOTS_PER_HOUR;
  
  return (
    <Box
      style={{
        flexGrow: 1,
        height: "100%",
        flexDirection: "column",
        paddingLeft: 1,
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
      />
      
      {/* Keybinds when focused */}
      {isFocused && (
        <FocusScope trap>
          <TimelineKeybinds />
        </FocusScope>
      )}
      
      {/* Timeline grid */}
      <ScrollView style={{ flexGrow: 1 }} scrollOffset={scrollOffset}>
        {Array.from({ length: totalSlots }, (_, i) => i).map((slotIndex) => (
          <SlotRow
            key={slotIndex}
            slotIndex={slotIndex}
            allEvents={layout.timedEvents}
            selectedEventId={selectedEventId}
            isFocused={isFocused}
            isNowSlot={nowSlot === slotIndex}
          />
        ))}
      </ScrollView>
      
      {/* Footer */}
      <Box>
        <Text style={{ color: theme.text.dim, dim: true }}>
          j/k:nav  enter:details  e:edit  D:del  n:now
        </Text>
      </Box>
    </Box>
  );
}
