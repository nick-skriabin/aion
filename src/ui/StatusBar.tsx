import React, { useState, useEffect } from "react";
import { Box, Text, Input } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import { DateTime } from "luxon";
import {
  focusAtom,
  commandInputAtom,
  dayEventsAtom,
  eventsAtom,
  timezoneAtom,
} from "../state/atoms.ts";
import { executeCommandAtom, popOverlayAtom } from "../state/actions.ts";
import { getDisplayTitle } from "../domain/gcalEvent.ts";
import { getEventStart, formatTime } from "../domain/time.ts";
import { theme } from "./theme.ts";
import type { GCalEvent } from "../domain/gcalEvent.ts";

// Find the event closest to current time (next upcoming or currently ongoing)
function findClosestEvent(events: GCalEvent[], tz: string): GCalEvent | null {
  if (events.length === 0) return null;
  
  const now = DateTime.now().setZone(tz);
  const nowMinutes = now.hour * 60 + now.minute;
  
  let closest: GCalEvent | null = null;
  let closestDiff = Infinity;
  
  for (const event of events) {
    const start = getEventStart(event, tz);
    const startMinutes = start.hour * 60 + start.minute;
    
    // Prefer upcoming events, but also show ongoing
    const diff = startMinutes - nowMinutes;
    
    // If event is upcoming or just started (within last 30 min)
    if (diff >= -30 && Math.abs(diff) < closestDiff) {
      closest = event;
      closestDiff = Math.abs(diff);
    }
  }
  
  // If no upcoming event, return the last event of the day
  if (!closest && events.length > 0) {
    closest = events[events.length - 1];
  }
  
  return closest;
}

// Count events that need action (invites without response)
function useNotifications() {
  const allEvents = useAtomValue(eventsAtom);
  const events = Object.values(allEvents);
  
  let needsAction = 0;
  
  for (const event of events) {
    if (!event.attendees) continue;
    const selfAttendee = event.attendees.find((a) => a.self);
    if (selfAttendee?.responseStatus === "needsAction") {
      needsAction++;
    }
  }
  
  return { needsAction };
}

function Notifications() {
  const { needsAction } = useNotifications();
  
  if (needsAction === 0) return null;
  
  return (
    <Box style={{ flexDirection: "row", gap: 1 }}>
      <Text style={{ color: theme.accent.warning, bold: true }}>
        !{needsAction}
      </Text>
    </Box>
  );
}

function Clock() {
  const [time, setTime] = useState(DateTime.now());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(DateTime.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const timeStr = time.toFormat("HH:mm");
  const dateStr = time.toFormat("EEE, MMM d");
  
  return (
    <Box style={{ flexDirection: "row", gap: 2 }}>
      <Text style={{ color: theme.text.dim }}>{dateStr}</Text>
      <Text style={{ color: theme.text.primary, bold: true }}>{timeStr}</Text>
    </Box>
  );
}

function CommandInput() {
  const [input, setInput] = useAtom(commandInputAtom);
  const executeCommand = useSetAtom(executeCommandAtom);
  const popOverlay = useSetAtom(popOverlayAtom);
  
  const handleKeyPress = (key: string) => {
    if (key === "enter") {
      executeCommand();
    } else if (key === "escape") {
      popOverlay();
    }
  };
  
  return (
    <Box style={{ flexDirection: "row", flexGrow: 1 }}>
      <Text style={{ color: theme.accent.primary }}>:</Text>
      <Input
        value={input}
        onChange={setInput}
        onKeyPress={handleKeyPress}
        autoFocus
        style={{
          flexGrow: 1,
          color: theme.text.primary,
        }}
      />
    </Box>
  );
}

function NextEvent() {
  const events = useAtomValue(dayEventsAtom);
  const tz = useAtomValue(timezoneAtom);
  
  // Always show next event based on current time
  const event = findClosestEvent(events, tz);
  
  if (!event) {
    return (
      <Text style={{ color: theme.text.dim }}>No events today</Text>
    );
  }
  
  const title = getDisplayTitle(event);
  const start = getEventStart(event, tz);
  const timeStr = formatTime(start);
  const isAllDay = !event.start.dateTime;
  
  // Check if event is currently ongoing
  const now = DateTime.now().setZone(tz);
  const end = event.end.dateTime ? DateTime.fromISO(event.end.dateTime).setZone(tz) : null;
  const isOngoing = end && start <= now && now < end;
  
  return (
    <Box style={{ flexDirection: "row", gap: 1, flexGrow: 1 }}>
      <Text style={{ color: isOngoing ? theme.accent.success : theme.accent.primary }}>
        {isOngoing ? "now" : isAllDay ? "all-day" : timeStr}
      </Text>
      <Text style={{ color: theme.text.primary }} wrap="truncate">
        {title}
      </Text>
    </Box>
  );
}

export function StatusBar() {
  const focus = useAtomValue(focusAtom);
  const isCommandMode = focus === "command";
  
  return (
    <Box
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingX: 1,
        bg: theme.statusBar?.background,
      }}
    >
      {/* Left side: Command input or next event */}
      <Box style={{ flexGrow: 1, flexShrink: 1 }}>
        {isCommandMode ? <CommandInput /> : <NextEvent />}
      </Box>
      
      {/* Right side: Notifications + Clock */}
      <Box style={{ flexDirection: "row", gap: 2 }}>
        <Notifications />
        <Clock />
      </Box>
    </Box>
  );
}
