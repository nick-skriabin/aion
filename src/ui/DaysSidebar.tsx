import React from "react";
import { Box, Text, ScrollView } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  daysListAtom,
  selectedDayAtom,
  focusAtom,
  selectedDayIndexAtom,
} from "../state/atoms.ts";
import { selectDayAtom } from "../state/actions.ts";
import { formatDayShort, isToday } from "../domain/time.ts";
import { theme, styles } from "./theme.ts";

export function DaysSidebar() {
  const days = useAtomValue(daysListAtom);
  const selectedDay = useAtomValue(selectedDayAtom);
  const selectedIndex = useAtomValue(selectedDayIndexAtom);
  const focus = useAtomValue(focusAtom);
  
  const isFocused = focus === "days";
  
  return (
    <Box
      style={{
        width: 14,
        height: "100%",
        ...(isFocused ? styles.panelFocused : styles.panel),
        flexDirection: "column",
        padding: 0,
      }}
    >
      <Box style={{ paddingX: 1, paddingY: 0 }}>
        <Text style={{ ...styles.header, color: theme.accent.primary }}>
          Days
        </Text>
      </Box>
      
      <ScrollView 
        style={{ flexGrow: 1 }}
        scrollOffset={Math.max(0, selectedIndex - 5)}
      >
        {days.map((day, index) => {
          const isCurrentDay = isToday(day);
          const isSelected = index === selectedIndex;
          
          return (
            <Box
              key={day.toISO()}
              style={{
                paddingX: 1,
                bg: isSelected && isFocused ? theme.bg.selected : undefined,
              }}
            >
              <Text
                style={{
                  color: isCurrentDay
                    ? theme.accent.success
                    : isSelected
                    ? theme.text.primary
                    : theme.text.secondary,
                  bold: isCurrentDay || isSelected,
                }}
              >
                {isCurrentDay ? "▸ " : "  "}
                {formatDayShort(day)}
              </Text>
            </Box>
          );
        })}
      </ScrollView>
    </Box>
  );
}
