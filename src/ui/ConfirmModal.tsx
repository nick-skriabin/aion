import React, { useState } from "react";
import { Box, Text, Button, Portal, FocusScope, Radio } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  selectedEventAtom,
  pendingActionAtom,
  topOverlayAtom,
  type RecurrenceScope,
} from "../state/atoms.ts";
import {
  popOverlayAtom,
  confirmDeleteAtom,
  continueDeleteWithScopeAtom,
  continueDeleteWithNotifyAtom,
  continueEditWithScopeAtom,
  updateAttendanceAtom,
} from "../state/actions.ts";
import { getDisplayTitle } from "../domain/gcalEvent.ts";
import { theme } from "./theme.ts";

export function ConfirmModal() {
  const overlay = useAtomValue(topOverlayAtom);
  const event = useAtomValue(selectedEventAtom);
  const pendingAction = useAtomValue(pendingActionAtom);
  const pop = useSetAtom(popOverlayAtom);
  const confirmDelete = useSetAtom(confirmDeleteAtom);
  const continueDeleteWithScope = useSetAtom(continueDeleteWithScopeAtom);
  const continueDeleteWithNotify = useSetAtom(continueDeleteWithNotifyAtom);
  const continueEditWithScope = useSetAtom(continueEditWithScopeAtom);
  const updateAttendance = useSetAtom(updateAttendanceAtom);
  
  const [selectedScope, setSelectedScope] = useState<RecurrenceScope>("this");
  
  if (!overlay || overlay.kind !== "confirm") return null;
  
  const modalType = overlay.payload?.type as string;
  const eventTitle = event ? getDisplayTitle(event) : "this event";
  
  // Scope selection for recurring events
  if (modalType === "deleteScope" || modalType === "editScope") {
    const isDelete = modalType === "deleteScope";
    
    return (
      <Portal zIndex={50}>
        <Box
          style={{
            position: "absolute",
            inset: 0,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Box
            style={{
              width: 45,
              flexDirection: "column",
              gap: 1,
              padding: 1,
              bg: theme.modal.background,
              border: "single",
              borderColor: theme.modal.border,
            }}
          >
            <FocusScope trap>
              <Text style={{ bold: true, color: theme.text.primary }}>
                {isDelete ? "Delete recurring event" : "Edit recurring event"}
              </Text>
              <Text style={{ color: theme.text.dim }}>
                Apply to:
              </Text>
              
              <Radio
                items={[
                  { label: "This event only", value: "this" as RecurrenceScope },
                  { label: "This and following", value: "following" as RecurrenceScope },
                  { label: "All in series", value: "all" as RecurrenceScope },
                ]}
                value={selectedScope}
                onChange={setSelectedScope}
                focusedItemStyle={{ color: theme.accent.primary }}
                selectedItemStyle={{ bold: true }}
              />
              
              <Box style={{ flexDirection: "row", gap: 2, paddingTop: 1 }}>
                <Button
                  onPress={() => {
                    if (isDelete) {
                      continueDeleteWithScope(selectedScope);
                    } else {
                      continueEditWithScope(selectedScope);
                    }
                  }}
                  style={{ paddingX: 1, bg: theme.input.background }}
                  focusedStyle={{ bg: theme.accent.primary, color: "black", bold: true }}
                >
                  <Text>continue</Text>
                </Button>
                <Button
                  onPress={() => pop()}
                  style={{ paddingX: 1, bg: theme.input.background }}
                  focusedStyle={{ bg: theme.text.dim, color: "black" }}
                >
                  <Text>cancel</Text>
                </Button>
              </Box>
            </FocusScope>
          </Box>
        </Box>
      </Portal>
    );
  }
  
  // Notify attendees prompt
  if (modalType === "notifyAttendees") {
    return (
      <Portal zIndex={50}>
        <Box
          style={{
            position: "absolute",
            inset: 0,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Box
            style={{
              width: 40,
              flexDirection: "column",
              gap: 1,
              padding: 1,
              bg: theme.modal.background,
              border: "single",
              borderColor: theme.modal.border,
            }}
          >
            <FocusScope trap>
              <Text style={{ bold: true, color: theme.accent.warning }}>
                Notify attendees?
              </Text>
              <Text style={{ color: theme.text.dim }}>
                This event has other participants.
              </Text>
              
              <Box style={{ flexDirection: "row", gap: 2, paddingTop: 1 }}>
                <Button
                  onPress={() => continueDeleteWithNotify(true)}
                  style={{ paddingX: 1, bg: theme.input.background }}
                  focusedStyle={{ bg: theme.accent.success, color: "black", bold: true }}
                >
                  <Text>[y]es</Text>
                </Button>
                <Button
                  onPress={() => continueDeleteWithNotify(false)}
                  style={{ paddingX: 1, bg: theme.input.background }}
                  focusedStyle={{ bg: theme.text.dim, color: "black" }}
                >
                  <Text>[n]o</Text>
                </Button>
              </Box>
            </FocusScope>
          </Box>
        </Box>
      </Portal>
    );
  }
  
  // Delete confirmation
  if (modalType === "deleteConfirm") {
    return (
      <Portal zIndex={50}>
        <Box
          style={{
            position: "absolute",
            inset: 0,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Box
            style={{
              width: 40,
              flexDirection: "column",
              gap: 1,
              padding: 1,
              bg: theme.modal.background,
              border: "single",
              borderColor: theme.modal.border,
            }}
          >
            <FocusScope trap>
              <Text style={{ bold: true, color: theme.accent.error }}>
                Delete "{eventTitle}"?
              </Text>
              
              {pendingAction?.scope && (
                <Text style={{ color: theme.text.dim }}>
                  scope: {pendingAction.scope === "this"
                    ? "this event"
                    : pendingAction.scope === "following"
                    ? "this and following"
                    : "all in series"}
                </Text>
              )}
              
              <Box style={{ flexDirection: "row", gap: 2, paddingTop: 1 }}>
                <Button
                  onPress={() => confirmDelete()}
                  style={{ paddingX: 1, bg: theme.input.background }}
                  focusedStyle={{ bg: theme.accent.error, color: "black", bold: true }}
                >
                  <Text>delete</Text>
                </Button>
                <Button
                  onPress={() => pop()}
                  style={{ paddingX: 1, bg: theme.input.background }}
                  focusedStyle={{ bg: theme.text.dim, color: "black" }}
                >
                  <Text>cancel</Text>
                </Button>
              </Box>
            </FocusScope>
          </Box>
        </Box>
      </Portal>
    );
  }
  
  // Leave event confirmation (for non-organizers)
  if (modalType === "leaveEvent") {
    const eventId = overlay.payload?.eventId as string;

    return (
      <Portal zIndex={50}>
        <Box
          style={{
            position: "absolute",
            inset: 0,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Box
            style={{
              width: 45,
              flexDirection: "column",
              gap: 1,
              padding: 1,
              bg: theme.modal.background,
              border: "single",
              borderColor: theme.modal.border,
            }}
          >
            <FocusScope trap>
              <Text style={{ bold: true, color: theme.accent.warning }}>
                Leave "{eventTitle}"?
              </Text>
              <Text style={{ color: theme.text.dim }}>
                You can't delete this event because you're
              </Text>
              <Text style={{ color: theme.text.dim }}>
                not the organizer. Would you like to
              </Text>
              <Text style={{ color: theme.text.dim }}>
                decline and remove from your calendar?
              </Text>

              <Box style={{ flexDirection: "row", gap: 2, paddingTop: 1 }}>
                <Button
                  onPress={() => {
                    if (eventId) {
                      updateAttendance({ eventId, status: "declined" });
                    }
                    pop();
                  }}
                  style={{ paddingX: 1, bg: theme.input.background }}
                  focusedStyle={{ bg: theme.accent.warning, color: "black", bold: true }}
                >
                  <Text>leave</Text>
                </Button>
                <Button
                  onPress={() => pop()}
                  style={{ paddingX: 1, bg: theme.input.background }}
                  focusedStyle={{ bg: theme.text.dim, color: "black" }}
                >
                  <Text>cancel</Text>
                </Button>
              </Box>
            </FocusScope>
          </Box>
        </Box>
      </Portal>
    );
  }

  return null;
}
