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
  start: TimeObjectSchema,
  end: TimeObjectSchema,
  attendees: z.array(AttendeeSchema).optional(),
  organizer: OrganizerSchema.optional(),
  recurrence: z.array(z.string()).optional(), // RRULE lines
  recurringEventId: z.string().optional(),
  originalStartTime: TimeObjectSchema.optional(),
  hangoutLink: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
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
