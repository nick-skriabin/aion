import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  summary: text("summary").notNull(),
  description: text("description"),
  location: text("location"),
  htmlLink: text("html_link"),
  status: text("status").notNull(), // confirmed | tentative | cancelled
  eventType: text("event_type"), // default | outOfOffice | focusTime | birthday
  visibility: text("visibility"), // default | public | private | confidential
  
  // Start time fields
  startDate: text("start_date"), // YYYY-MM-DD for all-day events
  startDateTime: text("start_date_time"), // ISO 8601 for timed events
  startTimeZone: text("start_time_zone"),
  
  // End time fields  
  endDate: text("end_date"),
  endDateTime: text("end_date_time"),
  endTimeZone: text("end_time_zone"),
  
  // Recurrence
  recurrenceJson: text("recurrence_json"), // JSON array of RRULE strings
  recurringEventId: text("recurring_event_id"),
  originalStartJson: text("original_start_json"), // JSON TimeObject
  
  // Participants
  attendeesJson: text("attendees_json"), // JSON array of attendees
  organizerJson: text("organizer_json"), // JSON organizer object
  
  // Links
  hangoutLink: text("hangout_link"),
  
  // Reminders
  remindersJson: text("reminders_json"), // JSON reminders object
  
  // Timestamps
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type EventRow = typeof events.$inferSelect;
export type InsertEventRow = typeof events.$inferInsert;
