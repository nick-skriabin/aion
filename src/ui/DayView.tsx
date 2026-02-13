import React, { useMemo } from "react";
import { Box } from "@semos-labs/glyph";
import { useAtomValue } from "jotai";
import { CalendarsSidebar } from "./CalendarsSidebar.tsx";
import { DaysSidebar } from "./DaysSidebar.tsx";
import { TimelineColumn } from "./TimelineColumn.tsx";
import { 
  columnCountAtom, 
  selectedDayAtom, 
  filteredEventsArrayAtom,
  timezoneAtom,
  allDayExpandedAtom,
} from "../state/atoms.ts";
import { layoutDay } from "../domain/layout.ts";

export function DayView() {
  const columnCount = useAtomValue(columnCountAtom);
  const selectedDay = useAtomValue(selectedDayAtom);
  const allEvents = useAtomValue(filteredEventsArrayAtom);
  const tz = useAtomValue(timezoneAtom);
  const allDayExpanded = useAtomValue(allDayExpandedAtom);

  // Generate days for each column (selected day + following days)
  const columnDays = Array.from({ length: columnCount }, (_, i) =>
    selectedDay.plus({ days: i })
  );

  // Compute max all-day count across all visible days
  const maxAllDayCount = useMemo(() => {
    let max = 0;
    for (const day of columnDays) {
      const dayLayout = layoutDay(allEvents, day, tz);
      max = Math.max(max, dayLayout.allDayEvents.length);
    }
    return max;
  }, [allEvents, columnDays, tz]);

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
