/**
 * WeekdayPicker - A 7x1 box for selecting days of the week
 * Navigate with left/right arrows, toggle with space
 */

import React, { useState } from "react";
import { Box, Text, useFocusable, type Color } from "@semos-labs/glyph";
import { theme } from "./theme.ts";
import { type Weekday } from "../domain/recurrence.ts";

const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: "MO", label: "M" },
  { key: "TU", label: "T" },
  { key: "WE", label: "W" },
  { key: "TH", label: "T" },
  { key: "FR", label: "F" },
  { key: "SA", label: "S" },
  { key: "SU", label: "S" },
];

interface WeekdayPickerProps {
  value: Weekday[];
  onChange: (value: Weekday[]) => void;
}

export function WeekdayPicker({ value, onChange }: WeekdayPickerProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const toggleDay = () => {
    const dayItem = WEEKDAYS[focusedIndex];
    if (!dayItem) return;
    const day = dayItem.key;
    const isSelected = value.includes(day);
    if (isSelected) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day]);
    }
  };

  const { ref, isFocused } = useFocusable({
    onKeyPress: (key) => {
      if (key.name === "left" || key.name === "h") {
        setFocusedIndex((i) => Math.max(0, i - 1));
        return true;
      }
      if (key.name === "right" || key.name === "l") {
        setFocusedIndex((i) => Math.min(WEEKDAYS.length - 1, i + 1));
        return true;
      }
      // Try multiple ways to detect space/enter
      if (key.name === "space" || key.name === "return") {
        toggleDay();
        return true;
      }
      return false;
    },
  });

  return (
    <Box
      ref={ref}
      focusable
      style={{
        flexDirection: "row",
        gap: 0,
      }}
    >
      {WEEKDAYS.map((day, index) => {
        const isSelected = value.includes(day.key);
        const isCellFocused = isFocused && index === focusedIndex;

        let bg: Color | undefined;
        let color: Color;

        if (isSelected) {
          color = theme.accent.primary; // green
          bg = isCellFocused ? "#2a2a2a" as const : undefined;
        } else {
          color = theme.text.dim; // gray
          bg = isCellFocused ? "#2a2a2a" as const : undefined;
        }

        return (
          <Box
            key={day.key}
            style={{
              width: 3,
              height: 1,
              justifyContent: "center",
              alignItems: "center",
              bg,
            }}
          >
            <Text
              style={{
                color,
                bold: isSelected,
              }}
            >
              {day.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
