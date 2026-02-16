/**
 * Google Calendar API client (multi-account support)
 * Also routes CalDAV accounts to the CalDAV provider.
 */

import { getValidAccessToken, getValidAccessTokenForAccount, getAccounts } from "../auth/tokens.ts";
import type { GCalEvent, Attendee, Organizer } from "../domain/gcalEvent.ts";
import { apiLogger } from "../lib/logger.ts";
import { makeCompositeId, extractGoogleId } from "../db/eventsRepo.ts";
import { prefetchContactNames, getDisplayName } from "./contacts.ts";
import {
  getCalDAVCalendars,
  fetchCalDAVEvents,
  createCalDAVEvent,
  updateCalDAVEvent,
  deleteCalDAVEvent,
  syncCalDAVCalendar,
} from "./caldav.ts";
import { getSyncTokenKey } from "../sync/syncTokens.ts";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

/**
 * Make an authenticated request to the Google Calendar API
 */
async function calendarFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  accountEmail?: string
): Promise<T> {
  const accessToken = accountEmail
    ? await getValidAccessTokenForAccount(accountEmail)
    : await getValidAccessToken();
  
  if (!accessToken) {
    throw new Error("Not authenticated. Please run 'login' first.");
  }
  
  const url = `${CALENDAR_API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Calendar API error (${response.status}): ${error}`);
  }
  
  // Handle 204 No Content (e.g., DELETE requests)
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return undefined as T;
  }
  
  return response.json() as Promise<T>;
}

/**
 * Calendar list item from Google API
 */
export interface CalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole: "owner" | "writer" | "reader" | "freeBusyReader";
  // Extended fields for multi-account
  accountEmail?: string;
}

/**
 * Get list of user's calendars for a specific account
 */
export async function getCalendarListForAccount(accountEmail: string): Promise<CalendarListEntry[]> {
  apiLogger.debug(`getCalendarListForAccount starting for ${accountEmail}`);
  try {
    const response = await calendarFetch<{ items: CalendarListEntry[] }>(
      "/users/me/calendarList",
      {},
      accountEmail
    );
    apiLogger.debug(`getCalendarListForAccount got response for ${accountEmail}`, { itemCount: response.items?.length });
    // Tag each calendar with its account
    return (response.items || []).map((cal) => ({
      ...cal,
      accountEmail,
    }));
  } catch (error) {
    apiLogger.error(`getCalendarListForAccount failed for ${accountEmail}`, error);
    throw error;
  }
}

/**
 * Get list of all calendars across all accounts (Google + CalDAV)
 */
export async function getAllCalendars(): Promise<CalendarListEntry[]> {
  const accounts = await getAccounts();
  apiLogger.debug(`Fetching calendars for ${accounts.length} accounts`);
  const allCalendars: CalendarListEntry[] = [];
  
  for (const account of accounts) {
    try {
      apiLogger.debug(`Fetching calendars for ${account.account.email} (${account.account.type || "google"})`);
      
      if (account.account.type === "caldav" && account.caldavCredentials) {
        // CalDAV account
        const calendars = await getCalDAVCalendars(
          account.account.email,
          account.caldavCredentials
        );
        apiLogger.debug(`Got ${calendars.length} CalDAV calendars for ${account.account.email}`);
        allCalendars.push(...calendars);
      } else {
        // Google account (default)
        const calendars = await getCalendarListForAccount(account.account.email);
        apiLogger.debug(`Got ${calendars.length} calendars for ${account.account.email}`);
        allCalendars.push(...calendars);
      }
    } catch (error) {
      apiLogger.error(`Failed to fetch calendars for ${account.account.email}`, error);
    }
  }
  
  apiLogger.debug(`Total calendars fetched: ${allCalendars.length}`);
  return allCalendars;
}

/**
 * Get the primary calendar ID for an account
 */
export async function getPrimaryCalendarIdForAccount(accountEmail: string): Promise<string> {
  const calendars = await getCalendarListForAccount(accountEmail);
  const primary = calendars.find((c) => c.primary);
  return primary?.id || "primary";
}

