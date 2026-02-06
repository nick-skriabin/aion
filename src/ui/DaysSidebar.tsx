import React, { useMemo, useRef } from "react";
import { Box, Text, ScrollView, FocusScope, useInput } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  daysListAtom,
  selectedDayIndexAtom,
  focusAtom,
} from "../state/atoms.ts";
import { toggleFocusAtom, confirmDaySelectionAtom, moveDaySelectionAtom, openNotificationsAtom, newEventAtom } from "../state/actions.ts";
import { formatDayShort, isToday } from "../domain/time.ts";
import { handleKeyEvent } from "../keybinds/useKeybinds.tsx";
import { theme } from "./theme.ts";

function DaysKeybinds() {
  const moveDaySelection = useSetAtom(moveDaySelectionAtom);
  const toggleFocus = useSetAtom(toggleFocusAtom);
  const confirmDaySelection = useSetAtom(confirmDaySelectionAtom);
  const openNotifications = useSetAtom(openNotificationsAtom);
  const newEvent = useSetAtom(newEventAtom);
  
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
  
  // Global keybind handlers (need to be handled here due to FocusScope trap)
  const globalHandlers = useMemo(() => ({
    openNotifications: () => openNotifications(),
    newEvent: () => newEvent(),
  }), [openNotifications, newEvent]);
  
  useInput((key) => {
    // Handle global keybinds first (FocusScope trap would otherwise block them)
    if (handleKeyEvent("global", key, globalHandlers)) return;
    
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
  const isFocused = focus === "days";
  
  return (
    <ScrollView 
      style={{ flexGrow: 1 }}
      scrollOffset={Math.max(0, selectedIndex - 5)}
    >
      {days.map((day, index) => {
        const isCurrentDay = isToday(day);
        const isSelected = index === selectedIndex;
        
        return (
          <Box key={day.toISO()}>
            <Text
              style={{
                color: isSelected && isFocused
                  ? theme.selection.indicator
                  : isCurrentDay
                  ? theme.accent.success
                  : isSelected
                  ? theme.text.primary
                  : theme.text.dim,
                bold: isSelected && isFocused,
              }}
            >
              {isSelected && isFocused ? "▸ " : "  "}
              {formatDayShort(day)}
              {isCurrentDay && !isSelected ? " •" : ""}
            </Text>
          </Box>
        );
      })}
    </ScrollView>
  );
}

export function DaysSidebar() {
  const focus = useAtomValue(focusAtom);
  const isFocused = focus === "days";
  
  return (
    <Box
      style={{
        width: 12,
        height: "100%",
        flexDirection: "column",
      }}
    >
      <Text style={{ color: isFocused ? theme.accent.primary : theme.text.dim, bold: isFocused }}>
        {isFocused ? "▶ Days" : "  Days"}
      </Text>
      
      {isFocused && (
        <FocusScope trap>
          <DaysKeybinds />
        </FocusScope>
      )}
      
      <DaysList />
    </Box>
  );
}
