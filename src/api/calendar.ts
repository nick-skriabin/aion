/**
 * Google Calendar API client (multi-account support)
 */

import { getValidAccessToken, getValidAccessTokenForAccount, getAccounts } from "../auth/tokens.ts";
import type { GCalEvent } from "../domain/gcalEvent.ts";
import { apiLogger } from "../lib/logger.ts";
import { makeCompositeId, extractGoogleId } from "../db/eventsRepo.ts";

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
  
  return response.json();
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
  const response = await calendarFetch<{ items: CalendarListEntry[] }>(
    "/users/me/calendarList",
    {},
    accountEmail
  );
  // Tag each calendar with its account
  return (response.items || []).map((cal) => ({
    ...cal,
    accountEmail,
  }));
}

/**
 * Get list of all calendars across all accounts
 */
export async function getAllCalendars(): Promise<CalendarListEntry[]> {
  const accounts = await getAccounts();
  const allCalendars: CalendarListEntry[] = [];
  
  for (const account of accounts) {
    try {
      const calendars = await getCalendarListForAccount(account.account.email);
      allCalendars.push(...calendars);
    } catch (error) {
      apiLogger.error(`Failed to fetch calendars for ${account.account.email}`, error);
    }
  }
  
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
    email?: string;
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
 * Convert Google Calendar event to our GCalEvent format
 * The ID is converted to a composite ID (accountEmail:calendarId:googleId) for global uniqueness
 */
function toGCalEvent(event: GoogleCalendarEvent, accountEmail?: string, calendarId?: string): GCalEvent {
  // Create composite ID for global uniqueness across accounts and calendars
  const compositeId = makeCompositeId(accountEmail, event.id, calendarId);
  return {
    id: compositeId,
    status: event.status as "confirmed" | "tentative" | "cancelled",
    summary: event.summary,
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
    created: event.created,
    updated: event.updated,
    creator: event.creator,
    organizer: event.organizer,
    attendees: event.attendees?.map((a) => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus as "needsAction" | "declined" | "tentative" | "accepted" | undefined,
      self: a.self,
      organizer: a.organizer,
    })),
    hangoutLink: event.hangoutLink,
    conferenceData: event.conferenceData,
    recurringEventId: event.recurringEventId,
    recurrence: event.recurrence,
    eventType: event.eventType as "default" | "outOfOffice" | "focusTime" | "workingLocation" | "birthday" | undefined,
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
 * Fetch events from a calendar within a date range
 */
export async function fetchEvents(options: {
  calendarId?: string;
  timeMin: string; // ISO date string
  timeMax: string; // ISO date string
  maxResults?: number;
  accountEmail?: string;
}): Promise<GCalEvent[]> {
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
  } while (pageToken);
  
  return allEvents;
}

/**
 * Fetch events from all accounts and calendars
 */
export async function fetchAllEvents(options: {
  timeMin: string;
  timeMax: string;
  maxResults?: number;
}): Promise<GCalEvent[]> {
  const accounts = await getAccounts();
  const allEvents: GCalEvent[] = [];
  
  for (const account of accounts) {
    try {
      // Get all calendars for this account
      const calendars = await getCalendarListForAccount(account.account.email);
      
      // Fetch events from each calendar
      for (const calendar of calendars) {
        try {
          const events = await fetchEvents({
            calendarId: calendar.id,
            timeMin: options.timeMin,
            timeMax: options.timeMax,
            maxResults: options.maxResults,
            accountEmail: account.account.email,
          });
          allEvents.push(...events);
          apiLogger.debug(`Fetched ${events.length} events from ${calendar.summary}`);
        } catch (error) {
          apiLogger.error(`Failed to fetch events for calendar ${calendar.summary}`, error);
        }
      }
    } catch (error) {
      apiLogger.error(`Failed to fetch calendars for ${account.account.email}`, error);
    }
  }
  
  return allEvents;
}

/**
 * Create a new event
 */
export async function createEvent(
  event: Partial<GCalEvent>,
  calendarId = "primary",
  accountEmail?: string
): Promise<GCalEvent> {
  const response = await calendarFetch<GoogleCalendarEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      body: JSON.stringify(event),
    },
    accountEmail
  );
  
  return toGCalEvent(response, accountEmail, calendarId);
}

/**
 * Update an existing event
 * @param eventId - The composite ID (accountEmail:googleId) or just googleId for local events
 */
export async function updateEvent(
  eventId: string,
  event: Partial<GCalEvent>,
  calendarId = "primary",
  accountEmail?: string
): Promise<GCalEvent> {
  // Extract the Google ID from composite ID for API call
  const googleId = extractGoogleId(eventId);
  
  const response = await calendarFetch<GoogleCalendarEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(event),
    },
    accountEmail
  );
  
  return toGCalEvent(response, accountEmail, calendarId);
}

/**
 * Delete an event
 * @param eventId - The composite ID (accountEmail:googleId) or just googleId for local events
 */
export async function deleteEvent(
  eventId: string,
  calendarId = "primary",
  sendNotifications = false,
  accountEmail?: string
): Promise<void> {
  // Extract the Google ID from composite ID for API call
  const googleId = extractGoogleId(eventId);
  
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
 * @param eventId - The composite ID (accountEmail:googleId) or just googleId for local events
 */
export async function updateAttendance(
  eventId: string,
  responseStatus: "accepted" | "declined" | "tentative",
  calendarId = "primary",
  accountEmail?: string
): Promise<GCalEvent> {
  // Extract the Google ID from composite ID for API call
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
