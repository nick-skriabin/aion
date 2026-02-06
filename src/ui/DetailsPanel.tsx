import React, { useMemo, useState } from "react";
import { Box, Text, Portal, ScrollView, FocusScope, Keybind } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { selectedEventAtom, timezoneAtom, focusAtom } from "../state/atoms.ts";
import { updateAttendanceAtom, openEditDialogAtom, initiateDeleteAtom } from "../state/actions.ts";
import { ScopedKeybinds } from "../keybinds/useKeybinds.tsx";
import {
  getDisplayTitle,
  getEventTypeLabel,
  isAllDay,
  isRecurring,
  getResponseStatusIcon,
  getVisibilityLabel,
  parseRecurrenceRule,
  formatReminder,
  type ResponseStatus,
} from "../domain/gcalEvent.ts";
import { getEventStart, getEventEnd, formatTimeRange, formatDayHeader, getLocalTimezone } from "../domain/time.ts";
import { theme } from "./theme.ts";

const LABEL_WIDTH = 8;
const PANEL_WIDTH = 44;

// Extract just the city/location from timezone (e.g., "Europe/Lisbon" -> "Lisbon")
function formatTimezoneShort(tz: string): string {
  const parts = tz.split("/");
  // Get the last part and replace underscores with spaces
  const location = parts[parts.length - 1].replace(/_/g, " ");
  return location;
}

// Format UTC offset from minutes (e.g., 0 -> "UTC+0", -300 -> "UTC-5", 60 -> "UTC+1")
function formatUtcOffset(offsetMinutes: number): string {
  const hours = Math.floor(Math.abs(offsetMinutes) / 60);
  const minutes = Math.abs(offsetMinutes) % 60;
  const sign = offsetMinutes >= 0 ? "+" : "-";
  if (minutes === 0) {
    return `UTC${sign}${hours}`;
  }
  return `UTC${sign}${hours}:${minutes.toString().padStart(2, "0")}`;
}

// Meeting link patterns for various video conferencing services
const MEETING_LINK_PATTERNS = [
  /https?:\/\/meet\.google\.com\/[a-z-]+/i,                    // Google Meet
  /https?:\/\/[a-z0-9-]*\.?zoom\.us\/[jw]\/\d+/i,              // Zoom
  /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s]+/i, // MS Teams
  /https?:\/\/[a-z0-9-]+\.webex\.com\/[^\s]+/i,                // Webex
  /https?:\/\/whereby\.com\/[^\s]+/i,                          // Whereby
  /https?:\/\/[a-z0-9-]+\.chime\.aws\/[^\s]+/i,                // Amazon Chime
  /https?:\/\/meet\.jit\.si\/[^\s]+/i,                         // Jitsi
  /https?:\/\/app\.around\.co\/[^\s]+/i,                       // Around
  /https?:\/\/[a-z0-9-]+\.gotowebinar\.com\/[^\s]+/i,          // GoToWebinar
  /https?:\/\/[a-z0-9-]+\.gotomeeting\.com\/[^\s]+/i,          // GoToMeeting
];

