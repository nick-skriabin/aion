import React, { useMemo, useEffect, useRef } from "react";
import { Box } from "@semos-labs/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { CalendarsSidebar } from "./CalendarsSidebar.tsx";
import { DaysSidebar } from "./DaysSidebar.tsx";
import { TimelineColumn } from "./TimelineColumn.tsx";
import { 
  columnCountAtom, 
  selectedDayAtom, 
  filteredEventsArrayAtom,
  timezoneAtom,
  allDayExpandedAtom,
  sharedScrollOffsetAtom,
} from "../state/atoms.ts";
import { layoutDay } from "../domain/layout.ts";

const MINUTES_PER_SLOT = 15;

export function DayView() {
  const columnCount = useAtomValue(columnCountAtom);
  const selectedDay = useAtomValue(selectedDayAtom);
  const allEvents = useAtomValue(filteredEventsArrayAtom);
  const tz = useAtomValue(timezoneAtom);
  const allDayExpanded = useAtomValue(allDayExpandedAtom);
  const setSharedScrollOffset = useSetAtom(sharedScrollOffsetAtom);

  // Generate days for each column (selected day + following days)
  const columnDays = Array.from({ length: columnCount }, (_, i) =>
    selectedDay.plus({ days: i })
  );

  // Compute layouts for all visible days (reused for multiple derived values)
  const columnLayouts = useMemo(() =>
    columnDays.map(day => layoutDay(allEvents, day, tz)),
    [allEvents, columnDays, tz]
  );

  // Compute max all-day count across all visible days
  const maxAllDayCount = useMemo(() => {
    let max = 0;
    for (const layout of columnLayouts) {
      max = Math.max(max, layout.allDayEvents.length);
    }
    return max;
  }, [columnLayouts]);

  // Find the earliest timed event (by time of day) across all visible columns.
  // All-day events are excluded — they're pinned at the top.
  const earliestTimedMinutes = useMemo(() => {
    let earliest = Infinity;
    for (const layout of columnLayouts) {
      for (const timedEvent of layout.timedEvents) {
        if (timedEvent.startMinutes < earliest) {
          earliest = timedEvent.startMinutes;
        }
      }
    }
    return earliest === Infinity ? null : earliest;
  }, [columnLayouts]);

  // When the visible date range changes (horizontal navigation),
  // scroll the timeline vertically to show the earliest timed event
  // across all visible columns so events are never cut off.
  const prevSelectedDayRef = useRef(selectedDay.toISODate());
  useEffect(() => {
    const currentKey = selectedDay.toISODate();
    if (prevSelectedDayRef.current === currentKey) return;
    prevSelectedDayRef.current = currentKey;

    if (earliestTimedMinutes === null) return; // no timed events visible

    const earliestSlot = Math.floor(earliestTimedMinutes / MINUTES_PER_SLOT);
    // Leave a small gap above so the event isn't flush to the top
    const PADDING_SLOTS = 2;
    setSharedScrollOffset(Math.max(0, earliestSlot - PADDING_SLOTS));
  }, [selectedDay, earliestTimedMinutes, setSharedScrollOffset]);

  // Calculate all-day section height
  const COLLAPSE_THRESHOLD = 2;
  const shouldCollapseAllDay = maxAllDayCount > COLLAPSE_THRESHOLD && !allDayExpanded;
  const allDayLines = maxAllDayCount === 0 ? 0
    : shouldCollapseAllDay ? COLLAPSE_THRESHOLD + 2
      : maxAllDayCount + (maxAllDayCount > COLLAPSE_THRESHOLD ? 2 : 1);

  return (
    <Box
      style={{
        flexDirection: "row",
        flexGrow: 1,
        height: "100%",
        clip: true,
      }}
    >
      <CalendarsSidebar />
      <DaysSidebar />
      
      {/* Render timeline columns */}
      {columnDays.map((day, index) => (
        <TimelineColumn
          key={day.toISODate()}
          day={day}
          columnIndex={index}
          maxAllDayCount={maxAllDayCount}
          allDayLines={allDayLines}
          showHourLabels={index === 0}
        />
      ))}
    </Box>
  );
}
