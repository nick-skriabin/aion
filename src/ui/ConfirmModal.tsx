import React, { useState } from "react";
import { Box, Text, Button, Portal, FocusScope, Radio } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  pendingActionAtom,
  topOverlayAtom,
  type RecurrenceScope,
} from "../state/atoms.ts";
import {
  popOverlayAtom,
  continueEditWithScopeAtom,
} from "../state/actions.ts";
import { useDeleteEvent } from "./hooks/useDeleteEvent.tsx";
import { theme } from "./theme.ts";

/**
 * ConfirmModal - Only handles scope selection for recurring events
 * All other confirmations (delete, notify, leave) use useDialog() via useDeleteEvent hook
 */
export function ConfirmModal() {
  const { continueWithScope } = useDeleteEvent();
  const overlay = useAtomValue(topOverlayAtom);
  const pendingAction = useAtomValue(pendingActionAtom);
  const pop = useSetAtom(popOverlayAtom);
  const continueEditWithScope = useSetAtom(continueEditWithScopeAtom);
  
  const [selectedScope, setSelectedScope] = useState<RecurrenceScope>("this");
  
  const modalType = overlay?.kind === "confirm" ? overlay.payload?.type as string : null;
  
  // Only render for scope selection (needs Radio buttons)
  if (!overlay || overlay.kind !== "confirm") return null;
  if (modalType !== "deleteScope" && modalType !== "editScope") return null;
  
  const isDelete = modalType === "deleteScope";
  
  const handleContinue = () => {
    pop(); // Close scope selector first
    
    if (isDelete && pendingAction?.eventId) {
      // Use the hook's continueWithScope which handles the rest with useDialog
      continueWithScope(pendingAction.eventId, selectedScope);
    } else {
      // For edit, continue with the existing atom-based flow
      continueEditWithScope(selectedScope);
    }
  };
  
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
                onPress={handleContinue}
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
