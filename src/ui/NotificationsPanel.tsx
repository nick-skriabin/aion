import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Box, Text, Portal, ScrollView } from "@semos-labs/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  pendingInvitesAtom,
  selectedEventIdAtom,
  timezoneAtom,
} from "../state/atoms.ts";
import {
  popOverlayAtom,
  updateAttendanceAtom,
  selectDayAtom,
} from "../state/actions.ts";
import { getDisplayTitle } from "../domain/gcalEvent.ts";
import { getEventStart, formatTime, formatDayShort } from "../domain/time.ts";
import { ScopedKeybinds } from "../keybinds/useKeybinds.tsx";
import { theme } from "./theme.ts";
import type { GCalEvent } from "../domain/gcalEvent.ts";

const PANEL_WIDTH = 50;

function InviteRow({
  event,
  isSelected,
  tz,
}: {
  event: GCalEvent;
  isSelected: boolean;
  tz: string;
}) {
  const title = getDisplayTitle(event);
  const start = getEventStart(event, tz);
  const timeStr = event.start.dateTime ? formatTime(start) : "all-day";
  const dateStr = formatDayShort(start);
  
  // Get organizer
  const organizer = event.attendees?.find((a) => a.organizer);
  const organizerName = organizer?.displayName || organizer?.email || "Unknown";
  
  return (
    <Box
      style={{
        flexDirection: "column",
        paddingY: 0,
        bg: isSelected ? theme.selection.background : undefined,
      }}
    >
      <Box style={{ flexDirection: "row", gap: 1 }}>
        <Text style={{ color: isSelected ? theme.selection.text : theme.accent.primary, bold: isSelected }}>
          {isSelected ? "▸" : " "}
        </Text>
        <Text style={{ color: theme.accent.warning }}>!</Text>
        <Text
          style={{
            color: isSelected ? theme.selection.text : theme.text.primary,
            bold: isSelected,
          }}
          wrap="truncate"
        >
          {title}
        </Text>
      </Box>
      <Box style={{ flexDirection: "row", gap: 1, paddingLeft: 3 }}>
        <Text style={{ color: theme.text.dim }}>{dateStr}</Text>
        <Text style={{ color: theme.text.dim }}>{timeStr}</Text>
        <Text style={{ color: theme.text.dim }}>·</Text>
        <Text style={{ color: theme.text.dim }} wrap="truncate">from {organizerName}</Text>
      </Box>
    </Box>
  );
}

export function NotificationsPanel() {
  const invites = useAtomValue(pendingInvitesAtom);
  const tz = useAtomValue(timezoneAtom);
  const popOverlay = useSetAtom(popOverlayAtom);
  const updateAttendance = useSetAtom(updateAttendanceAtom);
  const selectDay = useSetAtom(selectDayAtom);
  const setSelectedEventId = useSetAtom(selectedEventIdAtom);
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Sort invites by date/time
  const sortedInvites = useMemo(() => {
    return [...invites].sort((a, b) => {
      const aStart = getEventStart(a, tz);
      const bStart = getEventStart(b, tz);
      return aStart.toMillis() - bStart.toMillis();
    });
  }, [invites, tz]);
  
  // Clamp selectedIndex to valid range when invites change (e.g., after sync)
  const clampedIndex = Math.min(selectedIndex, Math.max(0, sortedInvites.length - 1));
  useEffect(() => {
    if (clampedIndex !== selectedIndex) {
      setSelectedIndex(clampedIndex);
    }
  }, [clampedIndex, selectedIndex]);
  
  const selectedInvite = sortedInvites[clampedIndex];
  
  // Sync selection with timeline when navigating
  useEffect(() => {
    if (selectedInvite) {
      const eventDay = getEventStart(selectedInvite, tz).startOf("day");
      selectDay(eventDay);
      setSelectedEventId(selectedInvite.id);
    }
  }, [selectedInvite?.id, tz, selectDay, setSelectedEventId]);
  
  // Navigation handlers
  const handleNext = useCallback(() => {
    setSelectedIndex((i) => Math.min(i + 1, sortedInvites.length - 1));
  }, [sortedInvites.length]);
  
  const handlePrev = useCallback(() => {
    setSelectedIndex((i) => Math.max(i - 1, 0));
  }, []);
  
  const handleAccept = useCallback(() => {
    if (selectedInvite) {
      updateAttendance({ eventId: selectedInvite.id, status: "accepted" });
    }
  }, [selectedInvite, updateAttendance]);
  
  const handleDecline = useCallback(() => {
    if (selectedInvite) {
      updateAttendance({ eventId: selectedInvite.id, status: "declined" });
    }
  }, [selectedInvite, updateAttendance]);
  
  const handleTentative = useCallback(() => {
    if (selectedInvite) {
      updateAttendance({ eventId: selectedInvite.id, status: "tentative" });
    }
  }, [selectedInvite, updateAttendance]);
  
  // Keybind handlers from registry
  const handlers = useMemo(() => ({
    next: handleNext,
    prev: handlePrev,
    accept: handleAccept,
    decline: handleDecline,
    tentative: handleTentative,
    close: popOverlay,
  }), [handleNext, handlePrev, handleAccept, handleDecline, handleTentative, popOverlay]);

  if (sortedInvites.length === 0) {
    return (
      <Portal zIndex={50}>
        <ScopedKeybinds scope="notifications" handlers={handlers} />
        <Box
          style={{
            position: "absolute",
            bottom: 2,
            right: 1,
            width: PANEL_WIDTH,
            bg: theme.modal.background,
            padding: 1,
            flexDirection: "column",
          }}
        >
          <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: theme.accent.primary, bold: true }}>
              Notifications
            </Text>
            <Text style={{ color: theme.text.dim }}>esc</Text>
          </Box>
          <Text style={{ color: theme.text.dim, paddingTop: 1 }}>
            No pending invites 🎉
          </Text>
        </Box>
      </Portal>
    );
  }
  
  return (
    <Portal zIndex={50}>
      {/* Keybinds from registry */}
      <ScopedKeybinds scope="notifications" handlers={handlers} />
      
      <Box
        style={{
          position: "absolute",
          bottom: 2,
          right: 1,
          width: PANEL_WIDTH,
          height: 15,
          bg: theme.modal.background,
          padding: 1,
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: theme.accent.primary, bold: true }}>
            Notifications ({sortedInvites.length})
          </Text>
          <Text style={{ color: theme.text.dim }}>esc</Text>
        </Box>
        
        {/* List - fixed height for ScrollView to work */}
        <Box style={{ height: 10, paddingTop: 1 }}>
          <ScrollView
            style={{ height: "100%" }}
            scrollOffset={Math.max(0, clampedIndex - 2)}
          >
            {sortedInvites.map((invite, index) => (
              <InviteRow
                key={invite.id}
                event={invite}
                isSelected={index === clampedIndex}
                tz={tz}
              />
            ))}
          </ScrollView>
        </Box>
        
        {/* Footer */}
        <Box style={{ paddingTop: 1, flexDirection: "row", gap: 2 }}>
          <Text style={{ color: theme.text.dim }}>j/k:nav</Text>
          <Text style={{ color: theme.status.accepted }}>y:yes</Text>
          <Text style={{ color: theme.status.declined }}>n:no</Text>
          <Text style={{ color: theme.status.tentative }}>m:maybe</Text>
        </Box>
      </Box>
    </Portal>
  );
}
