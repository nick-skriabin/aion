/**
 * Calendars sidebar - shows all calendars grouped by account
 * Allows toggling calendar visibility
 */

import React, { useEffect, useMemo, useRef, useCallback } from "react";
import { Box, Text, FocusScope, useInput } from "@nick-skriabin/glyph";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  calendarSidebarVisibleAtom,
  enabledCalendarsAtom,
  enabledCalendarsLoadedAtom,
  selectedCalendarIndexAtom,
  calendarsByAccountAtom,
  focusAtom,
  calendarColorMapAtom,
  getCalendarColor,
  type CalendarInfo,
} from "../state/atoms.ts";
import {
  getDisabledCalendars,
  setDisabledCalendars,
  makeCalendarKey,
  isCalendarEnabled,
} from "../config/calendarSettings.ts";
import { theme } from "./theme.ts";

const SIDEBAR_WIDTH = 24;

interface CalendarItem {
  type: "account" | "calendar";
  accountEmail: string;
  calendar?: CalendarInfo;
  key: string;
}

/**
 * Build a flat list of items for navigation
 * Includes account headers and calendar items
 */
function buildCalendarList(calendarsByAccount: Record<string, CalendarInfo[]>): CalendarItem[] {
  const items: CalendarItem[] = [];
  
  const sortedAccounts = Object.keys(calendarsByAccount).sort();
  
  for (const accountEmail of sortedAccounts) {
    // Add account header (not selectable, just for display)
    items.push({
      type: "account",
      accountEmail,
      key: `account:${accountEmail}`,
    });
    
    // Add calendars for this account
    const calendars = calendarsByAccount[accountEmail] || [];
    // Sort by primary first, then by name
    const sortedCalendars = [...calendars].sort((a, b) => {
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return a.summary.localeCompare(b.summary);
    });
    
    for (const calendar of sortedCalendars) {
      items.push({
        type: "calendar",
        accountEmail,
        calendar,
        key: makeCalendarKey(accountEmail, calendar.id),
      });
    }
  }
  
  return items;
}

function CalendarsKeybinds({
  handlersRef,
}: {
  handlersRef: React.RefObject<{
    move: (delta: number) => void;
    toggle: () => void;
    close: () => void;
  }>;
}) {
  useInput((key) => {
    const handlers = handlersRef.current;
    if (!handlers) return;
    
    if (key.name === "escape" || (key.name === "c" && key.shift)) {
      handlers.close();
      return;
    }
    
    if (key.name === "j" || key.name === "down") {
      handlers.move(1);
      return;
    }
    
    if (key.name === "k" || key.name === "up") {
      handlers.move(-1);
      return;
    }
    
    if (key.sequence === "space" || key.name === "return") {
      handlers.toggle();
      return;
    }
    
    // Backtick to move focus to days
    if (key.sequence === "`") {
      handlers.close();
      return;
    }
  });
  
  return null;
}

