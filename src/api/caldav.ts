/**
 * CalDAV API client
 * Provides calendar operations over the CalDAV protocol using tsdav.
 * Used alongside the Google Calendar API for accounts of type "caldav".
 */

import { createDAVClient, type DAVCalendar, type DAVObject } from "tsdav";
import type { GCalEvent } from "../domain/gcalEvent.ts";
import type { CalDAVCredentials } from "../auth/tokens.ts";
import { resolvePassword } from "../config/password.ts";
import { parseICalendar, generateICalendar, extractUID } from "./ical.ts";
import { makeCompositeId } from "../db/eventsRepo.ts";
import { apiLogger } from "../lib/logger.ts";
import type { CalendarListEntry, IncrementalSyncResult } from "./calendar.ts";

// Cache DAV clients per account to avoid re-authenticating
const clientCache = new Map<string, Awaited<ReturnType<typeof createDAVClient>>>();

/**
 * Resolve the actual password from CalDAV credentials
 * (supports password_command for secret managers)
 */
async function resolveCalDAVPassword(credentials: CalDAVCredentials, label?: string): Promise<string> {
  return resolvePassword({
    password: credentials.password,
    password_command: credentials.password_command,
    label: label || `CalDAV ${credentials.username}`,
  });
}

/**
 * Get or create a DAV client for a CalDAV account
 */
async function getDAVClient(accountEmail: string, credentials: CalDAVCredentials) {
  const cached = clientCache.get(accountEmail);
  if (cached) return cached;

  apiLogger.debug(`Creating CalDAV client for ${accountEmail}`, { serverUrl: credentials.serverUrl });

  const password = await resolveCalDAVPassword(credentials, accountEmail);

  const client = await createDAVClient({
    serverUrl: credentials.serverUrl,
    credentials: {
      username: credentials.username,
      password,
    },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });

  clientCache.set(accountEmail, client);
  return client;
}

/**
 * Clear cached client (e.g., on logout)
 */
export function clearCalDAVClient(accountEmail: string): void {
  clientCache.delete(accountEmail);
}

/**
 * Test CalDAV connection and return the principal's display name
 */