/**
 * Legacy: Get the primary calendar ID (for default account)
 */
export async function getPrimaryCalendarId(): Promise<string> {
  const response = await calendarFetch<{ items: CalendarListEntry[] }>(
    "/users/me/calendarList"
  );
  const primary = (response.items || []).find((c) => c.primary);
  return primary?.id || "primary";
}

/**
 * Google Calendar event from API (raw format)
 */
interface GoogleCalendarEvent {
  id: string;
  status: string;
  summary?: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  created?: string;
  updated?: string;
  creator?: {
    email?: string;
    displayName?: string;
    self?: boolean;
  };
  organizer?: {
    email: string;
    displayName?: string;
    self?: boolean;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
    self?: boolean;
    organizer?: boolean;
  }>;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
      label?: string;
    }>;
  };
  recurringEventId?: string;
  recurrence?: string[];
  eventType?: string;
  visibility?: string;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: string;
      minutes: number;
    }>;
  };
}

/**
 * Events list response from Google API
 */
interface EventsListResponse {
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

/**
 * Result of an incremental sync
 */
export interface IncrementalSyncResult {
  events: GCalEvent[];
  deleted: string[]; // IDs of deleted/cancelled events
  nextSyncToken?: string;
  fullSyncRequired?: boolean; // True if sync token was invalid
}

/**
 * Convert Google Calendar event to our GCalEvent format
 * The ID is converted to a composite ID (accountEmail:calendarId:googleId) for global uniqueness
 */
function toGCalEvent(event: GoogleCalendarEvent, accountEmail?: string, calendarId?: string): GCalEvent {
  // Create composite ID for global uniqueness across accounts and calendars
  const compositeId = makeCompositeId(accountEmail, event.id, calendarId);
  return {
    id: compositeId,
    status: event.status as "confirmed" | "tentative" | "cancelled",
    summary: event.summary ?? "",
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.start.dateTime,
      date: event.start.date,
      timeZone: event.start.timeZone,
    },
    end: {
      dateTime: event.end.dateTime,
      date: event.end.date,
      timeZone: event.end.timeZone,
    },
    createdAt: event.created,
    updatedAt: event.updated,
    organizer: event.organizer,
    attendees: event.attendees?.map((a) => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus as "needsAction" | "declined" | "tentative" | "accepted" | undefined,
      self: a.self,
      organizer: a.organizer,
    })),
    hangoutLink: event.hangoutLink,
    recurringEventId: event.recurringEventId,
    recurrence: event.recurrence,
    eventType: (event.eventType as "default" | "outOfOffice" | "focusTime" | "workingLocation" | "birthday") ?? "default",
    visibility: event.visibility as "default" | "public" | "private" | "confidential" | undefined,
    reminders: event.reminders ? {
      useDefault: event.reminders.useDefault,
      overrides: event.reminders.overrides?.map((o) => ({
        method: o.method as "email" | "popup",
        minutes: o.minutes,
      })),
    } : undefined,
    // Extended fields for multi-account
    accountEmail,
    calendarId,
  };
}

/**
 * Fetch events from a calendar within a date range (full sync)
 * Returns all events and a syncToken for future incremental syncs
 */
