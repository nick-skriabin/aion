import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Box, Text, Input, Portal, FocusScope } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import { DateTime } from "luxon";
import {
  focusAtom,
  commandInputAtom,
  commandSelectedIndexAtom,
  dayEventsAtom,
  eventsAtom,
  timezoneAtom,
  messageAtom,
  messageVisibleAtom,
  searchQueryAtom,
  searchResultsAtom,
  type MessageType,
} from "../state/atoms.ts";
import {
  executeCommandAtom,
  popOverlayAtom,
  dismissMessageAtom,
  updateSearchQueryAtom,
  moveSearchSelectionAtom,
  selectSearchResultAtom,
} from "../state/actions.ts";
import { getDisplayTitle } from "../domain/gcalEvent.ts";
import { getEventStart, formatTime } from "../domain/time.ts";
import { getAllCommands } from "../keybinds/registry.ts";
import { CommandPalette, getSelectedCommand } from "./CommandPalette.tsx";
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
  const [selectedIndex, setSelectedIndex] = useAtom(commandSelectedIndexAtom);
  const executeCommand = useSetAtom(executeCommandAtom);
  const popOverlay = useSetAtom(popOverlayAtom);

  // Get filtered commands count for navigation bounds
  const allCommands = useMemo(() => getAllCommands(), []);
  const filteredCommands = useMemo(() => {
    if (!input.trim()) return allCommands;
    // Only match against the first word (command name), not arguments
    const firstWord = input.toLowerCase().trim().split(/\s+/)[0];
    return allCommands.filter((cmd) => {
      const cmdName = cmd.name.split(" ")[0]; // Get command name without args placeholder
      return cmdName.toLowerCase().includes(firstWord) ||
        cmd.description.toLowerCase().includes(firstWord);
    });
  }, [allCommands, input]);

  // Reset selection when input changes
  const prevInputRef = React.useRef(input);
  useEffect(() => {
    if (prevInputRef.current !== input) {
      setSelectedIndex(0);
      prevInputRef.current = input;
    }
  }, [input, setSelectedIndex]);

  const selectCommand = useCallback(() => {
    const selected = getSelectedCommand(input, selectedIndex);
    if (selected) {
      setInput(selected.name.replace(/ <.*>$/, ""));
      setTimeout(() => executeCommand(), 0);
    } else {
      executeCommand();
    }
  }, [input, selectedIndex, setInput, executeCommand]);

  // Auto-fill the selected command into the input (Tab or Ctrl+Y)
  const autoFillCommand = useCallback(() => {
    const selected = getSelectedCommand(input, selectedIndex);
    if (selected) {
      // Get command name without the args placeholder, add space for args
      const cmdName = selected.name.replace(/ <.*>$/, "");
      setInput(cmdName + " ");
    }
  }, [input, selectedIndex, setInput]);

  const handleKeyPress = useCallback((key: { name: string; ctrl?: boolean; shift?: boolean; sequence?: string }) => {
    // Ctrl combinations via sequence
    const isCtrlP = key.sequence === "\x10";
    const isCtrlN = key.sequence === "\x0e";
    const isCtrlY = key.sequence === "\x19";

    if (key.name === "return") {
      selectCommand();
      return true;
    }
    if (key.name === "tab" || isCtrlY) {
      autoFillCommand();
      return true;
    }
    if (key.name === "escape") {
      popOverlay();
      return true;
    }
    if (key.name === "up" || isCtrlP) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return true;
    }
    if (key.name === "down" || isCtrlN) {
      setSelectedIndex((i) => Math.min(filteredCommands.length - 1, i + 1));
      return true;
    }
    return false;
  }, [selectCommand, autoFillCommand, popOverlay, setSelectedIndex, filteredCommands.length]);

  return (
    <FocusScope trap>
      <Box style={{ flexDirection: "row", flexGrow: 1, alignItems: "center" }}>
        <Text style={{ color: theme.accent.primary, bold: true }}>:</Text>
        <Input
          key="command-input"
          defaultValue=""
          placeholder="Type commands here"
          onChange={setInput}
          onKeyPress={handleKeyPress}
          autoFocus
          style={{
            flexGrow: 1,
            color: theme.text.primary,
          }}
        />
      </Box>
    </FocusScope>
  );
}

