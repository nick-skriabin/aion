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
import { theme } from "./theme.ts";

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
          top: 1,
          right: 1,
          bottom: 1,
          width: "40%",
          bg: theme.modal.background,
        }}
      >
        <Box
          style={{
            height: "100%",
            flexDirection: "column",
            padding: 1,
          }}
        >
          {/* Header */}
          <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: theme.accent.primary, bold: true }}>
              Details
            </Text>
            <Text style={{ color: theme.text.dim }}>esc:close</Text>
          </Box>
          
          <ScrollView style={{ flexGrow: 1, paddingTop: 1 }}>
            {/* Title */}
            <Text style={{ bold: true, color: theme.text.primary }}>
              {title}
            </Text>
            
            {/* Type */}
            <Box style={{ flexDirection: "row", gap: 1, paddingY: 1 }}>
              <Text style={{ color: typeColor }}>
                [{getEventTypeLabel(event.eventType || "default")}]
              </Text>
              {recurring && (
                <Text style={{ color: theme.text.dim }}>↻ recurring</Text>
              )}
            </Box>
            
            {/* Time */}
            <Box style={{ paddingBottom: 1 }}>
              <Text style={{ color: theme.text.dim }}>when</Text>
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
                <Text style={{ color: theme.text.dim }}>where</Text>
                <Text style={{ color: theme.text.primary }}>
                  {event.location}
                </Text>
              </Box>
            )}
            
            {/* Links */}
            {(event.hangoutLink || event.htmlLink) && (
              <Box style={{ paddingBottom: 1 }}>
                <Text style={{ color: theme.text.dim }}>links</Text>
                {event.hangoutLink && (
                  <Text style={{ color: theme.accent.primary }}>
                    {event.hangoutLink}
                  </Text>
                )}
              </Box>
            )}
            
            {/* Attendees */}
            {event.attendees && event.attendees.length > 0 && (
              <Box style={{ paddingBottom: 1 }}>
                <Text style={{ color: theme.text.dim }}>
                  attendees ({event.attendees.length})
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
                  </Box>
                ))}
              </Box>
            )}
            
            {/* Description */}
            {event.description && (
              <Box style={{ paddingBottom: 1 }}>
                <Text style={{ color: theme.text.dim }}>notes</Text>
                <Text style={{ color: theme.text.secondary }} wrap="wrap">
                  {event.description}
                </Text>
              </Box>
            )}
          </ScrollView>
          
          {/* Footer */}
          <Box>
            <Text style={{ color: theme.text.dim }}>
              e:edit  D:delete
            </Text>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
