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
import { formatDayHeader, isToday, getNowMinutes, formatTime, getEventStart, getEventEnd } from "../domain/time.ts";
import { getDisplayTitle, isAllDay as checkIsAllDay } from "../domain/gcalEvent.ts";
import { theme } from "./theme.ts";
import type { GCalEvent } from "../domain/gcalEvent.ts";
import type { TimedEventLayout } from "../domain/layout.ts";

const HOUR_LABEL_WIDTH = 6;

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

// Get all events active during a specific hour
function getEventsForHour(hour: number, allEvents: TimedEventLayout[]): {
  starting: TimedEventLayout[];
  continuing: TimedEventLayout[];
} {
  const hourStart = hour * 60;
  const hourEnd = (hour + 1) * 60;
  
  const starting: TimedEventLayout[] = [];
  const continuing: TimedEventLayout[] = [];
  
  for (const event of allEvents) {
    const eventStartHour = Math.floor(event.startMinutes / 60);
    
    // Event starts this hour
    if (eventStartHour === hour) {
      starting.push(event);
    }
    // Event started earlier but continues through this hour
    else if (event.startMinutes < hourStart && event.endMinutes > hourStart) {
      continuing.push(event);
    }
  }
  
  // Sort starting events by start time
  starting.sort((a, b) => a.startMinutes - b.startMinutes);
  
  return { starting, continuing };
}

// Single event row
function EventRow({
  layout,
  isSelected,
  isFocused,
  isContinuation,
  showConflictWith,
}: {
  layout: TimedEventLayout;
  isSelected: boolean;
  isFocused: boolean;
  isContinuation: boolean;
  showConflictWith?: string[];
}) {
  const event = layout.event;
  const color = getEventTypeColor(event);
  const start = getEventStart(event);
  const end = getEventEnd(event);
  
  return (
    <Box style={{ flexDirection: "row", gap: 1 }}>
      {/* Selection indicator */}
      <Text
        style={{
          color: isSelected && isFocused ? theme.selection.indicator : color,
          bold: isSelected && isFocused,
        }}
      >
        {isSelected && isFocused ? "▸" : isContinuation ? "┆" : "○"}
      </Text>
      
      {/* Time range or continuation indicator */}
      <Text
        style={{
          color: isSelected && isFocused ? theme.selection.indicator : theme.text.dim,
          width: 13,
        }}
      >
        {isContinuation ? "  (ongoing)" : `${formatTime(start)}-${formatTime(end)}`}
      </Text>
      
      {/* Event title */}
      <Text
        style={{
          color: isSelected && isFocused ? theme.selection.indicator : color,
          bold: isSelected && isFocused,
          flexGrow: 1,
        }}
        wrap="truncate"
      >
        {getDisplayTitle(event)}
      </Text>
    </Box>
  );
}

// Hour block showing ALL events active during this hour
function HourBlock({
  hour,
  allEvents,
  selectedEventId,
  isFocused,
  isNowHour,
}: {
  hour: number;
  allEvents: TimedEventLayout[];
  selectedEventId: string | null;
  isFocused: boolean;
  isNowHour: boolean;
}) {
  const { starting, continuing } = getEventsForHour(hour, allEvents);
  
  // Combine all active events: continuing first, then starting
  const activeEvents = [...continuing, ...starting];
  const hasMultiple = activeEvents.length > 1;
  
  return (
    <Box style={{ flexDirection: "column" }}>
      {/* Main hour row */}
      <Box style={{ flexDirection: "row" }}>
        {/* Hour label */}
        <Box style={{ width: HOUR_LABEL_WIDTH }}>
          <Text style={{ color: theme.text.dim }}>
            {formatHourLabel(hour).padStart(HOUR_LABEL_WIDTH - 1)}
          </Text>
        </Box>
        
        {/* Grid line - highlight if there are overlapping events */}
        <Text style={{ 
          color: isNowHour 
            ? theme.accent.error 
            : hasMultiple 
            ? theme.accent.warning 
            : theme.text.dim 
        }}>
          {isNowHour ? "┃" : hasMultiple ? "┃" : "│"}
        </Text>
        
        {/* First event */}
        <Box style={{ flexGrow: 1, paddingLeft: 1 }}>
          {activeEvents[0] ? (
            <EventRow
              layout={activeEvents[0]}
              isSelected={selectedEventId === activeEvents[0].event.id}
              isFocused={isFocused}
              isContinuation={continuing.includes(activeEvents[0])}
            />
          ) : null}
        </Box>
      </Box>
      
      {/* Additional events (showing overlap) */}
      {activeEvents.slice(1).map((layout) => (
        <Box key={layout.event.id} style={{ flexDirection: "row" }}>
          <Box style={{ width: HOUR_LABEL_WIDTH }} />
          <Text style={{ color: theme.accent.warning }}>┃</Text>
          <Box style={{ flexGrow: 1, paddingLeft: 1 }}>
            <EventRow
              layout={layout}
              isSelected={selectedEventId === layout.event.id}
              isFocused={isFocused}
              isContinuation={continuing.includes(layout)}
            />
          </Box>
        </Box>
      ))}
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
        const color = getEventTypeColor(event);
        return (
          <Box key={event.id} style={{ flexDirection: "row" }}>
            <Box style={{ width: HOUR_LABEL_WIDTH }}>
              <Text style={{ color: theme.text.dim }}>all-day</Text>
            </Box>
            <Text style={{ color: theme.text.dim }}>│</Text>
            <Box style={{ paddingLeft: 1, flexDirection: "row", gap: 1 }}>
              <Text
                style={{
                  color: isSelected && isFocused ? theme.selection.indicator : color,
                  bold: isSelected && isFocused,
                }}
              >
                {isSelected && isFocused ? "▸" : "○"}
              </Text>
              <Text
                style={{
                  color: isSelected && isFocused ? theme.selection.indicator : color,
                  bold: isSelected && isFocused,
                }}
              >
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
  const nowHour = Math.floor(nowMinutes / 60);
  
  // Calculate scroll position
  const scrollOffset = useMemo(() => {
    if (selectedEventId) {
      const selectedLayout = layout.timedEvents.find(
        (l) => l.event.id === selectedEventId
      );
      if (selectedLayout) {
        const hour = Math.floor(selectedLayout.startMinutes / 60);
        return Math.max(0, hour - 2);
      }
    }
    if (isTodayView && nowHour >= 0) {
      return Math.max(0, nowHour - 2);
    }
    return 7; // Default to 7 AM visible
  }, [selectedEventId, layout.timedEvents, isTodayView, nowHour]);
  
  // Auto-select first event when day changes
  useEffect(() => {
    const firstEvent = events[0];
    const hasValidSelection = selectedEventId && events.some((e) => e.id === selectedEventId);
    if (firstEvent && !hasValidSelection) {
      setSelectedEventId(firstEvent.id);
    }
  }, [events, selectedEventId, setSelectedEventId]);
  
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
      
      {/* Hour grid - full 24 hours */}
      <ScrollView style={{ flexGrow: 1 }} scrollOffset={scrollOffset}>
        {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
          <HourBlock
            key={hour}
            hour={hour}
            allEvents={layout.timedEvents}
            selectedEventId={selectedEventId}
            isFocused={isFocused}
            isNowHour={isTodayView && nowHour === hour}
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