function SearchInput() {
  const query = useAtomValue(searchQueryAtom);
  const results = useAtomValue(searchResultsAtom);
  const updateQuery = useSetAtom(updateSearchQueryAtom);
  const moveSelection = useSetAtom(moveSearchSelectionAtom);
  const selectResult = useSetAtom(selectSearchResultAtom);
  const setFocus = useSetAtom(focusAtom);

  const handleKeyPress = useCallback((key: { name: string; ctrl?: boolean; shift?: boolean; sequence?: string }) => {
    const isCtrlP = key.sequence === "\x10";
    const isCtrlN = key.sequence === "\x0e";

    if (key.name === "escape") {
      setFocus("timeline");
      return true;
    }
    if (key.name === "return") {
      selectResult();
      return true;
    }
    if (key.name === "up" || isCtrlP) {
      moveSelection("up");
      return true;
    }
    if (key.name === "down" || isCtrlN) {
      moveSelection("down");
      return true;
    }
    return false;
  }, [setFocus, selectResult, moveSelection]);

  return (
    <FocusScope trap>
      <Box style={{ flexDirection: "row", flexGrow: 1, alignItems: "center" }}>
        <Text style={{ color: theme.accent.primary, bold: true }}>/</Text>
        <Input
          key="search-input"
          value={query}
          placeholder="Search events..."
          onChange={updateQuery}
          onKeyPress={handleKeyPress}
          autoFocus
          style={{
            flexGrow: 1,
            color: theme.text.primary,
          }}
        />
        <Text style={{ color: theme.text.dim }}>
          {results.length > 0 ? `${results.length} results` : ""}
        </Text>
      </Box>
    </FocusScope>
  );
}

// Get color for message type
function getMessageColor(type: MessageType): string {
  switch (type) {
    case "success":
      return theme.accent.success;
    case "warning":
      return theme.accent.warning;
    case "error":
      return theme.accent.error;
    case "progress":
      return theme.accent.primary;
    case "info":
    default:
      return theme.text.primary;
  }
}

// Get prefix icon for message type
function getMessagePrefix(type: MessageType): string {
  switch (type) {
    case "success":
      return "✓ ";
    case "warning":
      return "⚠ ";
    case "error":
      return "✗ ";
    case "progress":
      return "⋯ ";
    case "info":
    default:
      return "";
  }
}

function MessageDisplay() {
  const message = useAtomValue(messageAtom);
  const isVisible = useAtomValue(messageVisibleAtom);

  if (!message || !isVisible) {
    return null;
  }

  const color = getMessageColor(message.type);
  const prefix = getMessagePrefix(message.type);

  // Build progress indicator if present
  let progressText = "";
  if (message.progress) {
    const { current, total, phase } = message.progress;
    if (phase) {
      progressText = ` [${phase}]`;
    }
    if (current !== undefined && total !== undefined) {
      progressText = ` [${current}/${total}]`;
    } else if (current !== undefined) {
      progressText = ` [${current}]`;
    }
  }

  return (
    <Box style={{ flexDirection: "row", flexGrow: 1 }}>
      <Text style={{ color, bold: message.type === "error" }}>
        {prefix}{message.text}{progressText}
      </Text>
    </Box>
  );
}

function NextEvent() {
  const events = useAtomValue(dayEventsAtom);
  const tz = useAtomValue(timezoneAtom);
  const message = useAtomValue(messageAtom);
  const isMessageVisible = useAtomValue(messageVisibleAtom);

  // Show message instead of next event if there's one
  if (message && isMessageVisible) {
    return <MessageDisplay />;
  }

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
  const isSearchMode = focus === "search";

  return (
    <>
      {/* Command Palette (floats above status bar) */}
      {isCommandMode && (
        <Portal zIndex={40}>
          <CommandPalette />
        </Portal>
      )}

      <Box
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingX: 1,
        }}
      >
        {/* Left side: Command input, Search input, or next event */}
        <Box style={{ flexGrow: 1, flexShrink: 1 }}>
          {isCommandMode ? (
            <CommandInput />
          ) : isSearchMode ? (
            <SearchInput />
          ) : (
            <NextEvent />
          )}
        </Box>

        {/* Right side: Notifications + Clock */}
        <Box style={{ flexDirection: "row", gap: 2 }}>
          <Notifications />
          <Clock />
        </Box>
      </Box>
    </>
  );
}
