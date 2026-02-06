import type { FocusContext } from "../state/atoms.ts";

export interface KeybindDef {
  key: string;           // The key combo for Keybind component (e.g., "shift+d", "ctrl+u")
  display: string;       // Human-readable display (e.g., "D", "Ctrl+u")
  description: string;   // What it does
  action: string;        // Action identifier for lookup
}

export type KeybindScope = FocusContext | "global";

// Central registry of all keybinds
export const KEYBIND_REGISTRY: Record<KeybindScope, KeybindDef[]> = {
  global: [
    { key: "?", display: "?", description: "Show keyboard shortcuts", action: "openHelp" },
    { key: "escape", display: "Esc", description: "Close overlay / go back", action: "popOverlay" },
    { key: ":", display: ":", description: "Open command bar", action: "openCommand" },
    { key: "q", display: "q", description: "Quit application", action: "quit" },
    { key: "ctrl+c", display: "Ctrl+c", description: "Quit application", action: "quit" },
  ],

  days: [
    { key: "j", display: "j / ↓", description: "Next day", action: "nextDay" },
    { key: "down", display: "j / ↓", description: "Next day", action: "nextDay" },
    { key: "k", display: "k / ↑", description: "Previous day", action: "prevDay" },
    { key: "up", display: "k / ↑", description: "Previous day", action: "prevDay" },
    { key: "g", display: "g", description: "Go to first day", action: "firstDay" },
    { key: "shift+g", display: "G", description: "Go to last day", action: "lastDay" },
    { key: "return", display: "Enter", description: "Select day and focus timeline", action: "confirmDay" },
    { key: "h", display: "h / l", description: "Switch to timeline", action: "toggleFocus" },
    { key: "l", display: "h / l", description: "Switch to timeline", action: "toggleFocus" },
    { key: "tab", display: "Tab", description: "Switch to timeline", action: "toggleFocus" },
  ],

  timeline: [
    { key: "j", display: "j / ↓", description: "Next event", action: "nextEvent" },
    { key: "down", display: "j / ↓", description: "Next event", action: "nextEvent" },
    { key: "k", display: "k / ↑", description: "Previous event", action: "prevEvent" },
    { key: "up", display: "k / ↑", description: "Previous event", action: "prevEvent" },
    { key: "g", display: "gg", description: "First event", action: "firstEvent" },
    { key: "shift+g", display: "G", description: "Last event", action: "lastEvent" },
    { key: "n", display: "n", description: "Jump to now", action: "jumpToNow" },
    { key: "return", display: "Enter", description: "Open event details", action: "openDetails" },
    { key: "space", display: "Space", description: "Open event details", action: "openDetails" },
    { key: "e", display: "e", description: "Edit event", action: "editEvent" },
    { key: "shift+d", display: "D", description: "Delete event", action: "deleteEvent" },
    { key: "h", display: "h / l", description: "Switch to days sidebar", action: "toggleFocus" },
    { key: "l", display: "h / l", description: "Switch to days sidebar", action: "toggleFocus" },
    { key: "tab", display: "Tab", description: "Switch to days sidebar", action: "toggleFocus" },
  ],

  details: [
    { key: "y", display: "y", description: "Accept invitation (Yes)", action: "acceptInvite" },
    { key: "n", display: "n", description: "Decline invitation (No)", action: "declineInvite" },
    { key: "m", display: "m", description: "Maybe / Tentative", action: "tentativeInvite" },
    { key: "e", display: "e", description: "Edit event", action: "editEvent" },
    { key: "shift+d", display: "D", description: "Delete event", action: "deleteEvent" },
    { key: "o", display: "o", description: "Open meeting link", action: "openMeetingLink" },
  ],

  dialog: [
    { key: "tab", display: "Tab", description: "Next field", action: "nextField" },
    { key: "shift+tab", display: "Shift+Tab", description: "Previous field", action: "prevField" },
    { key: "escape", display: "Esc", description: "Cancel and close", action: "cancel" },
  ],

  command: [
    { key: "return", display: "Enter", description: "Execute command", action: "execute" },
    { key: "escape", display: "Esc", description: "Cancel", action: "cancel" },
  ],

  confirm: [
    { key: "y", display: "y", description: "Confirm / Yes", action: "confirm" },
    { key: "n", display: "n", description: "Cancel / No", action: "cancel" },
    { key: "escape", display: "Esc", description: "Cancel", action: "cancel" },
  ],
};

// Get keybinds for a scope, deduped by display key (for help dialog)
export function getKeybindsForScope(scope: KeybindScope): KeybindDef[] {
  const keybinds = KEYBIND_REGISTRY[scope] || [];
  // Dedupe by display key (e.g., j and down both show as "j / ↓")
  const seen = new Set<string>();
  return keybinds.filter((kb) => {
    if (seen.has(kb.display)) return false;
    seen.add(kb.display);
    return true;
  });
}

// Get keybinds for help dialog (context + global)
export function getKeybindsForHelp(context: FocusContext): { title: string; keybinds: KeybindDef[] }[] {
  const sections: { title: string; keybinds: KeybindDef[] }[] = [];

  const scopeTitle: Record<FocusContext, string> = {
    days: "Days Sidebar",
    timeline: "Timeline",
    details: "Event Details",
    dialog: "Dialog",
    command: "Command Bar",
    confirm: "Confirm Dialog",
  };

  // Add context-specific keybinds
  const contextKeybinds = getKeybindsForScope(context);
  if (contextKeybinds.length > 0) {
    sections.push({
      title: scopeTitle[context] || context,
      keybinds: contextKeybinds,
    });
  }

  // Add global keybinds
  sections.push({
    title: "Global",
    keybinds: getKeybindsForScope("global"),
  });

  return sections;
}

// Commands for command bar
export const COMMANDS = [
  { name: "new", description: "Create new event" },
  { name: "new <title>", description: "Create event with title" },
];
