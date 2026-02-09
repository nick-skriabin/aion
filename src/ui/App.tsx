import React, { useEffect, useState } from "react";
import { Box, Text, useApp, Keybind, JumpNav, DialogHost } from "@nick-skriabin/glyph";
import { Loader } from "./Loader.tsx";
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
import { MeetWithDialog } from "./MeetWithDialog.tsx";
import { AccountsDialog } from "./AccountsDialog.tsx";
import { SearchView } from "./SearchView.tsx";
import { overlayStackAtom, isLoggedInAtom, enabledCalendarsAtom, enabledCalendarsLoadedAtom } from "../state/atoms.ts";
import { loadEventsAtom, checkAuthStatusAtom, rebuildSearchIndexAtom, loadCalendarCacheAtom } from "../state/actions.ts";
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
          case "meetWith":
            return <MeetWithDialog key={`meetWith-${index}`} />;
          case "accounts":
            return <AccountsDialog key={`accounts-${index}`} />;
          // "search" is now handled inline below StatusBar
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
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadEvents = useSetAtom(loadEventsAtom);
  const checkAuthStatus = useSetAtom(checkAuthStatusAtom);
  const loadCalendarCache = useSetAtom(loadCalendarCacheAtom);
  const setDisabledCalendars = useSetAtom(enabledCalendarsAtom);
  const setCalendarsLoaded = useSetAtom(enabledCalendarsLoadedAtom);
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const rebuildSearchIndex = useSetAtom(rebuildSearchIndexAtom);

  // Fast init: config + db + cached data, then show UI immediately
  useEffect(() => {
    async function fastInit() {
      try {
        // Critical path: config, db, and cached calendars (for colors)
        await loadConfig();
        await initDb();

        // Load calendar cache + events from DB in parallel (all local, instant)
        const [disabled] = await Promise.all([
          getDisabledCalendars(),
          loadCalendarCache(), // Cached calendar colors for instant render
          loadEvents(), // Events from SQLite
        ]);
        setDisabledCalendars(disabled);
        setCalendarsLoaded(true);
        setReady(true);

        // Background: check auth, sync, refresh calendars from API
        checkAuthStatus(); // Will update calendars from API and save to cache

        // Search index built last (non-blocking)
        rebuildSearchIndex();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize");
        setReady(true);
      }
    }

    fastInit();
  }, [loadEvents, checkAuthStatus, loadCalendarCache, setDisabledCalendars, setCalendarsLoaded]);

  if (!ready) {
    return (
      <Box
        style={{
          width: "100%",
          height: "100%",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Box style={{ flexDirection: "column", alignItems: "center" }}>
          <Text style={{ color: theme.accent.primary }}>
            {" █▀█  █  ▄▀▄  █▄░█"}
          </Text>
          <Text style={{ color: theme.accent.primary }}>
            {" █▄█  █  █ █  █ ▀█"}
          </Text>
          <Text style={{ color: theme.text.dim, dim: true }}>
            {" ▀ ▀  ▀  ▀▄▀  ▀  ▀"}
          </Text>
        </Box>
        <Box style={{ paddingTop: 1 }}>
          <Loader label="Loading..." />
        </Box>
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
    <JumpNav>
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
            /:search  C-g:goto  C:calendars  ?:help
          </Text>
        </Box>

        {/* Main content */}
        <Box style={{ flexGrow: 1, flexShrink: 1, paddingX: 1, clip: true }}>
          <DayView />
        </Box>

        {/* Status bar */}
        <StatusBar />

        {/* Search results (inline, below status bar) */}
        <SearchView />

        {/* Keyboard handler */}
        <KeyboardHandler />

        {/* Quit keybind */}
        <Keybind keypress="q" onPress={() => exit()} />
        <Keybind keypress="ctrl+c" onPress={() => exit()} />

        {/* Overlays - render based on stack, not just top */}
        <OverlayRenderer />
      </Box>
    </JumpNav>
  );
}

export function App() {
  return (
    <Provider>
      <DialogHost>
        <AppContent />
      </DialogHost>
    </Provider>
  );
}
