import React, { useRef, useEffect, useMemo } from "react";
import { Box, Text, useInput, useApp } from "@semos-labs/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  daysListAtom,
  selectedDayIndexAtom,
  focusAtom,
  sidebarHeightAtom,
  columnCountAtom,
} from "../state/atoms.ts";
import { toggleFocusAtom, confirmDaySelectionAtom, moveDaySelectionAtom, openNotificationsAtom, newEventAtom, toggleAllDayExpandedAtom, toggleCalendarSidebarAtom, openGotoDialogAtom, openMeetWithDialogAtom, toggleColumnsAtom } from "../state/actions.ts";
import { formatDayShort, isToday } from "../domain/time.ts";
import { handleKeyEvent } from "../keybinds/useKeybinds.tsx";
import { theme } from "./theme.ts";

function DaysKeybinds() {
  const moveDaySelection = useSetAtom(moveDaySelectionAtom);
  const toggleFocus = useSetAtom(toggleFocusAtom);
  const confirmDaySelection = useSetAtom(confirmDaySelectionAtom);
  const openNotifications = useSetAtom(openNotificationsAtom);
  const newEvent = useSetAtom(newEventAtom);
  const toggleAllDayExpanded = useSetAtom(toggleAllDayExpandedAtom);
  const toggleCalendarSidebar = useSetAtom(toggleCalendarSidebarAtom);
  const openGotoDialog = useSetAtom(openGotoDialogAtom);
  const openMeetWithDialog = useSetAtom(openMeetWithDialogAtom);
  const toggleColumns = useSetAtom(toggleColumnsAtom);

  const lastKeyRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  const handlers = useMemo(() => ({
    nextDay: () => moveDaySelection("down"),
    prevDay: () => moveDaySelection("up"),
    firstDay: () => moveDaySelection("start"),
    lastDay: () => moveDaySelection("end"),
    confirmDay: () => confirmDaySelection(),
    toggleFocus: () => toggleFocus(),
  }), [moveDaySelection, confirmDaySelection, toggleFocus]);

  // Global keybind handlers
  const globalHandlers = useMemo(() => ({
    openNotifications: () => openNotifications(),
    newEvent: () => newEvent(),
    toggleAllDay: () => toggleAllDayExpanded(),
    toggleCalendars: () => toggleCalendarSidebar(),
    openGoto: () => openGotoDialog(),
    openMeetWith: () => openMeetWithDialog(),
    toggleColumns: () => toggleColumns(),
  }), [openNotifications, newEvent, toggleAllDayExpanded, toggleCalendarSidebar, openGotoDialog, openMeetWithDialog, toggleColumns]);

  useInput((key) => {
    // Handle global keybinds first
    if (handleKeyEvent("global", key, globalHandlers)) return;

    // Explicit Tab handling for focus switching
    if (key.name === "tab") {
      handlers.toggleFocus();
      return;
    }

    // Handle double-tap 'g' for first day (gg)
    if (key.name === "g" && !key.shift) {
      const now = Date.now();
      if (lastKeyRef.current === "g" && now - lastKeyTimeRef.current < 500) {
        handlers.firstDay();
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
    handleKeyEvent("days", key, handlers);
  });

  return null;
}

function DaysList() {
  const days = useAtomValue(daysListAtom);
  const selectedIndex = useAtomValue(selectedDayIndexAtom);
  const focus = useAtomValue(focusAtom);
  const columnCount = useAtomValue(columnCountAtom);
  const isFocused = focus === "days";

  // Days list is already sized to fit available height via sidebarHeightAtom
  // The anchor shifts as selection moves, keeping selection in view
  return (
    <Box style={{ flexGrow: 1, clip: true }} >
      {days.map((day, index) => {
        const isCurrentDay = isToday(day);
        const isSelected = index === selectedIndex;
        const isWeekend = day.weekday === 6 || day.weekday === 7; // Saturday or Sunday

        // Check if this day is part of the visible group (selected day + following days)
        const isInVisibleGroup = columnCount > 1 &&
          index >= selectedIndex &&
          index < selectedIndex + columnCount;

        // Determine position within the group for border styling
        const isGroupStart = isInVisibleGroup && index === selectedIndex;
        const isGroupEnd = isInVisibleGroup && index === selectedIndex + columnCount - 1;
        const isGroupMiddle = isInVisibleGroup && !isGroupStart && !isGroupEnd;

        // Determine text color based on state
        const getTextColor = () => {
          if (isSelected && isFocused) return theme.selection.text;
          if (isCurrentDay) return theme.accent.success;
          if (isSelected) return theme.text.primary;
          if (isInVisibleGroup && !isSelected) return theme.text.primary;
          if (isWeekend) return theme.text.weekend;
          return theme.text.dim;
        };

        // Border character for trio grouping
        const getBorderChar = () => {
          if (!isInVisibleGroup || columnCount === 1) return "  ";
          if (isGroupStart) return "┌ ";
          if (isGroupEnd) return "└ ";
          return "│ ";
        };

        return (
          <Box key={day.toISO()} style={{ flexDirection: "row" }}>
            {/* Group border indicator */}
            <Text style={{ color: isInVisibleGroup ? theme.accent.primary : theme.text.dim, dim: !isInVisibleGroup }}>
              {getBorderChar()}
            </Text>
            <Text
              style={{
                color: getTextColor(),
                bold: isSelected && isFocused,
              }}
            >
              {isSelected && isFocused ? "▸" : " "}
              {formatDayShort(day)}
              {isCurrentDay && !isSelected ? " •" : ""}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

export function DaysSidebar() {
  const { rows: terminalHeight } = useApp();
  const focus = useAtomValue(focusAtom);
  const isFocused = focus === "days";
  const setSidebarHeight = useSetAtom(sidebarHeightAtom);

  // Calculate available height for days list
  // Total height minus: header (1) + app header (1) + status bar (1) + sidebar header (1)
  const availableHeight = Math.max(1, terminalHeight - 4);

  // Update the sidebar height atom so daysListAtom can use it
  useEffect(() => {
    setSidebarHeight(availableHeight);
  }, [availableHeight, setSidebarHeight]);

  return (
    <Box
      style={{
        width: 12,
        height: "100%",
        flexDirection: "column",
        clip: true,
      }}
    >
      <Text style={{ color: isFocused ? theme.accent.primary : theme.text.dim, bold: isFocused }}>
        {isFocused ? "▶ Days" : "  Days"}
      </Text>

      {isFocused && <DaysKeybinds />}

      <DaysList />
    </Box>
  );
}