export async function testCalDAVConnection(credentials: CalDAVCredentials): Promise<{
  success: boolean;
  displayName?: string;
  error?: string;
}> {
  try {
    const password = await resolveCalDAVPassword(credentials);

    const client = await createDAVClient({
      serverUrl: credentials.serverUrl,
      credentials: {
        username: credentials.username,
        password,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });

    // Try to fetch calendars as a connectivity test
    const calendars = await client.fetchCalendars();

    return {
      success: true,
      displayName: calendars.length > 0 ? `${calendars.length} calendar(s) found` : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed";
    apiLogger.error("CalDAV connection test failed", { error: message });
    return { success: false, error: message };
  }
}

/**
 * Get calendars from a CalDAV account
 */
export async function getCalDAVCalendars(
  accountEmail: string,
  credentials: CalDAVCredentials
): Promise<CalendarListEntry[]> {
  const client = await getDAVClient(accountEmail, credentials);

  const calendars = await client.fetchCalendars();
  apiLogger.debug(`CalDAV: found ${calendars.length} calendars for ${accountEmail}`);

  return calendars
    .filter((cal) => {
      // Filter out non-calendar collections (e.g., contacts)
      const components = cal.components || [];
      return components.includes("VEVENT") || components.length === 0;
    })
    .map((cal, index) => ({
      id: cal.url, // CalDAV uses URLs as calendar identifiers
      summary: cal.displayName || `Calendar ${index + 1}`,
      description: cal.description,
      primary: index === 0, // First calendar as primary
      backgroundColor: calDAVColorToHex(cal.calendarColor),
      foregroundColor: "#ffffff",
      accessRole: "owner" as const,
      accountEmail,
    }));
}

/**
 * Convert CalDAV calendar color to hex (handles various formats)
 */
function calDAVColorToHex(color?: string): string | undefined {
  if (!color) return undefined;
  // CalDAV colors can be in various formats: #RRGGBB, #RRGGBBAA, etc.
  if (color.startsWith("#")) {
    // Take only first 7 chars (#RRGGBB)
    return color.substring(0, 7);
  }
  return color;
}

/**
 * Fetch events from a CalDAV calendar within a date range
 */
export async function fetchCalDAVEvents(options: {
  calendarId: string; // The calendar URL
  timeMin: string; // ISO date string
  timeMax: string; // ISO date string
  accountEmail: string;
  credentials: CalDAVCredentials;
}): Promise<{ events: GCalEvent[]; ctag?: string }> {
  const { calendarId, timeMin, timeMax, accountEmail, credentials } = options;
  const client = await getDAVClient(accountEmail, credentials);

  apiLogger.debug(`CalDAV: fetching events for ${accountEmail}`, { calendarId, timeMin, timeMax });

  try {
    const calendarObjects = await client.fetchCalendarObjects({
      calendar: {
        url: calendarId,
      } as DAVCalendar,
      timeRange: {
        start: timeMin,
        end: timeMax,
      },
    });

    apiLogger.debug(`CalDAV: got ${calendarObjects.length} calendar objects`);

    const events: GCalEvent[] = [];
    for (const obj of calendarObjects) {
      if (obj.data) {
        const parsed = parseICalendar(obj.data, accountEmail, calendarId);
        events.push(...parsed);
      }
    }

    // Get ctag for this calendar (for sync detection)
    const ctag = await getCalendarCtag(client, calendarId);

    return { events, ctag: ctag || undefined };
  } catch (error) {
    apiLogger.error(`CalDAV: fetch events failed for ${calendarId}`, error);
    throw error;
  }
}

/**
 * Get the ctag (sync token equivalent) for a CalDAV calendar
 */
async function getCalendarCtag(
  client: Awaited<ReturnType<typeof createDAVClient>>,
  calendarUrl: string
): Promise<string | null> {
  try {
    const calendars = await client.fetchCalendars();
    const calendar = calendars.find((c) => c.url === calendarUrl);
    return calendar?.ctag || null;
  } catch {
    return null;
  }
}

/**
 * Create a new event on a CalDAV calendar
 */
export async function createCalDAVEvent(
  event: Partial<GCalEvent>,
  calendarId: string,
  accountEmail: string,
  credentials: CalDAVCredentials
): Promise<GCalEvent> {
  const client = await getDAVClient(accountEmail, credentials);

  const uid = crypto.randomUUID();
  const icalData = generateICalendar(event as GCalEvent, uid);

  apiLogger.debug(`CalDAV: creating event on ${calendarId}`, { summary: event.summary });

  await client.createCalendarObject({
    calendar: { url: calendarId } as DAVCalendar,
    filename: `${uid}.ics`,
    iCalString: icalData,
  });

  const compositeId = makeCompositeId(accountEmail, uid, calendarId);

  return {
    ...event,
    id: compositeId,
    status: event.status || "confirmed",
    summary: event.summary || "",
    start: event.start || { dateTime: new Date().toISOString() },
    end: event.end || { dateTime: new Date().toISOString() },
    eventType: event.eventType || "default",
    accountEmail,
    calendarId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as GCalEvent;
}

/**
 * Find the CalDAV object URL for an event by its UID.
 * CalDAV servers can use any filename, so we need to look it up.
 */
async function findCalendarObjectByUID(
  client: Awaited<ReturnType<typeof createDAVClient>>,
  calendarId: string,
  uid: string
): Promise<{ url: string; etag?: string; data?: string } | null> {
  try {
    const objects = await client.fetchCalendarObjects({
      calendar: { url: calendarId } as DAVCalendar,
    });

    for (const obj of objects) {
      if (!obj.data) continue;
      const extractedUid = extractUID(obj.data);
      if (extractedUid === uid) {
        return { url: obj.url, etag: obj.etag, data: obj.data };
      }
    }
  } catch (error) {
    apiLogger.warn(`CalDAV: failed to find object by UID ${uid}`, error);
  }
  return null;
}

/**
 * Extract the event UID from a composite ID.
 * Composite format: accountEmail:calendarId:uid
 * CalDAV calendar IDs are URLs, so the UID is always the last segment
 * after the last colon that doesn't look like part of a URL.
 */
function extractUIDFromCompositeId(compositeId: string, calendarId: string, accountEmail: string): string {
  // Strip the known prefix to get the UID
  const prefix = `${accountEmail}:${calendarId}:`;
  if (compositeId.startsWith(prefix)) {
    return compositeId.substring(prefix.length);
  }
  // Fallback: last segment after the last colon
  const lastColon = compositeId.lastIndexOf(":");
  return lastColon >= 0 ? compositeId.substring(lastColon + 1) : compositeId;
}

/**
 * Update an existing event on a CalDAV calendar
 */
export async function updateCalDAVEvent(
  eventId: string,
  event: Partial<GCalEvent>,
  calendarId: string,
  accountEmail: string,
  credentials: CalDAVCredentials
): Promise<GCalEvent> {
  const client = await getDAVClient(accountEmail, credentials);

  const uid = extractUIDFromCompositeId(eventId, calendarId, accountEmail);
  apiLogger.debug(`CalDAV: updating event ${uid} on ${calendarId}`);

  // Look up the actual object URL on the server
  const existing = await findCalendarObjectByUID(client, calendarId, uid);
  if (!existing) {
    throw new Error(`CalDAV: Event ${uid} not found on server`);
  }

  const icalData = generateICalendar(event as GCalEvent, uid);

  await client.updateCalendarObject({
    calendarObject: {
      url: existing.url,
      etag: existing.etag,
      data: icalData,
    },
  });

  return {
    ...event,
    id: eventId,
    status: event.status || "confirmed",
    summary: event.summary || "",
    start: event.start || { dateTime: new Date().toISOString() },
    end: event.end || { dateTime: new Date().toISOString() },
    eventType: event.eventType || "default",
    accountEmail,
    calendarId,
    updatedAt: new Date().toISOString(),
  } as GCalEvent;
}

/**
 * Delete an event from a CalDAV calendar
 */
export async function deleteCalDAVEvent(
  eventId: string,
  calendarId: string,
  accountEmail: string,
  credentials: CalDAVCredentials
): Promise<void> {
  const client = await getDAVClient(accountEmail, credentials);

  const uid = extractUIDFromCompositeId(eventId, calendarId, accountEmail);
  apiLogger.debug(`CalDAV: deleting event ${uid} from ${calendarId}`);

  // Look up the actual object URL on the server
  const existing = await findCalendarObjectByUID(client, calendarId, uid);
  if (!existing) {
    apiLogger.warn(`CalDAV: Event ${uid} not found on server, may already be deleted`);
    return;
  }

  await client.deleteCalendarObject({
    calendarObject: {
      url: existing.url,
      etag: existing.etag,
    },
  });
}

/**
 * Perform a "sync" for a CalDAV calendar by comparing ctags.
 * CalDAV doesn't have Google-style sync tokens, so we compare ctags
 * to detect changes and refetch if needed.
 */
export async function syncCalDAVCalendar(options: {
  calendarId: string;
  accountEmail: string;
  credentials: CalDAVCredentials;
  storedCtag?: string;
  timeMin: string;
  timeMax: string;
}): Promise<IncrementalSyncResult & { ctag?: string }> {
  const { calendarId, accountEmail, credentials, storedCtag, timeMin, timeMax } = options;
  const client = await getDAVClient(accountEmail, credentials);

  // Get current ctag
  const currentCtag = await getCalendarCtag(client, calendarId);

  // If ctags match, no changes
  if (storedCtag && currentCtag && storedCtag === currentCtag) {
    apiLogger.debug(`CalDAV: no changes for calendar (ctag match)`, { calendarId });
    return {
      events: [],
      deleted: [],
      nextSyncToken: currentCtag,
      ctag: currentCtag,
    };
  }

  // Ctags differ or unknown - refetch all events
  apiLogger.debug(`CalDAV: ctag changed, refetching events`, {
    calendarId,
    old: storedCtag,
    new: currentCtag,
  });

  const { events } = await fetchCalDAVEvents({
    calendarId,
    timeMin,
    timeMax,
    accountEmail,
    credentials,
  });

  return {
    events,
    deleted: [], // Full refetch doesn't give us deleted IDs
    nextSyncToken: currentCtag || undefined,
    fullSyncRequired: true, // Signal that this was a full refetch
    ctag: currentCtag || undefined,
  };
}

// ===== Well-known CalDAV server URLs =====

export const CALDAV_PRESETS: Record<string, { name: string; serverUrl: string; help: string }> = {
  icloud: {
    name: "Apple iCloud",
    serverUrl: "https://caldav.icloud.com",
    help: "Use your Apple ID email and an app-specific password from appleid.apple.com",
  },
  fastmail: {
    name: "Fastmail",
    serverUrl: "https://caldav.fastmail.com",
    help: "Use your Fastmail email and an app-specific password",
  },
  nextcloud: {
    name: "Nextcloud",
    serverUrl: "", // User must provide
    help: "Use https://your-server.com/remote.php/dav and your Nextcloud credentials",
  },
  radicale: {
    name: "Radicale",
    serverUrl: "", // User must provide
    help: "Use http://your-server:5232 and your Radicale credentials",
  },
  baikal: {
    name: "Baïkal",
    serverUrl: "", // User must provide
    help: "Use https://your-server.com/dav.php and your Baïkal credentials",
  },
};
