import React from "react";
import { Box, Text, Portal, ScrollView, Keybind } from "@semos-labs/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { messageLogAtom, type LoggedMessage, type MessageType } from "../state/atoms.ts";
import { popOverlayAtom, clearMessageLogAtom } from "../state/actions.ts";
import { theme } from "./theme.ts";
import { DateTime } from "luxon";

function getTypeColor(type: MessageType): string {
  switch (type) {
    case "success":
      return theme.accent.success;
    case "warning":
      return theme.accent.warning;
    case "error":
      return theme.accent.error;
    case "progress":
      return theme.accent.primary;
    case "info":
    default:
      return theme.text.secondary;
  }
}

function getTypeIcon(type: MessageType): string {
  switch (type) {
    case "success":
      return "✓";
    case "warning":
      return "⚠";
    case "error":
      return "✗";
    case "progress":
      return "⋯";
    case "info":
    default:
      return "·";
  }
}

function MessageRow({ message }: { message: LoggedMessage }) {
  const time = DateTime.fromMillis(message.timestamp).toFormat("HH:mm:ss");
  const typeColor = getTypeColor(message.type);
  const icon = getTypeIcon(message.type);

  return (
    <Box style={{ flexDirection: "row", gap: 1 }}>
      <Text style={{ color: theme.text.dim, width: 8 }}>{time}</Text>
      <Text style={{ color: typeColor, width: 1 }}>{icon}</Text>
      <Text
        style={{
          color: message.type === "error" ? typeColor : theme.text.primary,
          flexGrow: 1,
          flexShrink: 1,
        }}
        wrap="truncate"
      >
        {message.text}
      </Text>
    </Box>
  );
}

export function MessagesDialog() {
  const messages = useAtomValue(messageLogAtom);
  const popOverlay = useSetAtom(popOverlayAtom);
  const clearLog = useSetAtom(clearMessageLogAtom);

  const reversedMessages = [...messages].reverse();

  return (
    <Portal zIndex={100}>
      <Keybind keypress="escape" onPress={() => popOverlay()} />
      <Keybind keypress="c" onPress={() => clearLog()} />
      <Box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Box
          style={{
            width: 70,
            height: "80%",
            bg: theme.modal.background,
            padding: 1,
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <Box
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingBottom: 1,
            }}
          >
            <Text style={{ color: theme.accent.primary, bold: true }}>
              Messages
            </Text>
            <Box style={{ flexDirection: "row", gap: 2 }}>
              <Text style={{ color: theme.text.dim }}>c:clear</Text>
              <Text style={{ color: theme.text.dim }}>esc</Text>
            </Box>
          </Box>

          {/* Content */}
          <ScrollView style={{ flexGrow: 1, flexShrink: 1 }}>
            {reversedMessages.length === 0 ? (
              <Text style={{ color: theme.text.dim }}>No messages yet</Text>
            ) : (
              reversedMessages.map((msg, i) => (
                <MessageRow key={msg.id + "-" + i} message={msg} />
              ))
            )}
          </ScrollView>

          {/* Footer */}
          <Box style={{ paddingTop: 1 }}>
            <Text style={{ color: theme.text.dim }}>
              {messages.length} message{messages.length !== 1 ? "s" : ""} (newest first)
            </Text>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
