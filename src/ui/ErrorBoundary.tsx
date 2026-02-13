import React from "react";
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from "react-error-boundary";
import { Box, Text } from "@semos-labs/glyph";
import { appLogger } from "../lib/logger.ts";

function ErrorFallback({ error }: FallbackProps) {
  const err = error as Error
  return (
    <Box style={{ flexDirection: "column", padding: 1 }}>
      <Text style={{ color: "redBright", bold: true }}>
        ⚠ Application Error
      </Text>
      <Text style={{ color: "red" }}>
        {err?.message || "Unknown error"}
      </Text>
      {err?.stack && (
        <Box style={{ paddingTop: 1 }}>
          <Text style={{ color: "white", dim: true }}>
            {err.stack.split("\n").slice(0, 8).join("\n")}
          </Text>
        </Box>
      )}
      <Box style={{ paddingTop: 1 }}>
        <Text style={{ color: "yellow" }}>
          Press Ctrl+C to exit.
        </Text>
      </Box>
    </Box>
  );
}

function logError(error: Error, info: { componentStack?: string | null }) {
  // Log to file
  appLogger.error("React Error Boundary caught error:", {
    message: error.message,
    stack: error.stack,
    componentStack: info.componentStack,
  });

  // Also log to stderr
  console.error("\n=== APPLICATION ERROR ===");
  console.error(error.message);
  console.error(error.stack);
  if (info.componentStack) {
    console.error("\nComponent Stack:");
    console.error(info.componentStack);
  }
  console.error("=========================\n");
}

export function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary FallbackComponent={ErrorFallback} >
      {children}
    </ReactErrorBoundary>
  );
}
