import { DateTime } from "luxon";
import type { GCalEvent, EventType, Visibility, Reminders } from "./gcalEvent.ts";
import { getLocalTimezone } from "./time.ts";

// Generate a random ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Create a mock event
function createEvent(
  summary: string,
  start: DateTime,
  end: DateTime,
  options: {
    isAllDay?: boolean;
    eventType?: EventType;
    description?: string;
    location?: string;
    attendees?: Array<{ email: string; displayName?: string; responseStatus?: "needsAction" | "declined" | "tentative" | "accepted"; self?: boolean }>;
    recurrence?: string[];
    htmlLink?: string;
    hangoutLink?: string;
    visibility?: Visibility;
    reminders?: Reminders;
  } = {}
): GCalEvent {
  const tz = getLocalTimezone();
  const now = DateTime.now().toISO() ?? new Date().toISOString();

  if (options.isAllDay) {
    return {
      id: generateId(),
      summary,
      status: "confirmed",
      eventType: options.eventType || "default",
      visibility: options.visibility,
      start: { date: start.toFormat("yyyy-MM-dd") },
      end: { date: end.toFormat("yyyy-MM-dd") },
      description: options.description,
      location: options.location,
      attendees: options.attendees,
      recurrence: options.recurrence,
      htmlLink: options.htmlLink || `https://calendar.google.com/event?eid=${generateId()}`,
      hangoutLink: options.hangoutLink,
      reminders: options.reminders,
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    id: generateId(),
    summary,
    status: "confirmed",
    eventType: options.eventType || "default",
    visibility: options.visibility,
    start: { dateTime: start.toISO() ?? undefined, timeZone: tz },
    end: { dateTime: end.toISO() ?? undefined, timeZone: tz },
    description: options.description,
    location: options.location,
    attendees: options.attendees,
    recurrence: options.recurrence,
    htmlLink: options.htmlLink || `https://calendar.google.com/event?eid=${generateId()}`,
    hangoutLink: options.hangoutLink,
    reminders: options.reminders,
    createdAt: now,
    updatedAt: now,
  };
}

// Generate seed data for the calendar
export function generateSeedData(): GCalEvent[] {
  const today = DateTime.now().startOf("day");
  const events: GCalEvent[] = [];

  // ===== TODAY - With overlapping events like the screenshot =====

  // Long focus time block (10 AM - 3 PM) - like the screenshot
  events.push(
    createEvent(
      "Focus Time",
      today.set({ hour: 10, minute: 0 }),
      today.set({ hour: 15, minute: 0 }),
      {
        eventType: "focusTime",
        description: "Deep work block - no interruptions",
        visibility: "private",
        reminders: {
          overrides: [
            { method: "popup", minutes: 10 },
          ],
        },
      }
    )
  );

  // Out of Office overlapping with Focus Time (1:15 PM - 3:30 PM)
  events.push(
    createEvent(
      "Nick OOO",
      today.set({ hour: 13, minute: 15 }),
      today.set({ hour: 15, minute: 30 }),
      {
        eventType: "outOfOffice",
        description: "Out for personal errand",
      }
    )
  );

  // Veterinary appointment overlapping (2 PM - 3 PM)
  events.push(
    createEvent(
      "Veterinary",
      today.set({ hour: 14, minute: 0 }),
      today.set({ hour: 15, minute: 0 }),
      {
        location: "Pet Clinic, 456 Oak Ave",
        description: "Annual checkup for Max",
      }
    )
  );

  // Meeting right after overlaps (3:30 PM - 4:20 PM)
  events.push(
    createEvent(
      "Front-End Guild's Chapter",
      today.set({ hour: 15, minute: 30 }),
      today.set({ hour: 16, minute: 20 }),
      {
        description: "Weekly front-end engineering sync",
        attendees: [
          { email: "me@example.com", displayName: "Me", responseStatus: "accepted", self: true },
          { email: "frontend@example.com", displayName: "FE Team", responseStatus: "accepted" },
        ],
        hangoutLink: "https://meet.google.com/fe-guild",
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=TH"],
        reminders: {
          overrides: [
            { method: "popup", minutes: 10 },
            { method: "email", minutes: 1440 }, // 1 day before
          ],
        },
      }
    )
  );

  // Evening event
  events.push(
    createEvent(
      "Gym",
      today.set({ hour: 17, minute: 30 }),
      today.set({ hour: 18, minute: 30 }),
      {
        location: "Fitness Center",
      }
    )
  );

  // Morning standup
  events.push(
    createEvent(
      "Daily Standup",
      today.set({ hour: 9, minute: 30 }),
      today.set({ hour: 9, minute: 45 }),
      {
        description: "Quick sync with the team",
        attendees: [
          { email: "me@example.com", displayName: "Me", responseStatus: "accepted", self: true },
          { email: "alice@example.com", displayName: "Alice Chen", responseStatus: "accepted" },
          { email: "bob@example.com", displayName: "Bob Smith", responseStatus: "accepted" },
        ],
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"],
        hangoutLink: "https://meet.google.com/abc-defg-hij",
        reminders: {
          overrides: [
            { method: "popup", minutes: 5 },
          ],
        },
      }
    )
  );

  // ===== TOMORROW =====
  const tomorrow = today.plus({ days: 1 });

  // Birthday (all-day)
  events.push(
    createEvent(
      "Emma's Birthday",
      tomorrow,
      tomorrow.plus({ days: 1 }),
      {
        isAllDay: true,
        eventType: "birthday",
        description: "Don't forget to send a card!",
      }
    )
  );

  // Multiple overlapping meetings tomorrow
  events.push(
    createEvent(
      "Product Demo",
      tomorrow.set({ hour: 11, minute: 0 }),
      tomorrow.set({ hour: 12, minute: 0 }),
      {
        location: "Conference Room A",
        description: "Demo the new features to stakeholders",
        attendees: [
          { email: "stakeholder@example.com", displayName: "Chris Davis", responseStatus: "accepted" },
        ],
        hangoutLink: "https://meet.google.com/demo-call",
      }
    )
  );

  events.push(
    createEvent(
      "Investor Call",
      tomorrow.set({ hour: 11, minute: 30 }),
      tomorrow.set({ hour: 12, minute: 30 }),
      {
        description: "Q4 results discussion",
        attendees: [
          { email: "cfo@example.com", displayName: "CFO", responseStatus: "accepted" },
        ],
      }
    )
  );

  events.push(
    createEvent(
      "Team Retrospective",
      tomorrow.set({ hour: 15, minute: 0 }),
      tomorrow.set({ hour: 16, minute: 30 }),
      {
        description: "Sprint retrospective",
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=FR"],
      }
    )
  );

  // ===== DAY AFTER TOMORROW =====
  const dayAfter = today.plus({ days: 2 });

  events.push(
    createEvent(
      "Doctor Appointment",
      dayAfter.set({ hour: 9, minute: 0 }),
      dayAfter.set({ hour: 10, minute: 30 }),
      {
        eventType: "outOfOffice",
        location: "City Medical Center",
      }
    )
  );

  // Three overlapping meetings
  events.push(
    createEvent(
      "Architecture Discussion",
      dayAfter.set({ hour: 13, minute: 0 }),
      dayAfter.set({ hour: 14, minute: 30 }),
      {
        description: "Microservices vs monolith",
        attendees: [
          { email: "architect@example.com", displayName: "Tech Lead", responseStatus: "accepted" },
        ],
      }
    )
  );

  events.push(
    createEvent(
      "Code Review",
      dayAfter.set({ hour: 13, minute: 30 }),
      dayAfter.set({ hour: 14, minute: 0 }),
      {
        description: "Review PR #1234",
      }
    )
  );

  events.push(
    createEvent(
      "Quick Sync",
      dayAfter.set({ hour: 13, minute: 45 }),
      dayAfter.set({ hour: 14, minute: 15 }),
      {
        attendees: [
          { email: "pm@example.com", displayName: "PM", responseStatus: "tentative" },
        ],
      }
    )
  );

  // ===== YESTERDAY =====
  const yesterday = today.minus({ days: 1 });

  events.push(
    createEvent(
      "Sprint Planning",
      yesterday.set({ hour: 10, minute: 0 }),
      yesterday.set({ hour: 11, minute: 30 }),
      {
        description: "Plan the upcoming sprint",
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=TH"],
      }
    )
  );

  events.push(
    createEvent(
      "Yoga Class",
      yesterday.set({ hour: 18, minute: 0 }),
      yesterday.set({ hour: 19, minute: 0 }),
      {
        location: "Fitness Center",
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"],
      }
    )
  );

  // ===== NEXT WEEK =====
  const nextWeek = today.plus({ days: 5 });

  events.push(
    createEvent(
      "Team Offsite",
      nextWeek,
      nextWeek.plus({ days: 1 }),
      {
        isAllDay: true,
        location: "Mountain View Office",
        description: "Annual team building",
      }
    )
  );

  events.push(
    createEvent(
      "Conference Talk Prep",
      nextWeek.set({ hour: 14, minute: 0 }),
      nextWeek.set({ hour: 16, minute: 0 }),
      {
        eventType: "focusTime",
        description: "Prepare slides",
      }
    )
  );

  return events;
}
