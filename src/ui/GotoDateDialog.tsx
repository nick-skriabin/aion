/**
 * Goto Date Dialog - quick navigation to a specific date
 * Supports natural language input like "tomorrow", "next friday", "march 15"
 */

import React, { useState, useMemo, useCallback } from "react";
import { Box, Text, Input, Keybind, Portal } from "@semos-labs/glyph";
import { useSetAtom } from "jotai";
import { DateTime } from "luxon";
import { popOverlayAtom } from "../state/actions.ts";
import { selectedDayAtom, viewAnchorDayAtom, focusAtom } from "../state/atoms.ts";
import { parseNaturalDate } from "../domain/naturalDate.ts";
import { theme } from "./theme.ts";

export function GotoDateDialog() {
  const [input, setInput] = useState("");
  const popOverlay = useSetAtom(popOverlayAtom);
  const setSelectedDay = useSetAtom(selectedDayAtom);
  const setViewAnchor = useSetAtom(viewAnchorDayAtom);
  const setFocus = useSetAtom(focusAtom);

  // Parse input and get preview
  const parsed = useMemo(() => {
    if (!input.trim()) return null;

    // Try natural language first (returns { date: DateTime, ... })
    const natural = parseNaturalDate(input);
    if (natural && natural.date.isValid) {
      return {
        date: natural.date,
        preview: natural.date.toFormat("cccc, MMMM d, yyyy"),
      };
    }

    // Try direct ISO date
    const iso = DateTime.fromISO(input);
    if (iso.isValid) {
      return {
        date: iso,
        preview: iso.toFormat("cccc, MMMM d, yyyy"),
      };
    }

    // Try common formats
    const formats = [
      "M/d/yyyy",
      "M/d/yy",
      "M/d",
      "MMM d",
      "MMM d yyyy",
      "MMMM d",
      "MMMM d yyyy",
      "d MMM",
      "d MMM yyyy",
    ];

    for (const fmt of formats) {
      const dt = DateTime.fromFormat(input, fmt);
      if (dt.isValid) {
        // If no year specified, use current year (or next if date has passed)
        let finalDate = dt;
        if (!input.match(/\d{4}/)) {
          const now = DateTime.now();
          finalDate = dt.set({ year: now.year });
          // If the date has passed this year, assume next year
          if (finalDate < now.startOf("day") && !input.toLowerCase().includes("last")) {
            finalDate = finalDate.plus({ years: 1 });
          }
        }
        return {
          date: finalDate,
          preview: finalDate.toFormat("cccc, MMMM d, yyyy"),
        };
      }
    }

    return null;
  }, [input]);

  const handleSubmit = useCallback(() => {
    if (parsed?.date) {
      const targetDay = parsed.date.startOf("day");
      setSelectedDay(targetDay);
      setViewAnchor(targetDay);
      setFocus("timeline");
    }
    popOverlay();
  }, [parsed, setSelectedDay, setViewAnchor, setFocus, popOverlay]);

  const handleCancel = useCallback(() => {
    popOverlay();
  }, [popOverlay]);

  const handleInputKeyPress = useCallback((key: { name: string }) => {
    if (key.name === "return") {
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <Portal zIndex={100}>
      <Keybind keypress="escape" onPress={handleCancel} />
      <Box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Box
          style={{
            width: 45,
            flexDirection: "column",
            bg: theme.modal.background,
            paddingX: 1,
          }}
        >
          {/* Header */}
          <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ bold: true, color: theme.accent.primary }}>Go to Date</Text>
            <Text style={{ color: theme.text.dim }}>esc</Text>
          </Box>

          {/* Input */}
          <Box>
            <Input
              value={input}
              onChange={setInput}
              placeholder="tomorrow, next friday, mar 15..."
              autoFocus
              onKeyPress={handleInputKeyPress}
              style={{
                bg: theme.input.background,
              }}
            />
          </Box>

          {/* Preview */}
          <Box style={{ minHeight: 1 }}>
            {input.trim() ? (
              parsed ? (
                <Text style={{ color: theme.accent.success }}>
                  → {parsed.preview}
                </Text>
              ) : (
                <Text style={{ color: theme.text.dim, dim: true }}>
                  Could not parse date
                </Text>
              )
            ) : null}
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