// Extract meeting link from text (location, description, etc.)
function extractMeetingLink(text: string | undefined): string | undefined {
  if (!text) return undefined;
  for (const pattern of MEETING_LINK_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return undefined;
}

// Get meeting link from event (checks hangoutLink first, then location)
function getMeetingLink(event: { hangoutLink?: string; location?: string }): string | undefined {
  if (event.hangoutLink) return event.hangoutLink;
  return extractMeetingLink(event.location);
}

// Get short label for meeting link type
function getMeetingLinkLabel(url: string): string {
  if (url.includes("meet.google.com")) return "meet";
  if (url.includes("zoom.us")) return "zoom";
  if (url.includes("teams.microsoft.com")) return "teams";
  if (url.includes("webex.com")) return "webex";
  if (url.includes("whereby.com")) return "whereby";
  if (url.includes("chime.aws")) return "chime";
  if (url.includes("jit.si")) return "jitsi";
  if (url.includes("around.co")) return "around";
  if (url.includes("gotomeeting.com")) return "gotomtg";
  if (url.includes("gotowebinar.com")) return "gotowebinar";
  return "link";
}

function getEventTypeColor(type: string | undefined) {
  switch (type) {
    case "outOfOffice":
      return theme.eventType.outOfOffice;
    case "focusTime":
      return theme.eventType.focusTime;
    case "birthday":
      return theme.eventType.birthday;
    default:
      return theme.eventType.default;
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box style={{ flexDirection: "row", gap: 1 }}>
      <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>{label}</Text>
      <Box style={{ flexGrow: 1, flexShrink: 1 }}>{children}</Box>
    </Box>
  );
}

function AttendanceButtons({ 
  currentStatus, 
}: { 
  currentStatus: ResponseStatus | undefined;
}) {
  const options: Array<{ status: ResponseStatus; label: string; hotkey: string }> = [
    { status: "accepted", label: "Yes", hotkey: "y" },
    { status: "declined", label: "No", hotkey: "n" },
    { status: "tentative", label: "Maybe", hotkey: "m" },
  ];

  return (
    <Box style={{ flexDirection: "row", gap: 1 }}>
      {options.map((opt) => {
        const isSelected = currentStatus === opt.status;
        return (
          <Text
            key={opt.status}
            style={{
              paddingX: 1,
              bg: isSelected ? theme.status[opt.status] : undefined,
              color: isSelected ? "black" : theme.text.secondary,
            }}
          >
            {opt.hotkey}:{opt.label}
          </Text>
        );
      })}
    </Box>
  );
}

export function DetailsPanel() {
  const event = useAtomValue(selectedEventAtom);
  const tz = useAtomValue(timezoneAtom);
  const focus = useAtomValue(focusAtom);
  const updateAttendance = useSetAtom(updateAttendanceAtom);
  const openEditDialog = useSetAtom(openEditDialogAtom);
  const initiateDelete = useSetAtom(initiateDeleteAtom);
  
  // Toggle between local and original timezone
  const [showOriginalTz, setShowOriginalTz] = useState(false);

  if (!event) return null;
  
  const title = getDisplayTitle(event);
  const allDay = isAllDay(event);
  const recurring = isRecurring(event);

  // Get meeting link from hangoutLink or location
  const meetingLink = getMeetingLink(event);
  const meetingLinkLabel = meetingLink ? getMeetingLinkLabel(meetingLink) : null;

  // Get both timezones
  const localTz = getLocalTimezone();
  const originalTz = event.start.timeZone || localTz;
  const hasOriginalTz = event.start.timeZone && event.start.timeZone !== localTz;

  // Use selected timezone for display
  const displayTz = showOriginalTz ? originalTz : localTz;
  const start = getEventStart(event, displayTz);
  const end = getEventEnd(event, displayTz);
  const typeColor = getEventTypeColor(event.eventType);
  
  const timeStr = allDay ? "All day" : formatTimeRange(start, end);
  const dateStr = formatDayHeader(start);

  // Parse recurrence rule
  const recurrenceStr = parseRecurrenceRule(event.recurrence);
  
  // Get visibility label
  const visibilityStr = getVisibilityLabel(event.visibility);
  
  // Format reminders
  const reminders = event.reminders?.overrides || [];
  
  // Find self attendee to get current response status
  const selfAttendee = event.attendees?.find((a) => a.self);
  const currentStatus = selfAttendee?.responseStatus;
  
  const isActive = focus === "details";
  
  // Toggle timezone display
  const toggleTimezone = () => {
    if (hasOriginalTz) {
      setShowOriginalTz(!showOriginalTz);
    }
  };

  // Action handlers for keybinds
  const handlers = useMemo(() => ({
    acceptInvite: () => updateAttendance({ eventId: event.id, status: "accepted" }),
    declineInvite: () => updateAttendance({ eventId: event.id, status: "declined" }),
    tentativeInvite: () => updateAttendance({ eventId: event.id, status: "tentative" }),
    editEvent: () => openEditDialog(),
    deleteEvent: () => initiateDelete(),
    openMeetingLink: meetingLink ? () => Bun.spawn(["open", meetingLink]) : undefined,
    toggleTimezone: hasOriginalTz ? toggleTimezone : undefined,
  }), [event.id, meetingLink, updateAttendance, openEditDialog, initiateDelete, hasOriginalTz, showOriginalTz]);
  
  return (
    <Portal zIndex={10}>
      <FocusScope trap={isActive}>
        {/* Keybinds from registry */}
        <ScopedKeybinds scope="details" handlers={handlers as Record<string, () => void>} enabled={isActive} />
        <Box
          style={{
            position: "absolute",
            top: 1,
            right: 1,
            bottom: 1,
            width: PANEL_WIDTH,
            bg: theme.modal.background,
            flexDirection: "column",
            padding: 1,
          }}
        >
        {/* Header */}
        <Box style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 1 }}>
          <Text style={{ color: theme.accent.primary, bold: true }}>
            Event Details
          </Text>
          <Text style={{ color: theme.text.dim }}>esc</Text>
        </Box>
        
        <ScrollView style={{ flexGrow: 1 }}>
          <Box style={{ flexDirection: "column", gap: 0 }}>
            {/* Title */}
            <Row label="title">
              <Text style={{ bold: true, color: theme.text.primary }} wrap="truncate">
                {title}
              </Text>
            </Row>
            
            {/* Type & Recurring */}
            <Row label="type">
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: typeColor }}>
                  {getEventTypeLabel(event.eventType || "default")}
                </Text>
                {recurring && (
                  <Text style={{ color: theme.text.dim }}>↻</Text>
                )}
              </Box>
            </Row>
            
            {/* Date */}
            <Row label="date">
              <Text style={{ color: theme.text.primary }}>{dateStr}</Text>
            </Row>
            
            {/* Time */}
            <Row label="time">
              <Text style={{ color: theme.text.secondary }}>{timeStr}</Text>
            </Row>
            
              {/* Timezone - interactive toggle */}
              <Row label="tz">
                <Box style={{ flexDirection: "row", gap: 1 }}>
                  <Text
                    style={{
                      color: hasOriginalTz
                        ? (showOriginalTz ? theme.text.dim : theme.accent.primary)
                        : theme.text.dim,
                    }}
                  >
                    {formatTimezoneShort(displayTz)} {formatUtcOffset(start.offset)}
                  </Text>
                  {hasOriginalTz && (
                    <Text style={{ color: theme.text.dim }}>
                      t:{showOriginalTz ? "local" : "orig"}
                    </Text>
                  )}
                </Box>
              </Row>
            
            {/* Recurrence */}
            {recurrenceStr && (
              <Row label="repeats">
                <Text style={{ color: theme.text.secondary }}>{recurrenceStr}</Text>
              </Row>
            )}
            
            {/* Visibility */}
            <Row label="show as">
              <Text style={{ color: theme.text.secondary }}>{visibilityStr}</Text>
            </Row>
            
            {/* Attendance */}
            <Row label="going?">
              <AttendanceButtons currentStatus={currentStatus} />
            </Row>
            
            {/* Location */}
            {event.location && (
              <Row label="where">
                <Text style={{ color: theme.text.primary }} wrap="truncate">
                  {event.location}
                </Text>
              </Row>
            )}
            
              {/* Meeting Link */}
              {meetingLink && (
                <Row label={meetingLinkLabel || "link"}>
                <Text style={{ color: theme.accent.primary }} wrap="truncate">
                    {meetingLink}
                </Text>
              </Row>
            )}
            
            {/* Attendees */}
            {event.attendees && event.attendees.length > 0 && (
              <>
                <Row label="guests">
                  <Text style={{ color: theme.text.dim }}>
                    {event.attendees.length} attendee{event.attendees.length > 1 ? "s" : ""}
                  </Text>
                </Row>
                {event.attendees.map((attendee, i) => (
                  <Row key={i} label="">
                    <Box style={{ flexDirection: "row", gap: 1 }}>
                      <Text
                        style={{
                          color:
                            attendee.responseStatus === "accepted"
                              ? theme.status.accepted
                              : attendee.responseStatus === "declined"
                              ? theme.status.declined
                              : attendee.responseStatus === "tentative"
                              ? theme.status.tentative
                              : theme.status.needsAction,
                        }}
                      >
                        {getResponseStatusIcon(attendee.responseStatus)}
                      </Text>
                      <Text style={{ color: theme.text.primary }} wrap="truncate">
                        {attendee.displayName || attendee.email}
                      </Text>
                    </Box>
                  </Row>
                ))}
              </>
            )}
            
            {/* Reminders */}
            {reminders.length > 0 && (
              <>
                <Row label="remind">
                  <Text style={{ color: theme.text.secondary }}>
                    {formatReminder(reminders[0].minutes, reminders[0].method)}
                  </Text>
                </Row>
                {reminders.slice(1).map((r, i) => (
                  <Row key={i} label="">
                    <Text style={{ color: theme.text.secondary }}>
                      {formatReminder(r.minutes, r.method)}
                    </Text>
                  </Row>
                ))}
              </>
            )}
            
            {/* Description */}
            {event.description && (
              <>
                <Box style={{ paddingTop: 1 }}>
                  <Text style={{ color: theme.text.dim }}>notes</Text>
                </Box>
                <Text style={{ color: theme.text.secondary }} wrap="wrap">
                  {event.description}
                </Text>
              </>
            )}
          </Box>
        </ScrollView>
        
          {/* Footer */}
          <Box style={{ paddingTop: 1, flexDirection: "row", gap: 2 }}>
            <Text style={{ color: theme.text.dim }}>e:edit</Text>
            <Text style={{ color: theme.text.dim }}>D:delete</Text>
            {meetingLink && (
              <Text style={{ color: theme.text.dim }}>o:open</Text>
            )}
          </Box>
        </Box>
      </FocusScope>
    </Portal>
  );
}
