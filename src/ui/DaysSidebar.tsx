import React from "react";
import { Box, Text, ScrollView, FocusScope, useInput } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  daysListAtom,
  selectedDayIndexAtom,
  focusAtom,
} from "../state/atoms.ts";
import { toggleFocusAtom, confirmDaySelectionAtom, moveDaySelectionAtom } from "../state/actions.ts";
import { formatDayShort, isToday } from "../domain/time.ts";
import { theme } from "./theme.ts";

function DaysKeybinds() {
  const moveDaySelection = useSetAtom(moveDaySelectionAtom);
  const toggleFocus = useSetAtom(toggleFocusAtom);
  const confirmDaySelection = useSetAtom(confirmDaySelectionAtom);
  
  useInput((key) => {
    // Navigation
    if (key.name === "j" || key.name === "down") {
      moveDaySelection("down");
      return;
    }
    if (key.name === "k" || key.name === "up") {
      moveDaySelection("up");
      return;
    }
    
    // G - jump forward 7 days
    if (key.name === "g" && key.shift) {
      moveDaySelection("end");
      return;
    }
    
    // Select current day and focus timeline
    if (key.name === "return") {
      confirmDaySelection();
      return;
    }
    
    // Switch pane - h, l, or Tab all work
    if (key.name === "h" || key.name === "l" || key.name === "tab") {
      toggleFocus();
      return;
    }
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
