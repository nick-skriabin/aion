import { DateTime } from "luxon";
import type { GCalEvent, EventType } from "./gcalEvent.ts";
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
    attendees?: Array<{ email: string; displayName?: string; responseStatus?: "needsAction" | "declined" | "tentative" | "accepted" }>;
    recurrence?: string[];
    htmlLink?: string;
    hangoutLink?: string;
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
      start: { date: start.toFormat("yyyy-MM-dd") },
      end: { date: end.toFormat("yyyy-MM-dd") },
      description: options.description,
      location: options.location,
      attendees: options.attendees,
      recurrence: options.recurrence,
      htmlLink: options.htmlLink || `https://calendar.google.com/event?eid=${generateId()}`,
      hangoutLink: options.hangoutLink,
      createdAt: now,
      updatedAt: now,
    };
  }

  return {
    id: generateId(),
    summary,
    status: "confirmed",
    eventType: options.eventType || "default",
    start: { dateTime: start.toISO() ?? undefined, timeZone: tz },
    end: { dateTime: end.toISO() ?? undefined, timeZone: tz },
    description: options.description,
    location: options.location,
    attendees: options.attendees,
    recurrence: options.recurrence,
    htmlLink: options.htmlLink || `https://calendar.google.com/event?eid=${generateId()}`,
    hangoutLink: options.hangoutLink,
    createdAt: now,
    updatedAt: now,
  };
}

// Generate seed data for the calendar
export function generateSeedData(): GCalEvent[] {
  const today = DateTime.now().startOf("day");
  const events: GCalEvent[] = [];

  // ===== TODAY =====

  // Morning standup (recurring)
  events.push(
    createEvent(
      "Daily Standup",
      today.set({ hour: 9, minute: 30 }),
      today.set({ hour: 9, minute: 45 }),
      {
        description: "Quick sync with the team",
        attendees: [
          { email: "alice@example.com", displayName: "Alice Chen", responseStatus: "accepted" },
          { email: "bob@example.com", displayName: "Bob Smith", responseStatus: "accepted" },
          { email: "you@example.com", displayName: "You", responseStatus: "accepted" },
        ],
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"],
        hangoutLink: "https://meet.google.com/abc-defg-hij",
      }
    )
  );

  // Focus time block
  events.push(
    createEvent(
      "Deep Work: API Design",
      today.set({ hour: 10, minute: 0 }),
      today.set({ hour: 12, minute: 0 }),
      {
        eventType: "focusTime",
        description: "Block for focused work on the new API endpoints.\n\nNo interruptions please!",
      }
    )
  );

  // Lunch
  events.push(
    createEvent(
      "Lunch with Sarah",
      today.set({ hour: 12, minute: 30 }),
      today.set({ hour: 13, minute: 30 }),
      {
        location: "Café Milano, 123 Main St",
        attendees: [
          { email: "sarah@example.com", displayName: "Sarah Johnson", responseStatus: "accepted" },
        ],
      }
    )
  );

  // Overlapping meetings (to test overlap detection)
  events.push(
    createEvent(
      "Design Review",
      today.set({ hour: 14, minute: 0 }),
      today.set({ hour: 15, minute: 0 }),
      {
        attendees: [
          { email: "design@example.com", displayName: "Design Team", responseStatus: "accepted" },
        ],
        hangoutLink: "https://meet.google.com/xyz-uvwx-yz",
      }
    )
  );

  events.push(
    createEvent(
      "Quick 1:1 with Manager",
      today.set({ hour: 14, minute: 30 }),
      today.set({ hour: 15, minute: 0 }),
      {
        attendees: [
          { email: "manager@example.com", displayName: "Pat Wilson", responseStatus: "tentative" },
        ],
      }
    )
  );

  // Late afternoon
  events.push(
    createEvent(
      "Code Review Session",
      today.set({ hour: 16, minute: 0 }),
      today.set({ hour: 17, minute: 0 }),
      {
        description: "Review PRs:\n- #1234 Auth refactor\n- #1235 Database migrations\n- #1236 UI improvements",
        attendees: [
          { email: "dev1@example.com", displayName: "Dev One", responseStatus: "accepted" },
          { email: "dev2@example.com", displayName: "Dev Two", responseStatus: "needsAction" },
        ],
      }
    )
  );

  // ===== TOMORROW =====
  const tomorrow = today.plus({ days: 1 });

  // Birthday (all-day)
  events.push(
    createEvent(
      "Emma's Birthday 🎂",
      tomorrow,
      tomorrow.plus({ days: 1 }), // End is exclusive for all-day
      {
        isAllDay: true,
        eventType: "birthday",
        description: "Don't forget to send a card!",
      }
    )
  );

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
          { email: "product@example.com", displayName: "Product Team", responseStatus: "accepted" },
        ],
        hangoutLink: "https://meet.google.com/demo-call",
      }
    )
  );

  events.push(
    createEvent(
      "Team Retrospective",
      tomorrow.set({ hour: 15, minute: 0 }),
      tomorrow.set({ hour: 16, minute: 30 }),
      {
        description: "Sprint retrospective - what went well, what could be improved?",
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=FR"],
        attendees: [
          { email: "team@example.com", displayName: "Engineering Team", responseStatus: "accepted" },
        ],
      }
    )
  );

  // ===== DAY AFTER TOMORROW =====
  const dayAfter = today.plus({ days: 2 });

  // Out of office
  events.push(
    createEvent(
      "Doctor Appointment",
      dayAfter.set({ hour: 9, minute: 0 }),
      dayAfter.set({ hour: 10, minute: 30 }),
      {
        eventType: "outOfOffice",
        location: "City Medical Center",
        description: "Annual checkup",
      }
    )
  );

  events.push(
    createEvent(
      "Architecture Discussion",
      dayAfter.set({ hour: 13, minute: 0 }),
      dayAfter.set({ hour: 14, minute: 30 }),
      {
        description: "Discuss microservices vs monolith for the new project",
        attendees: [
          { email: "architect@example.com", displayName: "Tech Lead", responseStatus: "accepted" },
          { email: "senior@example.com", displayName: "Senior Dev", responseStatus: "declined" },
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

  // ===== 3 DAYS AGO =====
  const threeDaysAgo = today.minus({ days: 3 });

  events.push(
    createEvent(
      "Project Kickoff",
      threeDaysAgo.set({ hour: 9, minute: 0 }),
      threeDaysAgo.set({ hour: 10, minute: 30 }),
      {
        description: "Kick off the new Aion project",
        attendees: [
          { email: "pm@example.com", displayName: "Project Manager", responseStatus: "accepted" },
          { email: "designer@example.com", displayName: "UX Designer", responseStatus: "accepted" },
        ],
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
        description: "Annual team building event",
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
        description: "Prepare slides for the upcoming tech conference",
      }
    )
  );

  return events;
}
