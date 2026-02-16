/**
 * iCalendar (RFC 5545) ↔ GCalEvent converter
 * Handles parsing iCalendar VEVENT data and generating iCalendar from events.
 */

import type { GCalEvent, Attendee, Organizer } from "../domain/gcalEvent.ts";
import { makeCompositeId } from "../db/eventsRepo.ts";

// ===== iCalendar Parsing =====

interface ICalProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

/**
 * Unfold iCalendar lines (RFC 5545 §3.1)
 * Lines starting with a space or tab are continuations of the previous line.
 */
function unfoldLines(text: string): string[] {
  const lines: string[] = [];
  const rawLines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  for (const line of rawLines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      // Continuation of previous line
      if (lines.length > 0) {
        lines[lines.length - 1] += line.slice(1);
      }
    } else {
      lines.push(line);
    }
  }

  return lines;
}

/**
 * Parse a single iCalendar property line into name, params, and value.
 * Format: NAME;PARAM1=VAL1;PARAM2=VAL2:VALUE
 */
function parseProperty(line: string): ICalProperty {
  // Find the first unquoted colon that separates name+params from value
  let colonIdx = -1;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuotes = !inQuotes;
    if (line[i] === ':' && !inQuotes) {
      colonIdx = i;
      break;
    }
  }

  if (colonIdx === -1) {
    return { name: line, params: {}, value: "" };
  }

  const nameAndParams = line.substring(0, colonIdx);
  const value = line.substring(colonIdx + 1);

  // Split name from params
  const parts = nameAndParams.split(";");
  const name = (parts[0] || "").toUpperCase();
  const params: Record<string, string> = {};

  for (let i = 1; i < parts.length; i++) {
    const eqIdx = (parts[i] || "").indexOf("=");
    if (eqIdx > 0) {
      const pName = (parts[i] || "").substring(0, eqIdx).toUpperCase();
      let pValue = (parts[i] || "").substring(eqIdx + 1);
      // Remove surrounding quotes
      if (pValue.startsWith('"') && pValue.endsWith('"')) {
        pValue = pValue.slice(1, -1);
      }
      params[pName] = pValue;
    }
  }

  return { name, params, value };
}

/**
 * Unescape iCalendar text values (RFC 5545 §3.3.11)
 */
