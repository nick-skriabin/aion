/**
 * Unified Loader component with custom braille animation
 */

import React from "react";
import { Box, Text, Spinner } from "@semos-labs/glyph";
import { theme } from "./theme.ts";

// Braille dots spinner frames
const LOADER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

interface LoaderProps {
  label?: string;
  inline?: boolean;
}

export function Loader({ label, inline = true }: LoaderProps) {
  if (inline) {
    return (
      <Box style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
        <Spinner
          frames={LOADER_FRAMES}
          intervalMs={80}
          label=""
          style={{ color: theme.accent.primary }}
        />
        {label && <Text style={{ color: theme.text.dim }}>{label}</Text>}
      </Box>
    );
  }

  return (
    <Box style={{ flexDirection: "column", alignItems: "center", gap: 1 }}>
      <Spinner
        frames={LOADER_FRAMES}
        intervalMs={80}
        label=""
        style={{ color: theme.accent.primary }}
      />
      {label && <Text style={{ color: theme.text.dim }}>{label}</Text>}
    </Box>
  );
}