export async function fetchEvents(options: {
  calendarId?: string;
  timeMin: string; // ISO date string
  timeMax: string; // ISO date string
  maxResults?: number;
  accountEmail?: string;
}): Promise<{ events: GCalEvent[]; syncToken?: string }> {
  const {
    calendarId = "primary",
    timeMin,
    timeMax,
    maxResults = 250,
    accountEmail,
  } = options;
  
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    maxResults: String(maxResults),
    singleEvents: "true", // Expand recurring events
    orderBy: "startTime",
  });
  
  const allEvents: GCalEvent[] = [];
  let pageToken: string | undefined;
  let syncToken: string | undefined;
  
  do {
    const url = `/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    if (pageToken) {
      params.set("pageToken", pageToken);
    }
    
    const response = await calendarFetch<EventsListResponse>(url, {}, accountEmail);
    
    const events = (response.items || [])
      .filter((e) => e.status !== "cancelled")
      .map((e) => toGCalEvent(e, accountEmail, calendarId));
    
    allEvents.push(...events);
    pageToken = response.nextPageToken;
    
    // Capture sync token from last page
    if (!pageToken && response.nextSyncToken) {
      syncToken = response.nextSyncToken;
    }
  } while (pageToken);
  
  return { events: allEvents, syncToken };
}

/**
 * Perform incremental sync using a sync token
 * Returns only changed/deleted events since the token was issued
 */
export async function incrementalSync(options: {
  calendarId?: string;
  syncToken: string;
  accountEmail?: string;
}): Promise<IncrementalSyncResult> {
  const {
    calendarId = "primary",
    syncToken,
    accountEmail,
  } = options;
  
  const params = new URLSearchParams({
    syncToken,
    maxResults: "250",
  });
  
  const changedEvents: GCalEvent[] = [];
  const deletedIds: string[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  
  try {
    do {
      if (pageToken) {
        params.set("pageToken", pageToken);
      }
      
      const url = `/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
      const response = await calendarFetch<EventsListResponse>(url, {}, accountEmail);
      
      for (const event of response.items || []) {
        const compositeId = makeCompositeId(accountEmail, event.id, calendarId);
        
        if (event.status === "cancelled") {
          // Event was deleted or cancelled
          deletedIds.push(compositeId);
        } else {
          // Event was added or modified
          changedEvents.push(toGCalEvent(event, accountEmail, calendarId));
        }
      }
      
      pageToken = response.nextPageToken;
      
      // Capture new sync token from last page
      if (!pageToken && response.nextSyncToken) {
        nextSyncToken = response.nextSyncToken;
      }
    } while (pageToken);
    
    return {
      events: changedEvents,
      deleted: deletedIds,
      nextSyncToken,
    };
  } catch (error) {
    // Check if sync token is invalid (410 Gone)
    if (error instanceof Error && error.message.includes("410")) {
      apiLogger.warn(`Sync token invalid for ${calendarId}, full sync required`);
      return {
        events: [],
        deleted: [],
        fullSyncRequired: true,
      };
    }
    throw error;
  }
}

/**
 * Full sync result with sync tokens for each calendar
 */
export interface FullSyncResult {
  events: GCalEvent[];
  syncTokens: Map<string, string>; // calendarKey -> syncToken
}

/**
 * Fetch events from all accounts and calendars (full sync)
 * Returns sync tokens for future incremental syncs
 * Supports both Google Calendar and CalDAV accounts.
 */
export async function fetchAllEvents(options: {
  timeMin: string;
  timeMax: string;
  maxResults?: number;
}): Promise<FullSyncResult> {
  const accounts = await getAccounts();
  const allEvents: GCalEvent[] = [];
  const syncTokens = new Map<string, string>();
  
  for (const account of accounts) {
    try {
      if (account.account.type === "caldav" && account.caldavCredentials) {
        // CalDAV account - fetch events from all CalDAV calendars
        const calendars = await getCalDAVCalendars(
          account.account.email,
          account.caldavCredentials
        );
        
        for (const calendar of calendars) {
          try {
            const { events, ctag } = await fetchCalDAVEvents({
              calendarId: calendar.id,
              timeMin: options.timeMin,
              timeMax: options.timeMax,
              accountEmail: account.account.email,
              credentials: account.caldavCredentials,
            });
            allEvents.push(...events);
            
            // Store ctag as sync token for CalDAV calendars
            if (ctag) {
              syncTokens.set(getSyncTokenKey(account.account.email, calendar.id), ctag);
            }
            
            apiLogger.debug(`CalDAV: Fetched ${events.length} events from ${calendar.summary}`);
          } catch (error) {
            apiLogger.error(`CalDAV: Failed to fetch events for calendar ${calendar.summary}`, error);
          }
        }
      } else {
        // Google account (default)
        const calendars = await getCalendarListForAccount(account.account.email);
        
        for (const calendar of calendars) {
          try {
            const { events, syncToken } = await fetchEvents({
              calendarId: calendar.id,
              timeMin: options.timeMin,
              timeMax: options.timeMax,
              maxResults: options.maxResults,
              accountEmail: account.account.email,
            });
            allEvents.push(...events);
            
            if (syncToken) {
              syncTokens.set(getSyncTokenKey(account.account.email, calendar.id), syncToken);
            }
            
            apiLogger.debug(`Fetched ${events.length} events from ${calendar.summary}`);
          } catch (error) {
            apiLogger.error(`Failed to fetch events for calendar ${calendar.summary}`, error);
          }
        }
      }
    } catch (error) {
      apiLogger.error(`Failed to fetch calendars for ${account.account.email}`, error);
    }
  }
  
  // Enrich events with display names from contacts (Google accounts only)
  const googleEvents = allEvents.filter(e => {
    const acct = accounts.find(a => a.account.email === e.accountEmail);
    return !acct || acct.account.type !== "caldav";
  });
  if (googleEvents.length > 0) {
    await enrichEventsWithDisplayNames(googleEvents);
  }
  
  return { events: allEvents, syncTokens };
}

