/**
 * Search Results Panel - displays search results grouped by date
 * Rendered inline below the status bar when search is active.
 * 
 * Each row uses explicit height: 1 to avoid spacing issues.
 */

import React, { useMemo } from "react";
import { Box, Text } from "@nick-skriabin/glyph";
import { useAtomValue } from "jotai";
import { DateTime } from "luxon";
import {
  searchResultsAtom,
  searchSelectedIndexAtom,
  focusAtom,
  calendarColorMapAtom,
  getCalendarColor,
} from "../state/atoms.ts";
import { getDisplayTitle } from "../domain/gcalEvent.ts";
import { formatTime, getEventStart } from "../domain/time.ts";
import { theme } from "./theme.ts";
import type { GCalEvent } from "../domain/gcalEvent.ts";

const PANEL_HEIGHT = 12;
const LIST_HEIGHT = PANEL_HEIGHT - 1; // -1 for header

// Flat list item - either a date header or an event
type ListItem =
  | { type: "header"; dateLabel: string }
  | { type: "event"; event: GCalEvent; eventIndex: number };

function formatDateLabel(date: DateTime): string {
  const today = DateTime.now().startOf("day");
  const tomorrow = today.plus({ days: 1 });
  const yesterday = today.minus({ days: 1 });

  if (date.hasSame(today, "day")) {
    return "Today";
  } else if (date.hasSame(tomorrow, "day")) {
    return "Tomorrow";
  } else if (date.hasSame(yesterday, "day")) {
    return "Yesterday";
  } else {
    return date.toFormat("EEEE, MMM d");
  }
}

function buildFlatList(events: GCalEvent[]): { items: ListItem[]; eventIndexMap: Map<number, number> } {
  const items: ListItem[] = [];
  const eventIndexMap = new Map<number, number>();

  let lastDateKey = "";

  events.forEach((event, index) => {
    const start = getEventStart(event);
    const dateKey = start.toISODate() || "";

    if (dateKey !== lastDateKey) {
      const dateLabel = formatDateLabel(start.startOf("day"));
      items.push({ type: "header", dateLabel });
      lastDateKey = dateKey;
    }

    eventIndexMap.set(index, items.length);
    items.push({ type: "event", event, eventIndex: index });
  });

  return { items, eventIndexMap };
}

export function SearchView() {
  const focus = useAtomValue(focusAtom);
  const results = useAtomValue(searchResultsAtom);
  const selectedIndex = useAtomValue(searchSelectedIndexAtom);
  const calendarColorMap = useAtomValue(calendarColorMapAtom);

  // Build flat list with headers
  const { items, eventIndexMap } = useMemo(() => buildFlatList(results), [results]);
  const selectedFlatIndex = eventIndexMap.get(selectedIndex) ?? 0;

  // Calculate visible window - only scroll when items exceed list height
  const needsScrolling = items.length > LIST_HEIGHT;
  const windowStart = needsScrolling ? Math.max(0, selectedFlatIndex - 3) : 0;
  const windowEnd = windowStart + LIST_HEIGHT;
  const visibleItems = needsScrolling ? items.slice(windowStart, windowEnd) : items;

  // Don't render if not in search mode or no results
  if (focus !== "search" || results.length === 0) {
    return null;
  }

  return (
    <Box
      style={{
        flexDirection: "column",
        paddingX: 1,
        borderTop: "single",
        borderColor: theme.text.dim,
      }}
    >
      {/* List with Box-based layout, each row has explicit height: 1 */}
      <Box style={{ flexDirection: "column", height: LIST_HEIGHT, clip: true }}>
        {visibleItems.map((item, i) => {
          if (item.type === "header") {
            return (
              <Box key={`h-${i}`} style={{ height: 1, flexShrink: 0 }}>
                <Text style={{ color: theme.text.dim }}>
                  {item.dateLabel}
                </Text>
              </Box>
            );
          } else {
            const { event, eventIndex } = item;
            const isSelected = eventIndex === selectedIndex;
            const start = getEventStart(event);
            const timeStr = event.start?.date ? "all-day" : formatTime(start);
            const title = getDisplayTitle(event);
            const eventColor = getCalendarColor(event.accountEmail, event.calendarId, calendarColorMap);
            const line = `${timeStr.padEnd(8)}${isSelected ? "▸ " : "  "}${title}`;

            return (
              <Box
                key={`e-${i}`}
                style={{
                  height: 1,
                  flexShrink: 0,
                  bg: isSelected ? theme.selection.background : undefined,
                }}
              >
                <Text
                  style={{
                    color: isSelected ? theme.selection.text : eventColor,
                    bold: isSelected,
                  }}
                >
                  {line}
                </Text>
              </Box>
            );
          }
        })}
      </Box>
    </Box>
  );
}
