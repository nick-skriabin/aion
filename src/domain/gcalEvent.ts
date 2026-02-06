import { z } from "zod";

// Google Calendar Event Response Status
export const ResponseStatusSchema = z.enum([
  "needsAction",
  "declined",
  "tentative",
  "accepted",
]);
export type ResponseStatus = z.infer<typeof ResponseStatusSchema>;

// Event Status
export const EventStatusSchema = z.enum(["confirmed", "tentative", "cancelled"]);
export type EventStatus = z.infer<typeof EventStatusSchema>;

// Event Type
export const EventTypeSchema = z.enum([
  "default",
  "outOfOffice",
  "focusTime",
  "birthday",
]);
export type EventType = z.infer<typeof EventTypeSchema>;

// Visibility
export const VisibilitySchema = z.enum([
  "default",
  "public", 
  "private",
  "confidential",
]);
export type Visibility = z.infer<typeof VisibilitySchema>;

// Reminder
export const ReminderSchema = z.object({
  method: z.enum(["email", "popup"]),
  minutes: z.number(),
});
export type Reminder = z.infer<typeof ReminderSchema>;

// Reminders config
export const RemindersSchema = z.object({
  useDefault: z.boolean().optional(),
  overrides: z.array(ReminderSchema).optional(),
});
export type Reminders = z.infer<typeof RemindersSchema>;

// Time object (Google Calendar style)
export const TimeObjectSchema = z.object({
  date: z.string().optional(), // YYYY-MM-DD for all-day
  dateTime: z.string().optional(), // ISO 8601 for timed
  timeZone: z.string().optional(),
});
export type TimeObject = z.infer<typeof TimeObjectSchema>;

// Attendee
export const AttendeeSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  responseStatus: ResponseStatusSchema.optional(),
  organizer: z.boolean().optional(),
  self: z.boolean().optional(),
});
export type Attendee = z.infer<typeof AttendeeSchema>;

// Organizer
export const OrganizerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  self: z.boolean().optional(),
});
export type Organizer = z.infer<typeof OrganizerSchema>;

// Full Google Calendar Event Schema
export const GCalEventSchema = z.object({
  id: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  htmlLink: z.string().optional(),
  status: EventStatusSchema,
  eventType: EventTypeSchema.optional().default("default"),
  visibility: VisibilitySchema.optional(),
  start: TimeObjectSchema,
  end: TimeObjectSchema,
  attendees: z.array(AttendeeSchema).optional(),
  organizer: OrganizerSchema.optional(),
  recurrence: z.array(z.string()).optional(), // RRULE lines
  recurringEventId: z.string().optional(),
  originalStartTime: TimeObjectSchema.optional(),
  hangoutLink: z.string().optional(),
  reminders: RemindersSchema.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  // Multi-account support
  accountEmail: z.string().optional(), // Which account this event belongs to
  calendarId: z.string().optional(), // Which calendar this event belongs to
});

export type GCalEvent = z.infer<typeof GCalEventSchema>;

// Helpers to check event properties
export function isAllDay(event: GCalEvent): boolean {
  return !!event.start.date && !event.start.dateTime;
}

export function isRecurring(event: GCalEvent): boolean {
  return (
    (event.recurrence && event.recurrence.length > 0) ||
    !!event.recurringEventId
  );
}

export function hasOtherAttendees(event: GCalEvent): boolean {
  if (!event.attendees) return false;
  return event.attendees.some((a) => !a.self && !a.organizer);
}

export function getDisplayTitle(event: GCalEvent): string {
  return event.summary?.trim() || "(No title)";
}

// Event type display helpers
export function getEventTypeLabel(type: EventType): string {
  switch (type) {
    case "outOfOffice":
      return "Out of office";
    case "focusTime":
      return "Focus time";
    case "birthday":
      return "Birthday";
    default:
      return "Event";
  }
}

export function getEventTypeColor(type: EventType | undefined): string {
  switch (type) {
    case "outOfOffice":
      return "#ec407a"; // pink
    case "focusTime":
      return "#7c4dff"; // purple
    case "birthday":
      return "#ffb300"; // amber
    default:
      return "#4285f4"; // Google blue
  }
}

// Response status helpers
export function getResponseStatusIcon(status: ResponseStatus | undefined): string {
  switch (status) {
    case "accepted":
      return "✓";
    case "declined":
      return "✗";
    case "tentative":
      return "?";
    case "needsAction":
    default:
      return "○";
  }
}

// Visibility helpers
export function getVisibilityLabel(visibility: Visibility | undefined): string {
  switch (visibility) {
    case "public":
      return "Public";
    case "private":
      return "Private";
    case "confidential":
      return "Confidential";
    default:
      return "Busy";
  }
}

// Recurrence helpers - parse RRULE to human readable
export function parseRecurrenceRule(recurrence: string[] | undefined): string | null {
  if (!recurrence || recurrence.length === 0) return null;
  
  const rrule = recurrence.find((r) => r.startsWith("RRULE:"));
  if (!rrule) return null;
  
  const rule = rrule.replace("RRULE:", "");
  const parts = rule.split(";").reduce((acc, part) => {
    const [key, value] = part.split("=");
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  
  const freq = parts.FREQ?.toLowerCase();
  const interval = parts.INTERVAL ? parseInt(parts.INTERVAL) : 1;
  const byday = parts.BYDAY;
  
  if (!freq) return null;
  
  // Format frequency
  let result = "";
  if (interval === 1) {
    switch (freq) {
      case "daily":
        result = "Daily";
        break;
      case "weekly":
        result = "Weekly";
        break;
      case "monthly":
        result = "Monthly";
        break;
      case "yearly":
        result = "Yearly";
        break;
      default:
        result = freq;
    }
  } else {
    switch (freq) {
      case "daily":
        result = `Every ${interval} days`;
        break;
      case "weekly":
        result = `Every ${interval} weeks`;
        break;
      case "monthly":
        result = `Every ${interval} months`;
        break;
      case "yearly":
        result = `Every ${interval} years`;
        break;
      default:
        result = `Every ${interval} ${freq}`;
    }
  }
  
  // Add days if weekly
  if (byday && freq === "weekly") {
    const dayMap: Record<string, string> = {
      MO: "Mon",
      TU: "Tue",
      WE: "Wed",
      TH: "Thu",
      FR: "Fri",
      SA: "Sat",
      SU: "Sun",
    };
    const days = byday.split(",").map((d) => dayMap[d] || d).join(", ");
    result += ` on ${days}`;
  }
  
  return result;
}

// Reminder helpers
export function formatReminder(minutes: number, method: "email" | "popup"): string {
  const methodLabel = method === "email" ? "Email" : "Notification";
  
  if (minutes === 0) {
    return `${methodLabel} at event time`;
  } else if (minutes < 60) {
    return `${methodLabel} ${minutes} min before`;
  } else if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    return `${methodLabel} ${hours} hr${hours > 1 ? "s" : ""} before`;
  } else {
    const days = Math.floor(minutes / 1440);
    return `${methodLabel} ${days} day${days > 1 ? "s" : ""} before`;
  }
}