function unescapeText(text: string): string {
  return text
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/**
 * Convert iCalendar date/time to ISO format
 * Handles: 20240101T090000Z, 20240101T090000, 20240101
 */
function icalDateToISO(value: string, tzid?: string): { dateTime?: string; date?: string; timeZone?: string } {
  // All-day date: YYYYMMDD
  if (value.length === 8 && !value.includes("T")) {
    const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    return { date };
  }

  // Date-time: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const isUTC = value.endsWith("Z");
  const clean = value.replace("Z", "");

  const year = clean.slice(0, 4);
  const month = clean.slice(4, 6);
  const day = clean.slice(6, 8);
  const hour = clean.slice(9, 11);
  const minute = clean.slice(11, 13);
  const second = clean.slice(13, 15);

  let dateTime = `${year}-${month}-${day}T${hour}:${minute}:${second}`;

  if (isUTC) {
    dateTime += "Z";
    return { dateTime, timeZone: "UTC" };
  }

  if (tzid) {
    // Luxon/JS can handle timezone-aware ISO strings with offset,
    // but Google Calendar style uses timeZone separately
    return { dateTime, timeZone: tzid };
  }

  return { dateTime };
}

/**
 * Extract email from iCalendar ORGANIZER/ATTENDEE value
 * Format: mailto:email@example.com or just email@example.com
 */
function extractEmail(value: string): string {
  return value.replace(/^mailto:/i, "").trim();
}

/**
 * Map iCalendar PARTSTAT to Google Calendar responseStatus
 */
function partstatToResponseStatus(partstat?: string): "needsAction" | "declined" | "tentative" | "accepted" | undefined {
  switch (partstat?.toUpperCase()) {
    case "ACCEPTED": return "accepted";
    case "DECLINED": return "declined";
    case "TENTATIVE": return "tentative";
    case "NEEDS-ACTION": return "needsAction";
    default: return undefined;
  }
}

/**
 * Map Google Calendar responseStatus to iCalendar PARTSTAT
 */
function responseStatusToPartstat(status?: string): string {
  switch (status) {
    case "accepted": return "ACCEPTED";
    case "declined": return "DECLINED";
    case "tentative": return "TENTATIVE";
    case "needsAction": return "NEEDS-ACTION";
    default: return "NEEDS-ACTION";
  }
}

/**
 * Map iCalendar STATUS to our event status
 */
function icalStatusToEventStatus(status?: string): "confirmed" | "tentative" | "cancelled" {
  switch (status?.toUpperCase()) {
    case "CONFIRMED": return "confirmed";
    case "TENTATIVE": return "tentative";
    case "CANCELLED": return "cancelled";
    default: return "confirmed";
  }
}

/**
 * Parse an iCalendar DURATION value (RFC 5545 §3.3.6)
 * Format: [+/-]P[nW] or [+/-]P[nD][T[nH][nM][nS]]
 * Examples: PT1H, PT30M, P1D, P1DT2H30M, P1W
 */
function parseDuration(value: string): { weeks?: number; days?: number; hours?: number; minutes?: number; seconds?: number } {
  const result: { weeks?: number; days?: number; hours?: number; minutes?: number; seconds?: number } = {};
  const str = value.replace(/^[+-]/, ""); // Strip sign

  const weekMatch = str.match(/P(\d+)W/);
  if (weekMatch) {
    result.weeks = parseInt(weekMatch[1], 10);
    return result;
  }

  const dayMatch = str.match(/P(\d+)D/);
  if (dayMatch) result.days = parseInt(dayMatch[1], 10);

  const timeMatch = str.match(/T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (timeMatch) {
    if (timeMatch[1]) result.hours = parseInt(timeMatch[1], 10);
    if (timeMatch[2]) result.minutes = parseInt(timeMatch[2], 10);
    if (timeMatch[3]) result.seconds = parseInt(timeMatch[3], 10);
  }

  return result;
}

/**
 * Apply a DURATION to a start time, returning the end time in the same format.
 */
function applyDuration(
  start: { dateTime?: string; date?: string; timeZone?: string },
  rawStart: string,
  durationValue: string,
  tzid?: string
): { dateTime?: string; date?: string; timeZone?: string } {
  const dur = parseDuration(durationValue);
  const totalMs =
    (dur.weeks || 0) * 7 * 24 * 3600000 +
    (dur.days || 0) * 24 * 3600000 +
    (dur.hours || 0) * 3600000 +
    (dur.minutes || 0) * 60000 +
    (dur.seconds || 0) * 1000;

  if (start.date && !start.dateTime) {
    // All-day event — add days
    const d = new Date(start.date + "T00:00:00Z");
    d.setTime(d.getTime() + totalMs);
    const endDate = d.toISOString().slice(0, 10);
    return { date: endDate };
  }

  if (start.dateTime) {
    const d = new Date(start.dateTime);
    d.setTime(d.getTime() + totalMs);
    // Preserve the original format
    if (start.dateTime.endsWith("Z")) {
      return { dateTime: d.toISOString(), timeZone: "UTC" };
    }
    // For non-UTC, rebuild the local-format ISO string
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateTime = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return { dateTime, timeZone: start.timeZone };
  }

  return start;
}

/**
 * Parse a single VEVENT block from iCalendar lines into a GCalEvent.
 */
function parseVEvent(
  lines: string[],
  accountEmail?: string,
  calendarId?: string
): GCalEvent | null {
  const props = new Map<string, ICalProperty[]>();

  for (const line of lines) {
    if (line === "BEGIN:VEVENT" || line === "END:VEVENT") continue;
    const prop = parseProperty(line);
    if (!props.has(prop.name)) {
      props.set(prop.name, []);
    }
    props.get(prop.name)!.push(prop);
  }

  const uid = props.get("UID")?.[0]?.value;
  if (!uid) return null;

  const compositeId = makeCompositeId(accountEmail, uid, calendarId);

  // Parse start/end times
  const dtstart = props.get("DTSTART")?.[0];
  const dtend = props.get("DTEND")?.[0];
  const duration = props.get("DURATION")?.[0];

  if (!dtstart) return null;

  const start = icalDateToISO(dtstart.value, dtstart.params.TZID);

  let end: { dateTime?: string; date?: string; timeZone?: string };
  if (dtend) {
    end = icalDateToISO(dtend.value, dtend.params.TZID);
  } else if (duration) {
    // Parse ISO 8601 duration and calculate end time
    end = applyDuration(start, dtstart.value, duration.value, dtstart.params.TZID);
  } else {
    end = start;
  }

  // Parse attendees
  const attendeeProps = props.get("ATTENDEE") || [];
  const attendees: Attendee[] = attendeeProps.map((a) => ({
    email: extractEmail(a.value),
    displayName: a.params.CN || undefined,
    responseStatus: partstatToResponseStatus(a.params.PARTSTAT),
    organizer: a.params.ROLE === "CHAIR" ? true : undefined,
  }));

  // Parse organizer
  const organizerProp = props.get("ORGANIZER")?.[0];
  const organizer: Organizer | undefined = organizerProp
    ? {
        email: extractEmail(organizerProp.value),
        displayName: organizerProp.params.CN || undefined,
      }
    : undefined;

  // Parse recurrence
  const rruleProps = props.get("RRULE") || [];
  const recurrence = rruleProps.length > 0
    ? rruleProps.map((r) => `RRULE:${r.value}`)
    : undefined;

  const recurringEventId = props.get("RECURRENCE-ID")?.[0]?.value || undefined;

  // Parse status
  const status = icalStatusToEventStatus(props.get("STATUS")?.[0]?.value);

  // Parse timestamps
  const created = props.get("CREATED")?.[0]?.value;
  const lastModified = props.get("LAST-MODIFIED")?.[0]?.value;

  return {
    id: compositeId,
    summary: unescapeText(props.get("SUMMARY")?.[0]?.value || ""),
    description: props.get("DESCRIPTION")?.[0]?.value
      ? unescapeText(props.get("DESCRIPTION")[0]!.value)
      : undefined,
    location: props.get("LOCATION")?.[0]?.value
      ? unescapeText(props.get("LOCATION")[0]!.value)
      : undefined,
    status,
    eventType: "default",
    start,
    end,
    attendees: attendees.length > 0 ? attendees : undefined,
    organizer,
    recurrence,
    recurringEventId,
    createdAt: created ? icalTimestampToISO(created) : undefined,
    updatedAt: lastModified ? icalTimestampToISO(lastModified) : undefined,
    accountEmail,
    calendarId,
  };
}

/**
 * Convert iCalendar timestamp (YYYYMMDDTHHMMSSZ) to ISO string
 */
function icalTimestampToISO(value: string): string {
  const result = icalDateToISO(value);
  return result.dateTime || result.date || new Date().toISOString();
}

/**
 * Parse iCalendar data (one or more VEVENTs) into GCalEvents.
 */
export function parseICalendar(
  icalData: string,
  accountEmail?: string,
  calendarId?: string
): GCalEvent[] {
  const lines = unfoldLines(icalData);
  const events: GCalEvent[] = [];

  let inVEvent = false;
  let eventLines: string[] = [];

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inVEvent = true;
      eventLines = [line];
    } else if (line === "END:VEVENT") {
      eventLines.push(line);
      inVEvent = false;
      const event = parseVEvent(eventLines, accountEmail, calendarId);
      if (event) {
        events.push(event);
      }
    } else if (inVEvent) {
      eventLines.push(line);
    }
  }

  return events;
}

