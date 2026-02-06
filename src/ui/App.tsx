import React, { useEffect, useState } from "react";
import { Box, Text, useApp, Spinner, Keybind } from "@nick-skriabin/glyph";
import { Provider, useAtomValue, useSetAtom } from "jotai";
import { DayView } from "./DayView.tsx";
import { DetailsPanel } from "./DetailsPanel.tsx";
import { EventDialog } from "./EventDialog.tsx";
import { ConfirmModal } from "./ConfirmModal.tsx";
import { CommandBar } from "./CommandBar.tsx";
import { KeyboardHandler } from "./KeyboardHandler.tsx";
import { topOverlayAtom } from "../state/atoms.ts";
import { loadEventsAtom } from "../state/actions.ts";
import { initDb } from "../db/db.ts";
import { eventsRepo } from "../db/eventsRepo.ts";
import { generateSeedData } from "../domain/mock.ts";
import { loadConfig } from "../config/config.ts";
import { theme } from "./theme.ts";

function AppContent() {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const topOverlay = useAtomValue(topOverlayAtom);
  const loadEvents = useSetAtom(loadEventsAtom);
  
  // Initialize database and load events
  useEffect(() => {
    async function init() {
      try {
        // Load config first
        await loadConfig();
        
        // Initialize database
        await initDb();
        
        // Seed if empty
        const isEmpty = await eventsRepo.isEmpty();
        if (isEmpty) {
          const seedData = generateSeedData();
          await eventsRepo.seed(seedData);
        }
        
        // Load events into state
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
          bg: theme.bg.primary,
        }}
      >
        <Spinner label="Loading Aion..." style={{ color: theme.accent.primary }} />
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
          bg: theme.bg.primary,
        }}
      >
        <Text style={{ color: theme.accent.error }}>Error: {error}</Text>
        <Text style={{ color: theme.text.dim }}>Press Ctrl+C to exit</Text>
      </Box>
    );
  }
  
  return (
    <Box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        bg: theme.bg.primary,
        padding: 1,
      }}
    >
      {/* Header */}
      <Box
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingBottom: 1,
        }}
      >
        <Text style={{ bold: true, color: theme.accent.primary }}>
          🔮 Aion
        </Text>
        <Text style={{ color: theme.text.dim }}>
          Tab:switch │ q:quit
        </Text>
      </Box>
      
      {/* Main content */}
      <DayView />
      
      {/* Keyboard handler */}
      <KeyboardHandler />
      
      {/* Quit keybind */}
      <Keybind keypress="q" onPress={() => exit()} />
      <Keybind keypress="ctrl+c" onPress={() => exit()} />
      
      {/* Overlays */}
      {topOverlay?.kind === "details" && <DetailsPanel />}
      {topOverlay?.kind === "dialog" && <EventDialog />}
      {topOverlay?.kind === "confirm" && <ConfirmModal />}
      {topOverlay?.kind === "command" && <CommandBar />}
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
