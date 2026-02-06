import React, { useEffect, useState } from "react";
import { Box, Text, useApp, Spinner, Keybind } from "@nick-skriabin/glyph";
import { Provider, useAtomValue, useSetAtom } from "jotai";
import { DayView } from "./DayView.tsx";
import { DetailsPanel } from "./DetailsPanel.tsx";
import { EventDialog } from "./EventDialog.tsx";
import { ConfirmModal } from "./ConfirmModal.tsx";
import { CommandBar } from "./CommandBar.tsx";
import { KeyboardHandler } from "./KeyboardHandler.tsx";
import { HelpDialog } from "./HelpDialog.tsx";
import { overlayStackAtom } from "../state/atoms.ts";
import { loadEventsAtom } from "../state/actions.ts";
import { initDb } from "../db/db.ts";
import { eventsRepo } from "../db/eventsRepo.ts";
import { generateSeedData } from "../domain/mock.ts";
import { loadConfig } from "../config/config.ts";
import { theme } from "./theme.ts";

// Render overlays from stack - allows multiple overlays to be visible
function OverlayRenderer() {
  const overlayStack = useAtomValue(overlayStackAtom);
  
  return (
    <>
      {overlayStack.map((overlay, index) => {
        switch (overlay.kind) {
          case "details":
            return <DetailsPanel key={`details-${index}`} />;
          case "dialog":
            return <EventDialog key={`dialog-${index}`} />;
          case "confirm":
            return <ConfirmModal key={`confirm-${index}`} />;
          case "command":
            return <CommandBar key={`command-${index}`} />;
          case "help":
            return <HelpDialog key={`help-${index}`} />;
          default:
            return null;
        }
      })}
    </>
  );
}

function AppContent() {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadEvents = useSetAtom(loadEventsAtom);
  
  // Initialize database and load events
  useEffect(() => {
    async function init() {
      try {
        await loadConfig();
        await initDb();
        
        const isEmpty = await eventsRepo.isEmpty();
        if (isEmpty) {
          const seedData = generateSeedData();
          await eventsRepo.seed(seedData);
        }
        
        await loadEvents();
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize");
        setLoading(false);
      }
    }
    
    init();
  }, [loadEvents]);
  
  if (loading) {
    return (
      <Box
        style={{
          width: "100%",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Spinner label="Loading..." style={{ color: theme.accent.primary }} />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box
        style={{
          width: "100%",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: theme.accent.error }}>Error: {error}</Text>
        <Text style={{ color: theme.text.dim }}>Press q to exit</Text>
      </Box>
    );
  }
  
  return (
    <Box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        padding: 1,
      }}
    >
      {/* Header */}
      <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ bold: true, color: theme.accent.primary }}>
          Aion
        </Text>
        <Text style={{ color: theme.text.dim }}>
          ?:help  q:quit
        </Text>
      </Box>
      
      {/* Main content */}
      <DayView />
      
      {/* Keyboard handler */}
      <KeyboardHandler />
      
      {/* Quit keybind */}
      <Keybind keypress="q" onPress={() => exit()} />
      <Keybind keypress="ctrl+c" onPress={() => exit()} />
      
      {/* Overlays - render based on stack, not just top */}
      <OverlayRenderer />
    </Box>
  );
}

export function App() {
  return (
    <Provider>
      <AppContent />
    </Provider>
  );
}
