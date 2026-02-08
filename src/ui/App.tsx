import React, { useEffect, useState } from "react";
import { Box, Text, useApp, Spinner, Keybind } from "@nick-skriabin/glyph";
import { Provider, useAtomValue, useSetAtom } from "jotai";
import { DayView } from "./DayView.tsx";
import { DetailsPanel } from "./DetailsPanel.tsx";
import { EventDialog } from "./EventDialog.tsx";
import { ProposeTimeDialog } from "./ProposeTimeDialog.tsx";
import { ConfirmModal } from "./ConfirmModal.tsx";
import { KeyboardHandler } from "./KeyboardHandler.tsx";
import { HelpDialog } from "./HelpDialog.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { NotificationsPanel } from "./NotificationsPanel.tsx";
import { GotoDateDialog } from "./GotoDateDialog.tsx";
import { overlayStackAtom, isLoggedInAtom, enabledCalendarsAtom, enabledCalendarsLoadedAtom } from "../state/atoms.ts";
import { loadEventsAtom, checkAuthStatusAtom } from "../state/actions.ts";
import { getDisabledCalendars } from "../config/calendarSettings.ts";
import { initDb } from "../db/db.ts";
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
          case "proposeTime":
            return <ProposeTimeDialog key={`proposeTime-${index}`} />;
          case "confirm":
            return <ConfirmModal key={`confirm-${index}`} />;
          case "help":
            return <HelpDialog key={`help-${index}`} />;
          case "notifications":
            return <NotificationsPanel key={`notifications-${index}`} />;
          case "goto":
            return <GotoDateDialog key={`goto-${index}`} />;
          // "command" is now handled inline by StatusBar
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
  const checkAuthStatus = useSetAtom(checkAuthStatusAtom);
  const setDisabledCalendars = useSetAtom(enabledCalendarsAtom);
  const setCalendarsLoaded = useSetAtom(enabledCalendarsLoadedAtom);
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  
  // Initialize database and load events
  useEffect(() => {
    async function init() {
      try {
        await loadConfig();
        await initDb();
        
        // Load calendar settings from disk
        const disabled = await getDisabledCalendars();
        setDisabledCalendars(disabled);
        setCalendarsLoaded(true);
        
        // Check auth status and start background sync if logged in
        await checkAuthStatus();
        
        await loadEvents();
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize");
        setLoading(false);
      }
    }
    
    init();
  }, [loadEvents, checkAuthStatus, setDisabledCalendars, setCalendarsLoaded]);
  
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
      }}
    >
      {/* Header */}
      <Box style={{ flexDirection: "row", justifyContent: "space-between", paddingX: 1 }}>
        <Box style={{ flexDirection: "row", gap: 2 }}>
          <Text style={{ bold: true, color: theme.accent.primary }}>
            Aion
          </Text>
          {isLoggedIn ? (
            <Text style={{ color: theme.accent.success }}>●</Text>
          ) : (
            <Text style={{ color: theme.text.dim }}>○</Text>
          )}
        </Box>
        <Text style={{ color: theme.text.dim }}>
          C-g:goto  C:calendars  ?:help
        </Text>
      </Box>
      
      {/* Main content */}
      <Box style={{ flexGrow: 1, flexShrink: 1, paddingX: 1, clip: true }}>
        <DayView />
      </Box>
      
      {/* Status bar */}
      <StatusBar />
      
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