// ===== iCalendar Generation =====

/**
 * Escape text for iCalendar (RFC 5545 §3.3.11)
 */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Convert ISO date/time to iCalendar format
 */
function isoToICalDate(dateTime?: string, date?: string, timeZone?: string): { value: string; params: string } {
  if (date && !dateTime) {
    // All-day: YYYYMMDD
    const cleaned = date.replace(/-/g, "");
    return { value: cleaned, params: ";VALUE=DATE" };
  }

  if (dateTime) {
    // Parse the ISO datetime
    const dt = new Date(dateTime);
    const isUTC = dateTime.endsWith("Z") || timeZone === "UTC";

    if (isUTC) {
      const pad = (n: number) => String(n).padStart(2, "0");
      const value = `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`;
      return { value, params: "" };
    }

    // With timezone
    // We need to format in the local timezone representation
    // Since the dateTime might already be in local format (no Z), just strip formatting
    const cleaned = dateTime.replace(/[-:]/g, "").replace(/\.\d+/, "");
    // Ensure format is YYYYMMDDTHHMMSS
    const match = cleaned.match(/^(\d{8}T\d{6})/);
    const value = match ? match[1] : cleaned;

    if (timeZone && timeZone !== "UTC") {
      return { value, params: `;TZID=${timeZone}` };
    }
    return { value, params: "" };
  }

  return { value: "", params: "" };
}

