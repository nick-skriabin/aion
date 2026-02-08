import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Text,
  Input,
  Button,
  Portal,
  FocusScope,
  useInput,
  useApp,
  createMask,
} from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { DateTime } from "luxon";
import {
  dialogEventAtom,
  timezoneAtom,
} from "../state/atoms.ts";
import { popOverlayAtom, showMessageAtom } from "../state/actions.ts";
import { isAllDay as checkIsAllDay, getDisplayTitle } from "../domain/gcalEvent.ts";
import { parseTimeObject, getLocalTimezone } from "../domain/time.ts";
import { parseNaturalDate, formatParsedPreview, type ParsedDateTime } from "../domain/naturalDate.ts";
import { theme } from "./theme.ts";

const DIALOG_WIDTH = 45;
const LABEL_WIDTH = 8;
const INPUT_WIDTH = 32;

// Input masks for date and time fields
const dateMask = createMask("9999-99-99");
const timeMask = createMask("99:99");

function DialogKeybinds({
  onSend,
  onCancel
}: {
  onSend: () => void;
  onCancel: () => void;
}) {
  useInput((key) => {
    if (key.name === "escape") {
      onCancel();
    }
    if (key.name === "s" && key.ctrl) {
      onSend();
    }
  });

  return null;
}

export function ProposeTimeDialog() {
  const dialogEvent = useAtomValue(dialogEventAtom);
  const tz = useAtomValue(timezoneAtom) || getLocalTimezone();
  const pop = useSetAtom(popOverlayAtom);
  const showMessage = useSetAtom(showMessageAtom);

  // Form state
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [message, setMessage] = useState("");

  // Natural language date input
  const [whenInput, setWhenInput] = useState("");
  const [whenPreview, setWhenPreview] = useState<ParsedDateTime | null>(null);

  // Track if we've initialized to prevent re-initialization during background sync
  const initializedEventIdRef = useRef<string | null>(null);

  // Initialize form from event
  useEffect(() => {
    if (!dialogEvent) return;

    // Only initialize once per event - prevent reset during background sync
    const eventKey = dialogEvent.id || "new";
    if (initializedEventIdRef.current === eventKey) return;
    initializedEventIdRef.current = eventKey;

    const allDay = checkIsAllDay(dialogEvent);
    const start = parseTimeObject(dialogEvent.start, tz);
    const end = parseTimeObject(dialogEvent.end, tz);

    setStartDate(start.toFormat("yyyy-MM-dd"));
    // For all-day events, default to reasonable times for proposing
    setStartTime(allDay ? "09:00" : start.toFormat("HH:mm"));
    setEndDate(end.toFormat("yyyy-MM-dd"));
    setEndTime(allDay ? "10:00" : end.toFormat("HH:mm"));
  }, [dialogEvent, tz]);

  const handleSend = useCallback(async () => {
    if (!dialogEvent) return;

    // In a real implementation, this would call Google Calendar's 
    // "propose new time" API. For now, we'll show a message.
    // The Google Calendar API doesn't have a direct "propose time" endpoint
    // for third-party apps - it's typically done through email.

    showMessage({
      text: "Time proposal sent to organizer (feature coming soon)",
      type: "info"
    });
    initializedEventIdRef.current = null; // Reset for next dialog open
    pop();
  }, [dialogEvent, startDate, startTime, endDate, endTime, message, pop, showMessage]);

  const handleCancel = useCallback(() => {
    initializedEventIdRef.current = null; // Reset for next dialog open
    pop();
  }, [pop]);

  // Handle natural language "when" input
  const handleWhenChange = useCallback((value: string) => {
    setWhenInput(value);
    if (value.trim()) {
      const parsed = parseNaturalDate(value);
      setWhenPreview(parsed);
    } else {
      setWhenPreview(null);
    }
  }, []);

  // Apply the parsed date when user presses Enter
  const applyWhenInput = useCallback(() => {
    if (whenPreview) {
      setStartDate(whenPreview.date.toFormat("yyyy-MM-dd"));
      
      if (whenPreview.isDateRange) {
        // Date range: multi-day event
        setStartTime("09:00"); // Default to morning
        setEndTime("17:00"); // Default to end of day
        const endDateTime = whenPreview.endDate || whenPreview.date;
        setEndDate(endDateTime.toFormat("yyyy-MM-dd"));
      } else if (whenPreview.hasTime) {
        // Timed event
        setStartTime(whenPreview.date.toFormat("HH:mm"));

        // Use parsed end date if duration was specified, otherwise default to 1 hour
        const endDateTime = whenPreview.endDate || whenPreview.date.plus({ hours: 1 });
        setEndDate(endDateTime.toFormat("yyyy-MM-dd"));
        setEndTime(endDateTime.toFormat("HH:mm"));
      } else {
        // All-day event - default to reasonable times
        setStartTime("09:00");
        setEndTime("10:00");
        setEndDate(whenPreview.date.toFormat("yyyy-MM-dd"));
      }
      setWhenInput("");
      setWhenPreview(null);
    }
  }, [whenPreview]);

  const { rows: terminalHeight } = useApp();
  const dialogMaxHeight = Math.floor(terminalHeight * 0.6);

  // Handler for Ctrl+S in inputs
  const handleInputKeyPress = useCallback((key: { name?: string; ctrl?: boolean }) => {
    if (key.name === "s" && key.ctrl) {
      handleSend();
      return true;
    }
    return false;
  }, [handleSend]);

  if (!dialogEvent) return null;

  const eventTitle = getDisplayTitle(dialogEvent);
  const organizer = dialogEvent.organizer?.displayName || dialogEvent.organizer?.email || "Unknown";
  const isAllDay = checkIsAllDay(dialogEvent);

  const inputStyle = {
    bg: theme.input.background,
    color: theme.input.foreground,
  };
  
  const focusedInputStyle = {
    bg: "#3a3a3a",
    color: "white" as const,
  };

  return (
    <Portal zIndex={20}>
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
            width: DIALOG_WIDTH,
            maxWidth: DIALOG_WIDTH,
            maxHeight: dialogMaxHeight,
            flexDirection: "column",
            padding: 1,
            bg: theme.modal.background,
            border: "none",
            clip: true,
          }}
        >
          <FocusScope trap>
            <DialogKeybinds onSend={handleSend} onCancel={handleCancel} />

            {/* Header */}
            <Box style={{ flexDirection: "column" }}>
              <Text style={{ bold: true, color: theme.accent.primary }}>
                Propose New Time
              </Text>
              <Text style={{ color: theme.text.dim }} wrap="truncate">
                for "{eventTitle}"
              </Text>
              <Text style={{ color: theme.text.dim, dim: true }}>
                Organizer: {organizer}
              </Text>
            </Box>

            {/* Form */}
            <Box style={{ flexDirection: "column", gap: 0, paddingY: 1 }}>
              {/* Natural language date input */}
              <Box style={{ flexDirection: "column", gap: 0 }}>
                <Box style={{ flexDirection: "row", gap: 1 }}>
                  <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>when</Text>
                  <Box style={{ width: INPUT_WIDTH, clip: true }}>
                    <Input
                      value={whenInput}
                      onChange={handleWhenChange}
                      onKeyPress={(key) => {
                        if (key.name === "s" && key.ctrl) {
                          handleSend();
                          return true;
                        }
                        if (key.name === "return" && whenPreview) {
                          applyWhenInput();
                          return true;
                        }
                        return false;
                      }}
                      placeholder="tomorrow 3pm, mar 5-10..."
                      style={{ ...inputStyle }}
                      focusedStyle={focusedInputStyle}
                    />
                  </Box>
                </Box>
                {whenPreview && (
                  <Box style={{ flexDirection: "row", gap: 1, marginLeft: LABEL_WIDTH + 1 }}>
                    <Text style={{ color: theme.accent.success, dim: true }}>
                      → {formatParsedPreview(whenPreview)} (Enter)
                    </Text>
                  </Box>
                )}
              </Box>

              {/* Start */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>start</Text>
                <Box style={{ width: 12, clip: true }}>
                  <Input
                    value={startDate}
                    onChange={setStartDate}
                    onBeforeChange={dateMask}
                    placeholder="YYYY-MM-DD"
                    style={{ ...inputStyle }}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={handleInputKeyPress}
                  />
                </Box>
                {!isAllDay && (
                  <Box style={{ width: 7, clip: true }}>
                    <Input
                      value={startTime}
                      onChange={setStartTime}
                      onBeforeChange={timeMask}
                      placeholder="HH:MM"
                      style={{ ...inputStyle }}
                      focusedStyle={focusedInputStyle}
                      onKeyPress={handleInputKeyPress}
                    />
                  </Box>
                )}
              </Box>

              {/* End */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>end</Text>
                <Box style={{ width: 12, clip: true }}>
                  <Input
                    value={endDate}
                    onChange={setEndDate}
                    onBeforeChange={dateMask}
                    placeholder="YYYY-MM-DD"
                    style={{ ...inputStyle }}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={handleInputKeyPress}
                  />
                </Box>
                {!isAllDay && (
                  <Box style={{ width: 7, clip: true }}>
                    <Input
                      value={endTime}
                      onChange={setEndTime}
                      onBeforeChange={timeMask}
                      placeholder="HH:MM"
                      style={{ ...inputStyle }}
                      focusedStyle={focusedInputStyle}
                      onKeyPress={handleInputKeyPress}
                    />
                  </Box>
                )}
              </Box>

              {/* Optional message */}
              <Box style={{ flexDirection: "row", gap: 1, marginTop: 1 }}>
                <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>message</Text>
                <Box style={{ width: INPUT_WIDTH, clip: true }}>
                  <Input
                    value={message}
                    onChange={setMessage}
                    placeholder="Optional message to organizer"
                    style={{ ...inputStyle }}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={handleInputKeyPress}
                  />
                </Box>
              </Box>
            </Box>

            {/* Footer */}
            <Box style={{ flexDirection: "row", gap: 1, justifyContent: "space-between", paddingTop: 1 }}>
              <Text style={{ color: theme.text.dim, dim: true }}>^S send</Text>
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Button
                  onPress={handleCancel}
                  style={{ paddingX: 1 }}
                  focusedStyle={{ bg: theme.text.dim, color: "black" }}
                >
                  <Text>cancel</Text>
                </Button>
                <Button
                  onPress={handleSend}
                  style={{ paddingX: 1 }}
                  focusedStyle={{ bg: theme.accent.primary, color: "black", bold: true }}
                >
                  <Text>propose</Text>
                </Button>
              </Box>
            </Box>
          </FocusScope>
        </Box>
      </Box>
    </Portal>
  );
}