/**
 * Collect all unique emails from events (attendees + organizers)
 */
function collectEmailsFromEvents(events: GCalEvent[]): string[] {
  const emails = new Set<string>();
  
  for (const event of events) {
    if (event.organizer?.email) {
      emails.add(event.organizer.email);
    }
    if (event.attendees) {
      for (const attendee of event.attendees) {
        if (attendee.email) {
          emails.add(attendee.email);
        }
      }
    }
  }
  
  return Array.from(emails);
}

/**
 * Enrich events with display names from contacts cache
 */
async function enrichEventsWithDisplayNames(events: GCalEvent[]): Promise<void> {
  // Collect all emails and prefetch their names
  const emails = collectEmailsFromEvents(events);
  
  if (emails.length === 0) return;
  
  apiLogger.debug(`Enriching display names for ${emails.length} unique emails`);
  
  // Prefetch all names (this will hit People API and cache results)
  await prefetchContactNames(emails);
  
  // Now enrich each event
  for (const event of events) {
    // Enrich organizer
    if (event.organizer?.email && !event.organizer.displayName) {
      const name = await getDisplayName(event.organizer.email);
      if (name) {
        (event.organizer as Organizer).displayName = name;
      }
    }
    
    // Enrich attendees
    if (event.attendees) {
      for (const attendee of event.attendees) {
        if (attendee.email && !attendee.displayName) {
          const name = await getDisplayName(attendee.email);
          if (name) {
            (attendee as Attendee).displayName = name;
          }
        }
      }
    }
  }
}

/**
 * Incremental sync result for all calendars
 */
export interface AllCalendarsIncrementalResult {
  changed: GCalEvent[];
  deleted: string[];
  syncTokens: Map<string, string>;
  calendarsRequiringFullSync: string[]; // Calendar keys that need full sync
}

/**
 * Perform incremental sync on all calendars using stored sync tokens.
 * Supports both Google Calendar (sync tokens) and CalDAV (ctags).
 */