export function CalendarsSidebar() {
  const isVisible = useAtomValue(calendarSidebarVisibleAtom);
  const calendarsByAccount = useAtomValue(calendarsByAccountAtom);
  const calendarColorMap = useAtomValue(calendarColorMapAtom);
  const [disabledCalendars, setDisabledCalendarsAtom] = useAtom(enabledCalendarsAtom);
  const [loaded, setLoaded] = useAtom(enabledCalendarsLoadedAtom);
  const [selectedIndex, setSelectedIndex] = useAtom(selectedCalendarIndexAtom);
  const [focus, setFocus] = useAtom(focusAtom);
  const setSidebarVisible = useSetAtom(calendarSidebarVisibleAtom);
  
  const isFocused = focus === "calendars";
  
  // Build the flat list of items
  const items = useMemo(
    () => buildCalendarList(calendarsByAccount),
    [calendarsByAccount]
  );
  
  // Only calendar items are selectable
  const selectableIndices = useMemo(
    () => items.map((item, i) => item.type === "calendar" ? i : -1).filter(i => i >= 0),
    [items]
  );
  
  // Load disabled calendars from disk on mount
  useEffect(() => {
    if (!loaded) {
      getDisabledCalendars().then((disabled) => {
        setDisabledCalendarsAtom(disabled);
        setLoaded(true);
      });
    }
  }, [loaded, setDisabledCalendarsAtom, setLoaded]);
  
  // Reset selection to first calendar when sidebar becomes visible
  useEffect(() => {
    const firstIdx = selectableIndices[0];
    if (isVisible && firstIdx !== undefined && !selectableIndices.includes(selectedIndex)) {
      setSelectedIndex(firstIdx);
    }
  }, [isVisible, selectableIndices, selectedIndex, setSelectedIndex]);
  
  // Use ref to avoid stale closures in useInput
  const handlersRef = useRef({
    move: (delta: number) => {},
    toggle: () => {},
    close: () => {},
  });
  
  // Update handlers ref with latest functions
  handlersRef.current.move = useCallback((delta: number) => {
    if (selectableIndices.length === 0) return;
    
    // Find current position in selectable list
    let currentPos = selectableIndices.indexOf(selectedIndex);
    
    // If not found, start from beginning (down) or end (up)
    if (currentPos === -1) {
      currentPos = delta > 0 ? -1 : selectableIndices.length;
    }
    
    let newPos = currentPos + delta;
    
    // Wrap around
    if (newPos < 0) {
      newPos = selectableIndices.length - 1;
    } else if (newPos >= selectableIndices.length) {
      newPos = 0;
    }
    
    const newIndex = selectableIndices[newPos];
    if (newIndex !== undefined) {
      setSelectedIndex(newIndex);
    }
  }, [selectableIndices, selectedIndex, setSelectedIndex]);
  
  handlersRef.current.toggle = useCallback(async () => {
    const item = items[selectedIndex];
    if (item?.type !== "calendar" || !item.calendar) return;
    
    const key = makeCalendarKey(item.accountEmail, item.calendar.id);
    const newDisabled = new Set(disabledCalendars);
    
    if (newDisabled.has(key)) {
      newDisabled.delete(key);
    } else {
      newDisabled.add(key);
    }
    
    setDisabledCalendarsAtom(newDisabled);
    await setDisabledCalendars(newDisabled);
  }, [items, selectedIndex, disabledCalendars, setDisabledCalendarsAtom]);
  
  handlersRef.current.close = useCallback(() => {
    setSidebarVisible(false);
    setFocus("days");
  }, [setSidebarVisible, setFocus]);
  
  if (!isVisible) {
    return null;
  }
  
  return (
    <Box
      style={{
        width: SIDEBAR_WIDTH,
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Box style={{ paddingX: 1 }}>
        <Text style={{ bold: true, color: theme.accent.primary }}>Calendars</Text>
      </Box>
      
      {/* Keybinds when focused */}
      {isFocused && (
        <FocusScope trap>
          <CalendarsKeybinds handlersRef={handlersRef} />
        </FocusScope>
      )}
      
      {/* Calendar list */}
      <Box style={{ flexDirection: "column", paddingTop: 1 }}>
        {items.map((item, index) => {
          if (item.type === "account") {
            // Account header
            const accountName = item.accountEmail.split("@")[0] ?? "";
            return (
              <Box key={item.key} style={{ paddingX: 1, paddingTop: index > 0 ? 1 : 0 }}>
                <Text style={{ color: theme.text.dim, dim: true }}>
                  {accountName.length > SIDEBAR_WIDTH - 4
                    ? accountName.slice(0, SIDEBAR_WIDTH - 5) + "…"
                    : accountName}
                </Text>
              </Box>
            );
          }
          
          // Calendar item
          const calendar = item.calendar!;
          const calendarKey = makeCalendarKey(item.accountEmail, calendar.id);
          const enabled = isCalendarEnabled(calendarKey, disabledCalendars);
          const isSelected = selectedIndex === index && isFocused;
          const color = getCalendarColor(item.accountEmail, calendar.id, calendarColorMap);
          
          // Truncate name to fit
          const maxNameWidth = SIDEBAR_WIDTH - 6; // account for checkbox, dot, padding
          const displayName = calendar.summary.length > maxNameWidth
            ? calendar.summary.slice(0, maxNameWidth - 1) + "…"
            : calendar.summary;
          
          return (
            <Box
              key={item.key}
              style={{
                paddingX: 1,
                flexDirection: "row",
                bg: isSelected ? theme.selection.background : undefined,
              }}
            >
              <Text style={{ color: isSelected ? theme.selection.text : theme.text.secondary }}>
                {enabled ? "☑" : "☐"}
              </Text>
              <Text style={{ color: color as any, dim: !enabled }}> ● </Text>
              <Text
                style={{
                  color: isSelected ? theme.selection.text : (enabled ? theme.text.primary : theme.text.dim),
                  dim: !enabled,
                }}
              >
                {calendar.primary ? `★ ${displayName}` : displayName}
              </Text>
            </Box>
          );
        })}
      </Box>
      
      {/* Footer hint */}
      <Box style={{ flexGrow: 1 }} />
      <Box style={{ paddingX: 1, paddingY: 1 }}>
        <Text style={{ color: theme.text.dim, dim: true }}>
          space:toggle
        </Text>
      </Box>
    </Box>
  );
}
