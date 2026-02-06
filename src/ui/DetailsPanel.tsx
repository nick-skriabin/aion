import React from "react";
import { Box, Text, Portal, ScrollView, FocusScope, Keybind } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { selectedEventAtom, timezoneAtom, focusAtom } from "../state/atoms.ts";
import { updateAttendanceAtom, openEditDialogAtom, initiateDeleteAtom } from "../state/actions.ts";
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
import { getEventStart, getEventEnd, formatTimeRange, formatDayHeader } from "../domain/time.ts";
import { theme } from "./theme.ts";

const LABEL_WIDTH = 8;
const PANEL_WIDTH = 44;

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
  
  if (!event) return null;
  
  const title = getDisplayTitle(event);
  const allDay = isAllDay(event);
  const recurring = isRecurring(event);
  const start = getEventStart(event, tz);
  const end = getEventEnd(event, tz);
  const typeColor = getEventTypeColor(event.eventType);
  
  const timeStr = allDay ? "All day" : formatTimeRange(start, end);
  const dateStr = formatDayHeader(start);
  
  // Get timezone from event or use default
  const eventTimezone = event.start.timeZone || tz;
  
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
  
  return (
    <Portal zIndex={10}>
      <FocusScope trap={isActive}>
        {/* Keybinds for details panel */}
        {isActive && (
          <>
            <Keybind keypress="y" onPress={() => updateAttendance({ eventId: event.id, status: "accepted" })} />
            <Keybind keypress="n" onPress={() => updateAttendance({ eventId: event.id, status: "declined" })} />
            <Keybind keypress="m" onPress={() => updateAttendance({ eventId: event.id, status: "tentative" })} />
            <Keybind keypress="e" onPress={() => openEditDialog()} />
            <Keybind keypress="shift+d" onPress={() => initiateDelete()} />
            {event.hangoutLink && (
              <Keybind keypress="o" onPress={() => Bun.spawn(["open", event.hangoutLink!])} />
            )}
          </>
        )}
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
            
            {/* Timezone */}
            {eventTimezone && (
              <Row label="tz">
                <Text style={{ color: theme.text.dim }}>{eventTimezone}</Text>
              </Row>
            )}
            
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
            
            {/* Links */}
            {event.hangoutLink && (
              <Row label="meet">
                <Text style={{ color: theme.accent.primary }} wrap="truncate">
                  {event.hangoutLink}
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
            {event.hangoutLink && (
              <Text style={{ color: theme.text.dim }}>o:open</Text>
            )}
          </Box>
        </Box>
      </FocusScope>
    </Portal>
  );
}
