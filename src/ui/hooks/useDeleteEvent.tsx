import React, { useCallback } from "react";
import { Box, Text, useDialog } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  eventsAtom,
  selectedEventIdAtom,
  pendingActionAtom,
  type RecurrenceScope,
} from "../../state/atoms.ts";
import {
  confirmDeleteAtom,
  updateAttendanceAtom,
  pushOverlayAtom,
} from "../../state/actions.ts";
import { getDisplayTitle, isOrganizer } from "../../domain/gcalEvent.ts";
import { theme } from "../theme.ts";

/**
 * Hook for handling event deletion with Glyph's useDialog()
 * Handles all the conditional dialogs (scope, notify, confirm)
 */
export function useDeleteEvent() {
  const { confirm } = useDialog();
  const events = useAtomValue(eventsAtom);
  const selectedId = useAtomValue(selectedEventIdAtom);
  const setPendingAction = useSetAtom(pendingActionAtom);
  const confirmDelete = useSetAtom(confirmDeleteAtom);
  const pushOverlay = useSetAtom(pushOverlayAtom);
  const updateAttendance = useSetAtom(updateAttendanceAtom);

  /**
   * Continue delete flow after scope selection (for recurring events)
   * Called from ScopeSelector component
   */
  const continueWithScope = useCallback(async (
    eventId: string,
    scope: RecurrenceScope
  ) => {
    const event = events[eventId];
    if (!event) return;

    const eventTitle = getDisplayTitle(event);
    const hasOtherAttendees = event.attendees?.some(a => !a.self && !a.organizer) ?? false;

    let notifyAttendees = false;

    // Step 1: If has attendees, ask about notifications
    if (hasOtherAttendees) {
      notifyAttendees = await confirm(
        <Box style={{ flexDirection: "column", gap: 1 }}>
          <Text style={{ bold: true, color: theme.accent.warning }}>
            Notify attendees?
          </Text>
          <Text style={{ color: theme.text.dim }}>
            This event has other participants.
          </Text>
        </Box>,
        { 
          okText: "Yes, notify", 
          cancelText: "No", 
          style: { border: "none" },
          okButtonStyle: { bg: theme.accent.error },
        }
      );
    }

    // Step 2: Final delete confirmation
    const scopeText = scope === "this"
      ? " (this event only)"
      : scope === "following"
        ? " (this and following)"
        : " (all in series)";

    const ok = await confirm(
      <Text style={{ color: theme.text.primary }}>
        Delete "{eventTitle}"{scopeText}?
      </Text>,
      { 
        okText: "Delete", 
        cancelText: "Cancel", 
        style: { border: "none" },
        okButtonStyle: { bg: theme.accent.error },
      }
    );

    if (ok) {
      setPendingAction({ eventId, type: "delete", scope, notifyAttendees });
      confirmDelete();
    }
  }, [events, confirm, setPendingAction, confirmDelete]);

  /**
   * Initiate delete for the currently selected event
   */
  const deleteEvent = useCallback(async () => {
    if (!selectedId) return;

    const event = events[selectedId];
    if (!event) return;

    const eventTitle = getDisplayTitle(event);

    // Check if user is the organizer - non-organizers can only leave (decline)
    if (!isOrganizer(event)) {
      const ok = await confirm(
        <Box style={{ flexDirection: "column", gap: 1 }}>
          <Text style={{ bold: true, color: theme.accent.warning }}>
            Leave "{eventTitle}"?
          </Text>
          <Text style={{ color: theme.text.dim }}>
            You're not the organizer. Decline and remove from your calendar?
          </Text>
        </Box>,
        { 
          okText: "Leave", 
          cancelText: "Cancel", 
          style: { border: "none" },
          okButtonStyle: { bg: theme.accent.error },
        }
      );

      if (ok) {
        updateAttendance({ eventId: selectedId, status: "declined" });
      }
      return;
    }

    const isRecurring = (event.recurrence && event.recurrence.length > 0) || !!event.recurringEventId;
    const hasOtherAttendees = event.attendees?.some(a => !a.self && !a.organizer) ?? false;

    // For recurring events, show scope selector (custom UI with Radio)
    if (isRecurring) {
      setPendingAction({ eventId: selectedId, type: "delete" });
      pushOverlay({ kind: "confirm", payload: { type: "deleteScope" } });
      // Flow continues via continueWithScope after user selects scope
      return;
    }

    let notifyAttendees = false;

    // If has attendees, ask about notifications
    if (hasOtherAttendees) {
      notifyAttendees = await confirm(
        <Box style={{ flexDirection: "column", gap: 1 }}>
          <Text style={{ bold: true, color: theme.accent.warning }}>
            Notify attendees?
          </Text>
          <Text style={{ color: theme.text.dim }}>
            This event has other participants.
          </Text>
        </Box>,
        { 
          okText: "Yes, notify", 
          cancelText: "No", 
          style: { border: "none" },
          okButtonStyle: { bg: theme.accent.error },
        }
      );
    }

    // Final delete confirmation
    const ok = await confirm(
      <Text style={{ color: theme.text.primary }}>
        Delete "{eventTitle}"?
      </Text>,
      { 
        okText: "Delete", 
        cancelText: "Cancel", 
        style: { border: "none" },
        okButtonStyle: { bg: theme.accent.error },
      }
    );

    if (ok) {
      setPendingAction({ eventId: selectedId, type: "delete", notifyAttendees });
      confirmDelete();
    }
  }, [selectedId, events, confirm, setPendingAction, confirmDelete, pushOverlay, updateAttendance]);

  return { deleteEvent, continueWithScope };
}
