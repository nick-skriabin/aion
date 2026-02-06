import React, { useState, useEffect } from "react";
import {
  Box,
  Text,
  Input,
  Button,
  Checkbox,
  Select,
  Portal,
  FocusScope,
  useInput,
} from "@nick-skriabin/glyph";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { DateTime } from "luxon";
import {
  dialogEventAtom,
  isEditModeAtom,
  timezoneAtom,
} from "../state/atoms.ts";
import { popOverlayAtom, saveEventAtom } from "../state/actions.ts";
import type { GCalEvent, EventType } from "../domain/gcalEvent.ts";
import { isAllDay as checkIsAllDay } from "../domain/gcalEvent.ts";
import { parseTimeObject, toTimeObject, getLocalTimezone } from "../domain/time.ts";
import { theme } from "./theme.ts";

const EVENT_TYPES: Array<{ label: string; value: EventType }> = [
  { label: "Event", value: "default" },
  { label: "Out of office", value: "outOfOffice" },
  { label: "Focus time", value: "focusTime" },
];

const DIALOG_WIDTH = 50;

function DialogKeybinds({ onSave }: { onSave: () => void }) {
  const pop = useSetAtom(popOverlayAtom);
  
  useInput((key) => {
    if (key.name === "escape") {
      pop();
    }
    if (key.name === "s" && key.ctrl) {
      onSave();
    }
  });
  
  return null;
}

