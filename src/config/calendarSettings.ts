/**
 * Persistence for calendar visibility settings
 */

import { CALENDAR_SETTINGS_FILE, ensureDirectories } from "../lib/paths.ts";

interface CalendarSettings {
  // Set of disabled calendar IDs (format: "accountEmail:calendarId")
  // We store disabled rather than enabled, so new calendars are visible by default
  disabledCalendars: string[];
}

/**
 * Load calendar settings from disk
 */
export async function loadCalendarSettings(): Promise<CalendarSettings> {
  try {
    const file = Bun.file(CALENDAR_SETTINGS_FILE);
    if (await file.exists()) {
      const content = await file.text();
      return JSON.parse(content) as CalendarSettings;
    }
  } catch {
    // File doesn't exist or is invalid
  }
  return { disabledCalendars: [] };
}

/**
 * Save calendar settings to disk
 */
export async function saveCalendarSettings(settings: CalendarSettings): Promise<void> {
  try {
    await ensureDirectories();
    await Bun.write(CALENDAR_SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error("Failed to save calendar settings:", error);
  }
}

/**
 * Get the set of disabled calendar keys
 */
export async function getDisabledCalendars(): Promise<Set<string>> {
  const settings = await loadCalendarSettings();
  return new Set(settings.disabledCalendars);
}

/**
 * Update the disabled calendars set
 */
export async function setDisabledCalendars(disabled: Set<string>): Promise<void> {
  await saveCalendarSettings({
    disabledCalendars: Array.from(disabled),
  });
}

/**
 * Toggle a calendar's enabled state
 * Returns the new enabled state
 */
export async function toggleCalendar(calendarKey: string): Promise<boolean> {
  const disabled = await getDisabledCalendars();
  
  if (disabled.has(calendarKey)) {
    disabled.delete(calendarKey);
  } else {
    disabled.add(calendarKey);
  }
  
  await setDisabledCalendars(disabled);
  return !disabled.has(calendarKey); // Return new enabled state
}

/**
 * Check if a calendar is enabled
 */
export function isCalendarEnabled(calendarKey: string, disabledSet: Set<string>): boolean {
  return !disabledSet.has(calendarKey);
}

/**
 * Create a calendar key from account email and calendar ID
 */
export function makeCalendarKey(accountEmail: string, calendarId: string): string {
  return `${accountEmail}:${calendarId}`;
}