export async function incrementalSyncAll(
  getSyncTokenFn: (accountEmail: string, calendarId: string) => Promise<string | undefined>,
  syncTimeRange?: { timeMin: string; timeMax: string }
): Promise<AllCalendarsIncrementalResult> {
  const accounts = await getAccounts();
  const changed: GCalEvent[] = [];
  const deleted: string[] = [];
  const syncTokens = new Map<string, string>();
  const calendarsRequiringFullSync: string[] = [];
  
  for (const account of accounts) {
    try {
      if (account.account.type === "caldav" && account.caldavCredentials) {
        // CalDAV account - use ctag-based sync
        // CalDAV handles its own "full refetch" inline when ctag changes,
        // so we DON'T add to calendarsRequiringFullSync (that would trigger
        // a global full sync of ALL accounts including Google).
        const calendars = await getCalDAVCalendars(
          account.account.email,
          account.caldavCredentials
        );
        
        for (const calendar of calendars) {
          const calendarKey = getSyncTokenKey(account.account.email, calendar.id);
          const storedCtag = await getSyncTokenFn(account.account.email, calendar.id);
          
          if (!syncTimeRange) {
            // No time range available - can't sync CalDAV without one
            continue;
          }
          
          try {
            const result = await syncCalDAVCalendar({
              calendarId: calendar.id,
              accountEmail: account.account.email,
              credentials: account.caldavCredentials,
              storedCtag, // undefined on first sync is fine
              timeMin: syncTimeRange.timeMin,
              timeMax: syncTimeRange.timeMax,
            });
            
            // CalDAV "sync" refetches all events when ctag changes.
            // Treat the results as changed events for the caller to upsert.
            if (result.events.length > 0) {
              changed.push(...result.events);
            }
            
            if (result.nextSyncToken) {
              syncTokens.set(calendarKey, result.nextSyncToken);
            }
            
            apiLogger.debug(`CalDAV sync for ${calendar.summary}: ${result.events.length} events`);
          } catch (error) {
            apiLogger.error(`CalDAV sync failed for ${calendar.summary}`, error);
          }
        }
      } else {
        // Google account (default)
        const calendars = await getCalendarListForAccount(account.account.email);
        
        for (const calendar of calendars) {
          const calendarKey = getSyncTokenKey(account.account.email, calendar.id);
          const existingToken = await getSyncTokenFn(account.account.email, calendar.id);
          
          if (!existingToken) {
            calendarsRequiringFullSync.push(calendarKey);
            continue;
          }
          
          try {
            const result = await incrementalSync({
              calendarId: calendar.id,
              syncToken: existingToken,
              accountEmail: account.account.email,
            });
            
            if (result.fullSyncRequired) {
              calendarsRequiringFullSync.push(calendarKey);
              continue;
            }
            
            changed.push(...result.events);
            deleted.push(...result.deleted);
            
            if (result.nextSyncToken) {
              syncTokens.set(calendarKey, result.nextSyncToken);
            }
            
            apiLogger.debug(`Incremental sync for ${calendar.summary}: ${result.events.length} changed, ${result.deleted.length} deleted`);
          } catch (error) {
            apiLogger.error(`Incremental sync failed for ${calendar.summary}`, error);
            calendarsRequiringFullSync.push(calendarKey);
          }
        }
      }
    } catch (error) {
      apiLogger.error(`Failed to get calendars for ${account.account.email}`, error);
    }
  }
  
  // Enrich changed events with display names (Google events only)
  const googleChanged = changed.filter(e => {
    const acct = accounts.find(a => a.account.email === e.accountEmail);
    return !acct || acct.account.type !== "caldav";
  });
  if (googleChanged.length > 0) {
    await enrichEventsWithDisplayNames(googleChanged);
  }
  
  return { changed, deleted, syncTokens, calendarsRequiringFullSync };
}

/**
 * Create a new event
 * Routes to CalDAV or Google Calendar based on account type.
 * @param addGoogleMeet - If true, automatically creates a Google Meet link for the event (Google only)
 */
