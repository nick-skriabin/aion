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
  ScrollView,
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
  { label: "Birthday", value: "birthday" },
];

export function EventDialog() {
  const [dialogEvent, setDialogEvent] = useAtom(dialogEventAtom);
  const isEditMode = useAtomValue(isEditModeAtom);
  const tz = useAtomValue(timezoneAtom);
  const pop = useSetAtom(popOverlayAtom);
  const save = useSetAtom(saveEventAtom);
  
  // Local form state
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [link, setLink] = useState("");
  const [eventType, setEventType] = useState<EventType>("default");
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [attendeesInput, setAttendeesInput] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);
  
  // Initialize form from dialogEvent
  useEffect(() => {
    if (!dialogEvent) return;
    
    setSummary(dialogEvent.summary || "");
    setDescription(dialogEvent.description || "");
    setLocation(dialogEvent.location || "");
    setLink(dialogEvent.hangoutLink || dialogEvent.htmlLink || "");
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
      hangoutLink: link || undefined,
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
  
  // Common input style
  const inputStyle = {
    color: theme.input.text,
    bg: theme.input.background,
  };
  
  return (
    <Portal zIndex={20}>
      <Box
        style={{
          position: "absolute",
          inset: 2,
          flexDirection: "column",
          padding: 1,
          bg: theme.modal.background,
          border: "single",
          borderColor: theme.modal.border,
        }}
      >
        <FocusScope trap>
          {/* Header */}
          <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ bold: true, color: theme.accent.primary }}>
              {isEditMode ? "Edit Event" : "New Event"}
            </Text>
            <Text style={{ color: theme.text.dim }}>esc:cancel</Text>
          </Box>
          
          <ScrollView style={{ flexGrow: 1, paddingTop: 1 }}>
            {/* Title */}
            <Box style={{ paddingBottom: 1 }}>
              <Text style={{ color: theme.text.dim }}>title</Text>
              <Input
                value={summary}
                onChange={setSummary}
                placeholder="Add title"
                style={inputStyle}
              />
            </Box>
            
            {/* Event Type */}
            <Box style={{ paddingBottom: 1 }}>
              <Text style={{ color: theme.text.dim }}>type</Text>
              <Select
                items={EVENT_TYPES}
                value={eventType}
                onChange={(v) => setEventType(v as EventType)}
                highlightColor={theme.accent.primary}
                style={{ bg: theme.input.background }}
              />
            </Box>
            
            {/* All-day toggle */}
            <Box style={{ paddingBottom: 1 }}>
              <Checkbox
                checked={isAllDay}
                onChange={setIsAllDay}
                label="All-day"
                focusedStyle={{ color: theme.accent.primary }}
              />
            </Box>
            
            {/* Time section */}
            <Box style={{ paddingBottom: 1, flexDirection: "row", gap: 2 }}>
              <Box style={{ flexGrow: 1 }}>
                <Text style={{ color: theme.text.dim }}>start</Text>
                <Input
                  value={startDate}
                  onChange={setStartDate}
                  placeholder="YYYY-MM-DD"
                  style={inputStyle}
                />
                {!isAllDay && (
                  <Input
                    value={startTime}
                    onChange={setStartTime}
                    placeholder="HH:MM"
                    style={inputStyle}
                  />
                )}
              </Box>
              <Box style={{ flexGrow: 1 }}>
                <Text style={{ color: theme.text.dim }}>end</Text>
                <Input
                  value={endDate}
                  onChange={setEndDate}
                  placeholder="YYYY-MM-DD"
                  style={inputStyle}
                />
                {!isAllDay && (
                  <Input
                    value={endTime}
                    onChange={setEndTime}
                    placeholder="HH:MM"
                    style={inputStyle}
                  />
                )}
              </Box>
            </Box>
            
            {/* Location */}
            <Box style={{ paddingBottom: 1 }}>
              <Text style={{ color: theme.text.dim }}>location</Text>
              <Input
                value={location}
                onChange={setLocation}
                placeholder="Add location"
                style={inputStyle}
              />
            </Box>
            
            {/* Link */}
            <Box style={{ paddingBottom: 1 }}>
              <Text style={{ color: theme.text.dim }}>link</Text>
              <Input
                value={link}
                onChange={setLink}
                placeholder="https://..."
                style={inputStyle}
              />
            </Box>
            
            {/* Attendees */}
            <Box style={{ paddingBottom: 1 }}>
              <Text style={{ color: theme.text.dim }}>
                attendees ({attendees.length})
              </Text>
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Input
                  value={attendeesInput}
                  onChange={setAttendeesInput}
                  placeholder="email@example.com"
                  style={{ ...inputStyle, flexGrow: 1 }}
                />
                <Button
                  onPress={addAttendee}
                  style={{ paddingX: 1, bg: theme.input.background }}
                  focusedStyle={{ bg: theme.accent.primary, color: "black", bold: true }}
                >
                  <Text>add</Text>
                </Button>
              </Box>
              {attendees.map((email) => (
                <Box key={email} style={{ flexDirection: "row", gap: 1 }}>
                  <Text style={{ color: theme.text.secondary }}>· {email}</Text>
                  <Button onPress={() => removeAttendee(email)}>
                    <Text style={{ color: theme.accent.error }}>×</Text>
                  </Button>
                </Box>
              ))}
            </Box>
            
            {/* Description */}
            <Box style={{ paddingBottom: 1 }}>
              <Text style={{ color: theme.text.dim }}>notes</Text>
              <Input
                value={description}
                onChange={setDescription}
                placeholder="Add notes"
                multiline
                style={{ ...inputStyle, minHeight: 3 }}
              />
            </Box>
          </ScrollView>
          
          {/* Footer buttons */}
          <Box style={{ flexDirection: "row", gap: 2, justifyContent: "flex-end" }}>
            <Button
              onPress={() => pop()}
              style={{ paddingX: 1, bg: theme.input.background }}
              focusedStyle={{ bg: theme.text.dim, color: "black" }}
            >
              <Text>cancel</Text>
            </Button>
            <Button
              onPress={handleSave}
              style={{ paddingX: 1, bg: theme.input.background }}
              focusedStyle={{ bg: theme.accent.primary, color: "black", bold: true }}
            >
              <Text>{isEditMode ? "save" : "create"}</Text>
            </Button>
          </Box>
        </FocusScope>
      </Box>
    </Portal>
  );
}
