import React from "react";
import { Box, Text, Portal, ScrollView } from "@nick-skriabin/glyph";
import { useAtomValue } from "jotai";
import { selectedEventAtom, timezoneAtom } from "../state/atoms.ts";
import {
  getDisplayTitle,
  getEventTypeLabel,
  isAllDay,
  isRecurring,
  getResponseStatusIcon,
} from "../domain/gcalEvent.ts";
import { getEventStart, getEventEnd, formatTimeRange, formatDayHeader } from "../domain/time.ts";
import { theme, styles } from "./theme.ts";

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

export function DetailsPanel() {
  const event = useAtomValue(selectedEventAtom);
  const tz = useAtomValue(timezoneAtom);
  
  if (!event) return null;
  
  const title = getDisplayTitle(event);
  const allDay = isAllDay(event);
  const recurring = isRecurring(event);
  const start = getEventStart(event, tz);
  const end = getEventEnd(event, tz);
  const typeColor = getEventTypeColor(event.eventType);
  
  return (
    <Portal zIndex={10}>
      <Box
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "40%",
          bg: theme.bg.primary,
        }}
      >
        <Box
          style={{
            ...styles.panelFocused,
            height: "100%",
            flexDirection: "column",
            padding: 0,
          }}
        >
          {/* Header */}
          <Box
            style={{
              paddingX: 1,
              paddingY: 0,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ ...styles.header, color: theme.accent.primary }}>
              Event Details
            </Text>
            <Text style={{ color: theme.text.dim }}>Esc to close</Text>
          </Box>
          
          <ScrollView style={{ flexGrow: 1, padding: 1 }}>
            {/* Title */}
            <Box style={{ paddingBottom: 1 }}>
              <Text style={{ bold: true, color: theme.text.primary }}>
                {title}
              </Text>
            </Box>
            
            {/* Type badge */}
            <Box style={{ flexDirection: "row", gap: 1, paddingBottom: 1 }}>
              <Box
                style={{
                  bg: typeColor,
                  paddingX: 1,
                }}
              >
                <Text style={{ color: theme.bg.primary, bold: true }}>
                  {getEventTypeLabel(event.eventType || "default")}
                </Text>
              </Box>
              {recurring && (
                <Text style={{ color: theme.text.secondary }}>🔁 Recurring</Text>
              )}
            </Box>
            
            {/* Time */}
            <Box style={{ paddingBottom: 1 }}>
              <Text style={{ color: theme.text.dim }}>When</Text>
              <Text style={{ color: theme.text.primary }}>
                {formatDayHeader(start)}
              </Text>
              <Text style={{ color: theme.text.secondary }}>
                {allDay ? "All day" : formatTimeRange(start, end)}
              </Text>
            </Box>
            
            {/* Location */}
            {event.location && (
              <Box style={{ paddingBottom: 1 }}>
                <Text style={{ color: theme.text.dim }}>Location</Text>
                <Text style={{ color: theme.text.primary }}>
                  📍 {event.location}
                </Text>
              </Box>
            )}
            
            {/* Links */}
            {(event.hangoutLink || event.htmlLink) && (
              <Box style={{ paddingBottom: 1 }}>
                <Text style={{ color: theme.text.dim }}>Links</Text>
                {event.hangoutLink && (
                  <Text style={{ color: theme.accent.primary }}>
                    🎥 {event.hangoutLink}
                  </Text>
                )}
                {event.htmlLink && (
                  <Text style={{ color: theme.accent.primary, dim: true }}>
                    🔗 Google Calendar
                  </Text>
                )}
              </Box>
            )}
            
            {/* Attendees */}
            {event.attendees && event.attendees.length > 0 && (
              <Box style={{ paddingBottom: 1 }}>
                <Text style={{ color: theme.text.dim }}>
                  Attendees ({event.attendees.length})
                </Text>
                {event.attendees.map((attendee, i) => (
                  <Box key={i} style={{ flexDirection: "row", gap: 1 }}>
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
                    <Text style={{ color: theme.text.primary }}>
                      {attendee.displayName || attendee.email}
                    </Text>
                    {attendee.organizer && (
                      <Text style={{ color: theme.text.dim }}>(organizer)</Text>
                    )}
                  </Box>
                ))}
              </Box>
            )}
            
            {/* Description */}
            {event.description && (
              <Box style={{ paddingBottom: 1 }}>
                <Text style={{ color: theme.text.dim }}>Description</Text>
                <Text style={{ color: theme.text.secondary }} wrap="wrap">
                  {event.description}
                </Text>
              </Box>
            )}
          </ScrollView>
          
          {/* Footer */}
          <Box
            style={{
              paddingX: 1,
            }}
          >
            <Text style={{ color: theme.text.dim }}>
              e:edit │ D:delete │ Esc:close
            </Text>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