export async function createEvent(
  event: Partial<GCalEvent>,
  calendarId = "primary",
  accountEmail?: string,
  addGoogleMeet = false
): Promise<GCalEvent> {
  // Check if this is a CalDAV account
  if (accountEmail) {
    const { getAccount } = await import("../auth/tokens.ts");
    const account = await getAccount(accountEmail);
    if (account?.account.type === "caldav" && account.caldavCredentials) {
      return createCalDAVEvent(event, calendarId, accountEmail, account.caldavCredentials);
    }
  }

  // Google Calendar path
  let eventBody: any = { ...event };
  
  // Add Google Meet if requested
  if (addGoogleMeet) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: {
          type: "hangoutsMeet"
        }
      }
    };
  }
  
  // Add conferenceDataVersion param if we're creating a meet
  const params = addGoogleMeet ? "?conferenceDataVersion=1" : "";
  
  const response = await calendarFetch<GoogleCalendarEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events${params}`,
    {
      method: "POST",
      body: JSON.stringify(eventBody),
    },
    accountEmail
  );
  
  return toGCalEvent(response, accountEmail, calendarId);
}

/**
 * Recurrence scope for updates
 */
export type RecurrenceScope = "this" | "following" | "all";

/**
 * Update an existing event
 * Routes to CalDAV or Google Calendar based on account type.
 */
export async function updateEvent(
  eventId: string,
  event: Partial<GCalEvent>,
  calendarId = "primary",
  accountEmail?: string,
  scope?: RecurrenceScope,
  originalEvent?: GCalEvent,
  addGoogleMeet = false
): Promise<GCalEvent> {
  // Check if this is a CalDAV account
  if (accountEmail) {
    const { getAccount } = await import("../auth/tokens.ts");
    const account = await getAccount(accountEmail);
    if (account?.account.type === "caldav" && account.caldavCredentials) {
      return updateCalDAVEvent(eventId, event, calendarId, accountEmail, account.caldavCredentials);
    }
  }

  // Google Calendar path
  let googleId = extractGoogleId(eventId);
  
  if (scope === "all" && originalEvent?.recurringEventId) {
    googleId = originalEvent.recurringEventId;
  }
  
  let eventBody: any = { ...event };
  
  if (addGoogleMeet && !originalEvent?.hangoutLink) {
    eventBody.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: {
          type: "hangoutsMeet"
        }
      }
    };
  }
  
  const params = addGoogleMeet ? "?conferenceDataVersion=1" : "";
  
  const response = await calendarFetch<GoogleCalendarEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleId)}${params}`,
    {
      method: "PATCH",
      body: JSON.stringify(eventBody),
    },
    accountEmail
  );
  
  return toGCalEvent(response, accountEmail, calendarId);
}

/**
 * Delete an event
 * Routes to CalDAV or Google Calendar based on account type.
 */
export async function deleteEvent(
  eventId: string,
  calendarId = "primary",
  sendNotifications = false,
  accountEmail?: string,
  scope?: "this" | "following" | "all",
  recurringEventId?: string
): Promise<void> {
  // Check if this is a CalDAV account
  if (accountEmail) {
    const { getAccount } = await import("../auth/tokens.ts");
    const account = await getAccount(accountEmail);
    if (account?.account.type === "caldav" && account.caldavCredentials) {
      return deleteCalDAVEvent(eventId, calendarId, accountEmail, account.caldavCredentials);
    }
  }

  // Google Calendar path
  let targetId = eventId;
  if (scope === "all" && recurringEventId) {
    targetId = recurringEventId;
  }
  
  const googleId = extractGoogleId(targetId);
  
  const params = new URLSearchParams({
    sendNotifications: String(sendNotifications),
  });
  
  await calendarFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleId)}?${params}`,
    { method: "DELETE" },
    accountEmail
  );
}

/**
 * Update attendance (RSVP) for an event
 * Note: CalDAV RSVP is handled via the same update mechanism
 */
export async function updateAttendance(
  eventId: string,
  responseStatus: "accepted" | "declined" | "tentative",
  calendarId = "primary",
  accountEmail?: string
): Promise<GCalEvent> {
  // For CalDAV accounts, update attendance via event update
  if (accountEmail) {
    const { getAccount } = await import("../auth/tokens.ts");
    const account = await getAccount(accountEmail);
    if (account?.account.type === "caldav") {
      // For CalDAV, we'd need to update the PARTSTAT in the VEVENT
      // For now, just update locally (CalDAV RSVP is more complex)
      throw new Error("RSVP via CalDAV is not yet supported");
    }
  }

  // Google Calendar path
  const googleId = extractGoogleId(eventId);
  
  // To update attendance, we need to get the event first, find ourselves in attendees,
  // and update our responseStatus
  const event = await calendarFetch<GoogleCalendarEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleId)}`,
    {},
    accountEmail
  );
  
  if (!event.attendees) {
    throw new Error("Event has no attendees");
  }
  
  const updatedAttendees = event.attendees.map((a) => {
    if (a.self) {
      return { ...a, responseStatus };
    }
    return a;
  });
  
  return updateEvent(eventId, { attendees: updatedAttendees as any }, calendarId, accountEmail);
}

