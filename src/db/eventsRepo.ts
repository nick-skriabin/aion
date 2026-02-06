import { eq } from "drizzle-orm";
import { getDb } from "./db.ts";
import { events, type EventRow, type InsertEventRow } from "./schema.ts";
import type { GCalEvent } from "../domain/gcalEvent.ts";

// Convert GCalEvent to database row
function toRow(event: GCalEvent): InsertEventRow {
  const now = new Date().toISOString();
  return {
    id: event.id,
    summary: event.summary,
    description: event.description ?? null,
    location: event.location ?? null,
    htmlLink: event.htmlLink ?? null,
    status: event.status,
    eventType: event.eventType ?? null,
    startDate: event.start.date ?? null,
    startDateTime: event.start.dateTime ?? null,
    startTimeZone: event.start.timeZone ?? null,
    endDate: event.end.date ?? null,
    endDateTime: event.end.dateTime ?? null,
    endTimeZone: event.end.timeZone ?? null,
    recurrenceJson: event.recurrence ? JSON.stringify(event.recurrence) : null,
    recurringEventId: event.recurringEventId ?? null,
    originalStartJson: event.originalStartTime
      ? JSON.stringify(event.originalStartTime)
      : null,
    attendeesJson: event.attendees ? JSON.stringify(event.attendees) : null,
    organizerJson: event.organizer ? JSON.stringify(event.organizer) : null,
    hangoutLink: event.hangoutLink ?? null,
    createdAt: event.createdAt ?? now,
    updatedAt: event.updatedAt ?? now,
  };
}

// Convert database row to GCalEvent
function fromRow(row: EventRow): GCalEvent {
  return {
    id: row.id,
    summary: row.summary,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    htmlLink: row.htmlLink ?? undefined,
    status: row.status as GCalEvent["status"],
    eventType: (row.eventType as GCalEvent["eventType"]) ?? "default",
    start: {
      date: row.startDate ?? undefined,
      dateTime: row.startDateTime ?? undefined,
      timeZone: row.startTimeZone ?? undefined,
    },
    end: {
      date: row.endDate ?? undefined,
      dateTime: row.endDateTime ?? undefined,
      timeZone: row.endTimeZone ?? undefined,
    },
    recurrence: row.recurrenceJson
      ? (JSON.parse(row.recurrenceJson) as string[])
      : undefined,
    recurringEventId: row.recurringEventId ?? undefined,
    originalStartTime: row.originalStartJson
      ? JSON.parse(row.originalStartJson)
      : undefined,
    attendees: row.attendeesJson ? JSON.parse(row.attendeesJson) : undefined,
    organizer: row.organizerJson ? JSON.parse(row.organizerJson) : undefined,
    hangoutLink: row.hangoutLink ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Repository functions
export const eventsRepo = {
  // Get all events
  async getAll(): Promise<GCalEvent[]> {
    const db = getDb();
    const rows = await db.select().from(events);
    return rows.map(fromRow);
  },

  // Get event by ID
  async getById(id: string): Promise<GCalEvent | null> {
    const db = getDb();
    const rows = await db.select().from(events).where(eq(events.id, id));
    const row = rows[0];
    return row ? fromRow(row) : null;
  },

  // Create a new event
  async create(event: GCalEvent): Promise<GCalEvent> {
    const db = getDb();
    const row = toRow(event);
    await db.insert(events).values(row);
    return event;
  },

  // Update an event
  async update(event: GCalEvent): Promise<GCalEvent> {
    const db = getDb();
    const row = toRow({
      ...event,
      updatedAt: new Date().toISOString(),
    });
    await db.update(events).set(row).where(eq(events.id, event.id));
    return event;
  },

  // Delete an event
  async delete(id: string): Promise<void> {
    const db = getDb();
    await db.delete(events).where(eq(events.id, id));
  },

  // Check if database is empty
  async isEmpty(): Promise<boolean> {
    const db = getDb();
    const rows = await db.select().from(events).limit(1);
    return rows.length === 0;
  },

  // Seed with mock data
  async seed(mockEvents: GCalEvent[]): Promise<void> {
    const db = getDb();
    const rows = mockEvents.map(toRow);
    for (const row of rows) {
      await db.insert(events).values(row);
    }
  },

  // Clear all events (for testing)
  async clear(): Promise<void> {
    const db = getDb();
    await db.delete(events);
  },
};