/**
 * Fold long lines per RFC 5545 §3.1 (max 75 octets per line)
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;

  const parts: string[] = [];
  parts.push(line.substring(0, 75));
  let remaining = line.substring(75);

  while (remaining.length > 0) {
    parts.push(" " + remaining.substring(0, 74));
    remaining = remaining.substring(74);
  }

  return parts.join("\r\n");
}

/**
 * Generate an iCalendar VCALENDAR containing a single VEVENT from a GCalEvent.
 * Used for CalDAV PUT requests.
 */
export function generateICalendar(event: GCalEvent, uid?: string): string {
  const lines: string[] = [];

  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Aion//Calendar//EN");
  lines.push("BEGIN:VEVENT");

  // UID - use the original UID or generate one
  const eventUid = uid || event.id || crypto.randomUUID();
  lines.push(`UID:${eventUid}`);

  // Timestamps
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}T${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}Z`;
  lines.push(`DTSTAMP:${stamp}`);

  // Start/End
  const start = isoToICalDate(event.start?.dateTime, event.start?.date, event.start?.timeZone);
  const end = isoToICalDate(event.end?.dateTime, event.end?.date, event.end?.timeZone);
  if (start.value) lines.push(`DTSTART${start.params}:${start.value}`);
  if (end.value) lines.push(`DTEND${end.params}:${end.value}`);

  // Summary
  if (event.summary) {
    lines.push(`SUMMARY:${escapeText(event.summary)}`);
  }

  // Description
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }

  // Location
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }

  // Status
  lines.push(`STATUS:${event.status?.toUpperCase() || "CONFIRMED"}`);

  // Organizer
  if (event.organizer) {
    const cnParam = event.organizer.displayName ? `;CN=${event.organizer.displayName}` : "";
    lines.push(`ORGANIZER${cnParam}:mailto:${event.organizer.email}`);
  }

  // Attendees
  if (event.attendees) {
    for (const attendee of event.attendees) {
      const params: string[] = [];
      if (attendee.displayName) params.push(`CN=${attendee.displayName}`);
      if (attendee.responseStatus) params.push(`PARTSTAT=${responseStatusToPartstat(attendee.responseStatus)}`);
      const paramStr = params.length > 0 ? ";" + params.join(";") : "";
      lines.push(`ATTENDEE${paramStr}:mailto:${attendee.email}`);
    }
  }

  // Recurrence
  if (event.recurrence) {
    for (const rule of event.recurrence) {
      // Rules are stored as "RRULE:FREQ=..." - just output them directly
      lines.push(rule);
    }
  }

  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  // Fold long lines and join with CRLF
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * Extract the UID from an iCalendar VEVENT
 */
export function extractUID(icalData: string): string | null {
  const lines = unfoldLines(icalData);
  for (const line of lines) {
    if (line.startsWith("UID:")) {
      return line.substring(4).trim();
    }
  }
  return null;
}