// ===== Free/Busy API =====

/**
 * Busy time period from Free/Busy API
 */
export interface BusyPeriod {
  start: string; // ISO datetime
  end: string; // ISO datetime
}

/**
 * Free/Busy response for a single calendar
 */
export interface FreeBusyCalendar {
  busy: BusyPeriod[];
  errors?: Array<{ domain: string; reason: string }>;
}

/**
 * Full Free/Busy API response
 */
interface FreeBusyResponse {
  kind: "calendar#freeBusy";
  timeMin: string;
  timeMax: string;
  calendars: Record<string, FreeBusyCalendar>;
}

/**
 * Query free/busy information for multiple people
 * 
 * @param emails - List of email addresses to check
 * @param timeMin - Start of time range (ISO string)
 * @param timeMax - End of time range (ISO string)
 * @param accountEmail - Which account to use for the API call
 * @returns Map of email -> busy periods
 */
export async function queryFreeBusy(
  emails: string[],
  timeMin: string,
  timeMax: string,
  accountEmail?: string
): Promise<Map<string, BusyPeriod[]>> {
  apiLogger.debug("Querying free/busy", { emails, timeMin, timeMax });
  
  const response = await calendarFetch<FreeBusyResponse>(
    "/freeBusy",
    {
      method: "POST",
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: emails.map((email) => ({ id: email })),
      }),
    },
    accountEmail
  );
  
  const result = new Map<string, BusyPeriod[]>();
  
  for (const email of emails) {
    const calendarData = response.calendars[email];
    if (calendarData) {
      if (calendarData.errors && calendarData.errors.length > 0) {
        apiLogger.warn(`Free/busy errors for ${email}`, calendarData.errors);
        // Still include empty array - means we couldn't get their calendar
        result.set(email, []);
      } else {
        result.set(email, calendarData.busy || []);
      }
    } else {
      result.set(email, []);
    }
  }
  
  apiLogger.debug("Free/busy results", {
    emails: emails.length,
    calendarsWithData: Array.from(result.entries()).filter(([_, busy]) => busy.length > 0).length,
  });
  
  return result;
}

/**
 * Query free/busy for the current user (all their calendars)
 */
export async function queryMyFreeBusy(
  timeMin: string,
  timeMax: string
): Promise<BusyPeriod[]> {
  const accounts = await getAccounts();
  const allBusy: BusyPeriod[] = [];
  
  for (const { account } of accounts) {
    try {
      const busyMap = await queryFreeBusy([account.email], timeMin, timeMax, account.email);
      const busy = busyMap.get(account.email) || [];
      allBusy.push(...busy);
    } catch (error) {
      apiLogger.warn(`Failed to get free/busy for ${account.email}`, error);
    }
  }
  
  // Sort and merge overlapping periods
  return mergeBusyPeriods(allBusy);
}

/**
 * Merge overlapping busy periods
 */
function mergeBusyPeriods(periods: BusyPeriod[]): BusyPeriod[] {
  if (periods.length === 0) return [];
  
  // Sort by start time
  const sorted = [...periods].sort((a, b) => a.start.localeCompare(b.start));
  
  const first = sorted[0];
  if (!first) return [];
  
  const merged: BusyPeriod[] = [first];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (!current || !last) continue;
    
    // If current overlaps or is adjacent to last, merge them
    if (current.start <= last.end) {
      last.end = current.end > last.end ? current.end : last.end;
    } else {
      merged.push(current);
    }
  }
  
  return merged;
}
