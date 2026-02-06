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
            bg: theme.bg.primary,
          }}
        >
          <Box
            style={{
              width: 50,
              bg: theme.bg.secondary,
              border: "round",
              borderColor: theme.border.focus,
              padding: 1,
              flexDirection: "column",
              gap: 1,
            }}
          >
            <FocusScope trap>
              <Text style={{ bold: true, color: theme.text.primary }}>
                {isDelete ? "Delete recurring event" : "Edit recurring event"}
              </Text>
              <Text style={{ color: theme.text.secondary }}>
                This event is part of a series. {isDelete ? "Delete" : "Edit"}:
              </Text>
              
              <Radio
                items={[
                  { label: "This event only", value: "this" as RecurrenceScope },
                  { label: "This and following events", value: "following" as RecurrenceScope },
                  { label: "All events in the series", value: "all" as RecurrenceScope },
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
                  style={{
                    border: "single",
                    borderColor: theme.accent.primary,
                    paddingX: 2,
                  }}
                  focusedStyle={{ bg: theme.accent.primary }}
                >
                  <Text>Continue</Text>
                </Button>
                <Button
                  onPress={() => pop()}
                  style={{
                    border: "single",
                    borderColor: theme.border.normal,
                    paddingX: 2,
                  }}
                  focusedStyle={{ bg: theme.bg.hover }}
                >
                  <Text>Cancel</Text>
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
            bg: theme.bg.primary,
          }}
        >
          <Box
            style={{
              width: 45,
              bg: theme.bg.secondary,
              border: "round",
              borderColor: theme.accent.warning,
              padding: 1,
              flexDirection: "column",
              gap: 1,
            }}
          >
            <FocusScope trap>
              <Text style={{ bold: true, color: theme.accent.warning }}>
                Notify attendees?
              </Text>
              <Text style={{ color: theme.text.secondary }}>
                This event has other attendees. Would you like to notify them?
              </Text>
              
              <Box style={{ flexDirection: "row", gap: 2, paddingTop: 1 }}>
                <Button
                  onPress={() => continueDeleteWithNotify(true)}
                  style={{
                    border: "single",
                    borderColor: theme.accent.success,
                    paddingX: 2,
                  }}
                  focusedStyle={{ bg: theme.accent.success }}
                >
                  <Text>Yes (y)</Text>
                </Button>
                <Button
                  onPress={() => continueDeleteWithNotify(false)}
                  style={{
                    border: "single",
                    borderColor: theme.border.normal,
                    paddingX: 2,
                  }}
                  focusedStyle={{ bg: theme.bg.hover }}
                >
                  <Text>No (n)</Text>
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
            bg: theme.bg.primary,
          }}
        >
          <Box
            style={{
              width: 45,
              bg: theme.bg.secondary,
              border: "round",
              borderColor: theme.accent.error,
              padding: 1,
              flexDirection: "column",
              gap: 1,
            }}
          >
            <FocusScope trap>
              <Text style={{ bold: true, color: theme.accent.error }}>
                Delete event?
              </Text>
              <Text style={{ color: theme.text.secondary }}>
                Are you sure you want to delete "{eventTitle}"?
              </Text>
              
              {pendingAction?.scope && (
                <Text style={{ color: theme.text.dim }}>
                  Scope: {pendingAction.scope === "this"
                    ? "This event only"
                    : pendingAction.scope === "following"
                    ? "This and following"
                    : "All in series"}
                </Text>
              )}
              
              {pendingAction?.notifyAttendees !== undefined && (
                <Text style={{ color: theme.text.dim }}>
                  Notify attendees: {pendingAction.notifyAttendees ? "Yes" : "No"}
                </Text>
              )}
              
              <Box style={{ flexDirection: "row", gap: 2, paddingTop: 1 }}>
                <Button
                  onPress={() => confirmDelete()}
                  style={{
                    border: "single",
                    borderColor: theme.accent.error,
                    paddingX: 2,
                  }}
                  focusedStyle={{ bg: theme.accent.error }}
                >
                  <Text>Delete</Text>
                </Button>
                <Button
                  onPress={() => pop()}
                  style={{
                    border: "single",
                    borderColor: theme.border.normal,
                    paddingX: 2,
                  }}
                  focusedStyle={{ bg: theme.bg.hover }}
                >
                  <Text>Cancel</Text>
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
