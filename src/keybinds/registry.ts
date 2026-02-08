import type { FocusContext } from "../state/atoms.ts";

export interface KeybindDef {
  key: string;           // The key combo for Keybind component (e.g., "shift+d", "ctrl+u")
  display: string;       // Human-readable display (e.g., "D", "Ctrl+u")
  description: string;   // What it does
  action: string;        // Action identifier for lookup
  command?: string;      // Optional command name for command bar (e.g., "new", "edit")
}

export type KeybindScope = FocusContext | "global";

// Central registry of all keybinds
export const KEYBIND_REGISTRY: Record<KeybindScope, KeybindDef[]> = {
  global: [
    { key: "?", display: "?", description: "Show keyboard shortcuts", action: "openHelp", command: "help" },
    { key: "shift+n", display: "N", description: "Open notifications", action: "openNotifications", command: "notifications" },
    { key: "ctrl+n", display: "Ctrl+n", description: "Create new event", action: "newEvent", command: "new" },
    { key: "a", display: "a", description: "Toggle all-day events", action: "toggleAllDay", command: "allday" },
    { key: "shift+c", display: "C", description: "Toggle calendars sidebar", action: "toggleCalendars", command: "calendars" },
    { key: "ctrl+g", display: "Ctrl+g", description: "Go to date", action: "openGoto", command: "goto" },
    { key: "escape", display: "Esc", description: "Close overlay / go back", action: "popOverlay" },
    { key: ":", display: ":", description: "Open command bar", action: "openCommand" },
    { key: "q", display: "q", description: "Quit application", action: "quit", command: "quit" },
    { key: "ctrl+c", display: "Ctrl+c", description: "Quit application", action: "quit" },
    // Auth commands (no keybindings, command-only)
    { key: "", display: "", description: "Login / Add Google account", action: "login", command: "login" },
    { key: "", display: "", description: "Logout from Google Calendar", action: "logout", command: "logout" },
    { key: "", display: "", description: "Sync events with Google Calendar", action: "sync", command: "sync" },
    { key: "", display: "", description: "List connected accounts", action: "accounts", command: "accounts" },
    { key: "", display: "", description: "Upgrade permissions (grant new scopes)", action: "upgrade", command: "upgrade" },
  ],

  calendars: [
    { key: "j", display: "j / ↓", description: "Next calendar", action: "nextCalendar" },
    { key: "down", display: "j / ↓", description: "Next calendar", action: "nextCalendar" },
    { key: "k", display: "k / ↑", description: "Previous calendar", action: "prevCalendar" },
    { key: "up", display: "k / ↑", description: "Previous calendar", action: "prevCalendar" },
    { key: "space", display: "Space", description: "Toggle calendar visibility", action: "toggleCalendar" },
    { key: "return", display: "Enter", description: "Toggle calendar visibility", action: "toggleCalendar" },
    { key: "tab", display: "Tab", description: "Move to days list", action: "focusDays" },
    { key: "l", display: "l", description: "Move to days list", action: "focusDays" },
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
    { key: "n", display: "n", description: "Jump to now", action: "jumpToNow", command: "now" },
    { key: "return", display: "Enter", description: "Open event details", action: "openDetails" },
    { key: "space", display: "Space", description: "Open event details", action: "openDetails" },
    { key: "e", display: "e", description: "Edit event", action: "editEvent", command: "edit" },
    { key: "p", display: "p", description: "Propose new time", action: "proposeNewTime" },
    { key: "shift+d", display: "D", description: "Delete event", action: "deleteEvent", command: "delete" },
    { key: ":", display: ":", description: "Open command bar", action: "openCommand" },
    { key: "h", display: "h / l", description: "Switch to days sidebar", action: "toggleFocus" },
    { key: "l", display: "h / l", description: "Switch to days sidebar", action: "toggleFocus" },
    { key: "tab", display: "Tab", description: "Switch to days sidebar", action: "toggleFocus" },
  ],

  details: [
    { key: "y", display: "y", description: "Accept invitation (Yes)", action: "acceptInvite" },
    { key: "n", display: "n", description: "Decline invitation (No)", action: "declineInvite" },
    { key: "m", display: "m", description: "Maybe / Tentative", action: "tentativeInvite" },
    { key: "e", display: "e", description: "Edit event", action: "editEvent" },
    { key: "p", display: "p", description: "Propose new time", action: "proposeNewTime" },
    { key: "shift+d", display: "D", description: "Delete event", action: "deleteEvent" },
    { key: "o", display: "o", description: "Open meeting link", action: "openMeetingLink" },
    { key: "t", display: "t", description: "Toggle timezone (local/original)", action: "toggleTimezone" },
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

  notifications: [
    { key: "j", display: "j / ↓", description: "Next invite", action: "next" },
    { key: "down", display: "j / ↓", description: "Next invite", action: "next" },
    { key: "k", display: "k / ↑", description: "Previous invite", action: "prev" },
    { key: "up", display: "k / ↑", description: "Previous invite", action: "prev" },
    { key: "y", display: "y", description: "Accept invite", action: "accept" },
    { key: "n", display: "n", description: "Decline invite", action: "decline" },
    { key: "m", display: "m", description: "Maybe / Tentative", action: "tentative" },
    { key: "escape", display: "Esc", description: "Close panel", action: "close" },
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
    calendars: "Calendars Sidebar",
    days: "Days Sidebar",
    timeline: "Timeline",
    details: "Event Details",
    dialog: "Dialog",
    command: "Command Bar",
    confirm: "Confirm Dialog",
    notifications: "Notifications",
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

// Get all commands from registry (keybinds with command field)
export function getAllCommands(): { name: string; description: string; action: string }[] {
  const commands: { name: string; description: string; action: string }[] = [];
  const seen = new Set<string>();

  for (const scope of Object.keys(KEYBIND_REGISTRY) as KeybindScope[]) {
    for (const kb of KEYBIND_REGISTRY[scope]) {
      if (kb.command && !seen.has(kb.command)) {
        seen.add(kb.command);
        commands.push({
          name: kb.command,
          description: kb.description,
          action: kb.action,
        });
      }
    }
  }

  // Add commands with arguments (special cases)
  commands.push({ name: "new <title>", description: "Create event with title", action: "newEvent" });
  commands.push({ name: "goto <date>", description: "Go to date (e.g., 'goto tomorrow')", action: "gotoDate" });

  return commands.sort((a, b) => a.name.localeCompare(b.name));
}

// Find command by name (exact match or prefix for parameterized commands)
export function findCommand(input: string): { name: string; action: string; args?: string } | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Check for exact match first
  const commands = getAllCommands();
  const exact = commands.find((c) => c.name === trimmed);
  if (exact) {
    return { name: exact.name, action: exact.action };
  }

  // Check for parameterized commands (e.g., "new my event")
  const parts = trimmed.split(/\s+/);
  const cmdName = parts[0];
  const args = parts.slice(1).join(" ");

  const parameterized = commands.find((c) => c.name.startsWith(cmdName + " <") || c.name === cmdName);
  if (parameterized) {
    return { name: parameterized.name, action: parameterized.action, args: args || undefined };
  }

  return null;
}
