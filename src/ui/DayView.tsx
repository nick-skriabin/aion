import React from "react";
import { Box } from "@nick-skriabin/glyph";
import { DaysSidebar } from "./DaysSidebar.tsx";
import { Timeline } from "./Timeline.tsx";

export function DayView() {
  return (
    <Box
      style={{
        flexDirection: "row",
        flexGrow: 1,
        height: "100%",
        gap: 1,
        clip: true,
      }}
    >
      <DaysSidebar />
      <Timeline />
    </Box>
  );
}
