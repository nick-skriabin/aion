import React, { useMemo, useEffect } from "react";
import { Box, Text, ScrollView } from "@nick-skriabin/glyph";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  dayLayoutAtom,
  selectedDayAtom,
  focusAtom,
  selectedEventIdAtom,
  dayEventsAtom,
} from "../state/atoms.ts";
import { formatDayHeader, isToday, formatTime, getEventStart, getEventEnd } from "../domain/time.ts";
import { getDisplayTitle, isAllDay as checkIsAllDay } from "../domain/gcalEvent.ts";
import { theme, styles } from "./theme.ts";
import type { GCalEvent } from "../domain/gcalEvent.ts";

function getEventColor(event: GCalEvent) {
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

function getEventBadge(event: GCalEvent): string {
  switch (event.eventType) {
    case "outOfOffice":
      return "🚫 ";
    case "focusTime":
      return "🎯 ";
    case "birthday":
      return "🎂 ";
    default:
      return "";
  }
}

export function Timeline() {
  const layout = useAtomValue(dayLayoutAtom);
  const selectedDay = useAtomValue(selectedDayAtom);
  const focus = useAtomValue(focusAtom);
  const [selectedEventId, setSelectedEventId] = useAtom(selectedEventIdAtom);
  const events = useAtomValue(dayEventsAtom);
  
  const isFocused = focus === "timeline";
  const isTodayView = isToday(selectedDay);
  
  // Get selected index for scrolling
  const selectedIndex = useMemo(() => {
    if (!selectedEventId) return 0;
    return events.findIndex((e) => e.id === selectedEventId);
  }, [events, selectedEventId]);
  
  // Auto-select first event if none selected
  useEffect(() => {
    const firstEvent = events[0];
    if (firstEvent && !selectedEventId) {
      setSelectedEventId(firstEvent.id);
    }
  }, [events, selectedEventId, setSelectedEventId]);
  
  return (
    <Box
      style={{
        flexGrow: 1,
        height: "100%",
        ...(isFocused ? styles.panelFocused : styles.panel),
        flexDirection: "column",
        padding: 0,
      }}
    >
      {/* Header with date */}
      <Box
        style={{
          paddingX: 1,
          paddingY: 0,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ ...styles.header, color: theme.accent.primary }}>
          {formatDayHeader(selectedDay)}
        </Text>
        {isTodayView && (
          <Text style={{ color: theme.accent.success, bold: true }}>TODAY</Text>
        )}
      </Box>
      
      {/* Main content area */}
      <ScrollView 
        style={{ flexGrow: 1, paddingX: 1 }}
        scrollOffset={Math.max(0, selectedIndex - 3)}
      >
        {/* All-day events section */}
        {layout.allDayEvents.length > 0 && (
          <Box style={{ flexDirection: "column", paddingBottom: 1 }}>
            <Text style={{ color: theme.text.dim }}>All day</Text>
            {layout.allDayEvents.map((event) => {
              const isSelected = selectedEventId === event.id;
              const color = getEventColor(event);
              return (
                <Box
                  key={event.id}
                  style={{
                    flexDirection: "row",
                    gap: 1,
                    bg: isSelected && isFocused ? theme.bg.selected : undefined,
                  }}
                >
                  <Text style={{ color }}>{isSelected ? "▶" : "│"}</Text>
                  <Text style={{ color: theme.text.primary, bold: isSelected }}>
                    {getEventBadge(event)}{getDisplayTitle(event)}
                  </Text>
                </Box>
              );
            })}
            <Text style={{ color: theme.border.normal }}>────────────────────────────────</Text>
          </Box>
        )}
        
        {/* Timed events */}
        {events.length === 0 ? (
          <Box style={{ paddingY: 2 }}>
            <Text style={{ color: theme.text.secondary }}>
              No events for this day
            </Text>
            <Text style={{ color: theme.text.dim, dim: true }}>
              Press : then /new to create one
            </Text>
          </Box>
        ) : (
          events.filter(e => !checkIsAllDay(e)).map((event) => {
            const isSelected = selectedEventId === event.id;
            const color = getEventColor(event);
            const start = getEventStart(event);
            const end = getEventEnd(event);
            const timeStr = `${formatTime(start)}–${formatTime(end)}`;
            
            return (
              <Box
                key={event.id}
                style={{
                  flexDirection: "row",
                  gap: 1,
                  bg: isSelected && isFocused ? theme.bg.selected : undefined,
                  paddingY: 0,
                }}
              >
                <Text style={{ color }}>{isSelected ? "▶" : "│"}</Text>
                <Text style={{ color: theme.text.dim, width: 13 }}>{timeStr}</Text>
                <Text
                  style={{ color: theme.text.primary, bold: isSelected, flexGrow: 1 }}
                  wrap="truncate"
                >
                  {getEventBadge(event)}{getDisplayTitle(event)}
                </Text>
                {event.attendees && event.attendees.length > 0 && (
                  <Text style={{ color: theme.text.dim }}>👥{event.attendees.length}</Text>
                )}
              </Box>
            );
          })
        )}
      </ScrollView>
      
      {/* Footer with keyboard hints */}
      <Box
        style={{
          paddingX: 1,
          flexDirection: "row",
          gap: 2,
        }}
      >
        <Text style={{ color: theme.text.dim, dim: true }}>
          j/k:nav │ Enter:details │ e:edit │ D:delete │ ::cmd
        </Text>
      </Box>
    </Box>
  );
}