export function EventDialog() {
  const [dialogEvent, setDialogEvent] = useAtom(dialogEventAtom);
  const isEditMode = useAtomValue(isEditModeAtom);
  const tz = useAtomValue(timezoneAtom);
  const pop = useSetAtom(popOverlayAtom);
  const save = useSetAtom(saveEventAtom);
  
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventType, setEventType] = useState<EventType>("default");
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [attendeesInput, setAttendeesInput] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);
  
  useEffect(() => {
    if (!dialogEvent) return;
    
    setSummary(dialogEvent.summary || "");
    setDescription(dialogEvent.description || "");
    setLocation(dialogEvent.location || "");
    setEventType(dialogEvent.eventType || "default");
    
    const allDay = dialogEvent.start ? checkIsAllDay(dialogEvent as GCalEvent) : false;
    setIsAllDay(allDay);
    
    if (dialogEvent.start) {
      const start = parseTimeObject(dialogEvent.start, tz);
      setStartDate(start.toFormat("yyyy-MM-dd"));
      setStartTime(start.toFormat("HH:mm"));
    }
    
    if (dialogEvent.end) {
      const end = parseTimeObject(dialogEvent.end, tz);
      setEndDate(end.toFormat("yyyy-MM-dd"));
      setEndTime(end.toFormat("HH:mm"));
    }
    
    if (dialogEvent.attendees) {
      setAttendees(dialogEvent.attendees.map((a) => a.email));
    } else {
      setAttendees([]);
    }
  }, [dialogEvent, tz]);
  
  if (!dialogEvent) return null;
  
  const handleSave = () => {
    const localTz = getLocalTimezone();
    
    let start: GCalEvent["start"];
    let end: GCalEvent["end"];
    
    if (isAllDay) {
      start = { date: startDate };
      const endDt = DateTime.fromISO(endDate).plus({ days: 1 });
      end = { date: endDt.toFormat("yyyy-MM-dd") };
    } else {
      const startDt = DateTime.fromISO(`${startDate}T${startTime}`, { zone: localTz });
      const endDt = DateTime.fromISO(`${endDate}T${endTime}`, { zone: localTz });
      start = toTimeObject(startDt, false, localTz);
      end = toTimeObject(endDt, false, localTz);
    }
    
    const updatedEvent: Partial<GCalEvent> = {
      ...dialogEvent,
      summary: summary || "",
      description: description || undefined,
      location: location || undefined,
      eventType,
      start,
      end,
      attendees: attendees.length > 0
        ? attendees.map((email) => ({ email, responseStatus: "needsAction" as const }))
        : undefined,
    };
    
    setDialogEvent(updatedEvent);
    save();
  };
  
  const addAttendee = () => {
    const email = attendeesInput.trim();
    if (email && email.includes("@") && !attendees.includes(email)) {
      setAttendees([...attendees, email]);
      setAttendeesInput("");
    }
  };
  
  const removeAttendee = (email: string) => {
    setAttendees(attendees.filter((a) => a !== email));
  };
  
  const inputStyle = {
    color: theme.input.text,
    bg: theme.input.background,
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
            flexDirection: "column",
            padding: 1,
            bg: theme.modal.background,
          }}
        >
          <FocusScope trap>
            <DialogKeybinds onSave={handleSave} />
            
            {/* Header */}
            <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ bold: true, color: theme.accent.primary }}>
                {isEditMode ? "Edit Event" : "New Event"}
              </Text>
              <Text style={{ color: theme.text.dim, dim: true }}>^S save</Text>
            </Box>
            
            {/* Form fields */}
            <Box style={{ flexDirection: "column", paddingY: 1 }}>
              {/* Title */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: 8 }}>title</Text>
                <Input
                  value={summary}
                  onChange={setSummary}
                  placeholder="Event title"
                  style={{ ...inputStyle, flexGrow: 1 }}
                />
              </Box>
              
              {/* Type */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: 8 }}>type</Text>
                <Select
                  items={EVENT_TYPES}
                  value={eventType}
                  onChange={(v) => setEventType(v as EventType)}
                  highlightColor={theme.accent.primary}
                  style={{ bg: theme.input.background }}
                />
                <Checkbox
                  checked={isAllDay}
                  onChange={setIsAllDay}
                  label="all-day"
                  focusedStyle={{ color: theme.accent.primary }}
                />
              </Box>
              
              {/* Start */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: 8 }}>start</Text>
                <Input
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="YYYY-MM-DD"
                  style={{ ...inputStyle, width: 12 }}
                />
                {!isAllDay && (
                  <Input
                    value={startTime}
                    onChange={setStartTime}
                    placeholder="HH:MM"
                    style={{ ...inputStyle, width: 7 }}
                  />
                )}
              </Box>
              
              {/* End */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: 8 }}>end</Text>
                <Input
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="YYYY-MM-DD"
                  style={{ ...inputStyle, width: 12 }}
                />
                {!isAllDay && (
                  <Input
                    value={endTime}
                    onChange={setEndTime}
                    placeholder="HH:MM"
                    style={{ ...inputStyle, width: 7 }}
                  />
                )}
              </Box>
              
              {/* Location */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: 8 }}>location</Text>
                <Input
                  value={location}
                  onChange={setLocation}
                  placeholder="Add location"
                  style={{ ...inputStyle, flexGrow: 1 }}
                />
              </Box>
              
              {/* Attendees */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: 8 }}>guests</Text>
                <Input
                  value={attendeesInput}
                  onChange={setAttendeesInput}
                  onKeyPress={(key) => {
                    if (key.name === "return" && attendeesInput.trim()) {
                      addAttendee();
                    }
                  }}
                  placeholder="email@example.com"
                  style={{ ...inputStyle, flexGrow: 1 }}
                />
              </Box>
              
              {/* Attendees list */}
              {attendees.length > 0 && (
                <Box style={{ flexDirection: "column", paddingLeft: 9 }}>
                  {attendees.map((email) => (
                    <Box key={email} style={{ flexDirection: "row", gap: 1 }}>
                      <Text style={{ color: theme.text.secondary }}>· {email}</Text>
                      <Button onPress={() => removeAttendee(email)}>
                        <Text style={{ color: theme.accent.error }}>×</Text>
                      </Button>
                    </Box>
                  ))}
                </Box>
              )}
              
              {/* Notes */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: 8 }}>notes</Text>
                <Input
                  value={description}
                  onChange={setDescription}
                  placeholder="Add notes"
                  style={{ ...inputStyle, flexGrow: 1 }}
                />
              </Box>
            </Box>
            
            {/* Footer */}
            <Box style={{ flexDirection: "row", gap: 1, justifyContent: "flex-end" }}>
              <Button
                onPress={() => pop()}
                style={{ paddingX: 1 }}
                focusedStyle={{ bg: theme.text.dim, color: "black" }}
              >
                <Text>cancel</Text>
              </Button>
              <Button
                onPress={handleSave}
                style={{ paddingX: 1 }}
                focusedStyle={{ bg: theme.accent.primary, color: "black", bold: true }}
              >
                <Text>{isEditMode ? "save" : "create"}</Text>
              </Button>
            </Box>
          </FocusScope>
        </Box>
      </Box>
    </Portal>
  );
}
