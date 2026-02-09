import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  useInput,
  useApp,
  createMask,
  type Style,
  JumpNav,
} from "@nick-skriabin/glyph";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { DateTime } from "luxon";
import {
  dialogEventAtom,
  isEditModeAtom,
  addGoogleMeetAtom,
  timezoneAtom,
  accountsAtom,
  calendarColorMapAtom,
  getCalendarColor,
  calendarsByAccountAtom,
  type CalendarInfo,
} from "../state/atoms.ts";
import { popOverlayAtom, saveEventAtom } from "../state/actions.ts";
import type { GCalEvent, EventType } from "../domain/gcalEvent.ts";
import { WeekdayPicker } from "./WeekdayPicker.tsx";
import { isAllDay as checkIsAllDay } from "../domain/gcalEvent.ts";
import { parseTimeObject, toTimeObject, getLocalTimezone } from "../domain/time.ts";
import { parseNaturalDate, formatParsedPreview, type ParsedDateTime } from "../domain/naturalDate.ts";
import {
  type RecurrenceRule,
  type Frequency,
  type EndType,
  getDefaultRecurrenceRule,
  buildRRule,
  parseRRule,
  getRRuleFromRecurrence,
  formatRecurrenceRule,
} from "../domain/recurrence.ts";
import { theme } from "./theme.ts";

// Input masks for date and time fields
const dateMask = createMask("9999-99-99");
const timeMask = createMask("99:99");

const EVENT_TYPES: Array<{ label: string; value: EventType }> = [
  { label: "Event", value: "default" },
  { label: "Out of office", value: "outOfOffice" },
  { label: "Focus time", value: "focusTime" },
];

const DIALOG_WIDTH = 60;
const LABEL_WIDTH = 8;
const INPUT_WIDTH = 47; // DIALOG_WIDTH - padding(2) - border(2) - LABEL_WIDTH - gap(1)

interface OriginalValues {
  summary: string;
  description: string;
  location: string;
  eventType: EventType;
  isAllDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  attendees: string[];
  accountEmail: string;
}

function DialogKeybinds({
  onSave,
  onCancel
}: {
  onSave: () => void;
  onCancel: () => void;
}) {
  useInput((key) => {
    if (key.name === "escape") {
      onCancel();
    }
    if (key.name === "s" && key.ctrl) {
      onSave();
    }
  });

  return null;
}

export function EventDialog() {
  const { rows: terminalHeight } = useApp();
  const [dialogEvent, setDialogEvent] = useAtom(dialogEventAtom);
  const isEditMode = useAtomValue(isEditModeAtom);
  const tz = useAtomValue(timezoneAtom);
  const accounts = useAtomValue(accountsAtom);
  const calendarColorMap = useAtomValue(calendarColorMapAtom);
  const pop = useSetAtom(popOverlayAtom);
  const save = useSetAtom(saveEventAtom);

  // Calculate max dialog height (80% of screen)
  const maxDialogHeight = Math.floor(terminalHeight * 0.8);

  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [eventType, setEventType] = useState<EventType>("default");
  const [isAllDay, setIsAllDay] = useState(false);
  const [addGoogleMeet, setAddGoogleMeet] = useAtom(addGoogleMeetAtom);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [attendeesInput, setAttendeesInput] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);
  const [accountEmail, setAccountEmail] = useState("");

  // Calendars for selected account
  const calendarsByAccount = useAtomValue(calendarsByAccountAtom);
  const calendarsForAccount = useMemo(() => calendarsByAccount[accountEmail] ?? [], [calendarsByAccount, accountEmail]);
  const [calendarId, setCalendarId] = useState<string | null>(null);

  // Recurrence
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(getDefaultRecurrenceRule());

  // Natural language date input
  const [whenInput, setWhenInput] = useState("");
  const [whenPreview, setWhenPreview] = useState<ParsedDateTime | null>(null);

  // Track original values for change detection
  const originalValuesRef = useRef<OriginalValues | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Track if we've initialized to prevent re-initialization during background sync
  const initializedEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!dialogEvent) return;

    // Only initialize once per event - prevent reset during background sync
    const eventKey = dialogEvent.id || "new";
    if (initializedEventIdRef.current === eventKey) return;
    initializedEventIdRef.current = eventKey;

    const summaryVal = dialogEvent.summary || "";
    const descriptionVal = dialogEvent.description || "";
    const locationVal = dialogEvent.location || "";
    const eventTypeVal = dialogEvent.eventType || "default";
    const allDayVal = dialogEvent.start ? checkIsAllDay(dialogEvent as GCalEvent) : false;
    // Default to first account for new events, or use existing account
    const accountVal = dialogEvent.accountEmail || accounts[0]?.email || "";
    // Default to primary calendar or existing calendar
    // Look up the actual primary calendar ID for this account
    const accountCalendars = calendarsByAccount[accountVal] || [];
    const primaryCalendar = accountCalendars.find(c => c.primary);
    const calendarVal = dialogEvent.calendarId || primaryCalendar?.id || accountCalendars[0]?.id || "";

    let startDateVal = "";
    let startTimeVal = "";
    let endDateVal = "";
    let endTimeVal = "";

    if (dialogEvent.start) {
      const start = parseTimeObject(dialogEvent.start, tz);
      startDateVal = start.toFormat("yyyy-MM-dd");
      startTimeVal = start.toFormat("HH:mm");
    }

    if (dialogEvent.end) {
      const end = parseTimeObject(dialogEvent.end, tz);
      endDateVal = end.toFormat("yyyy-MM-dd");
      endTimeVal = end.toFormat("HH:mm");
    }

    const attendeesVal = dialogEvent.attendees?.map((a) => a.email) || [];

    // Set current values
    setSummary(summaryVal);
    setDescription(descriptionVal);
    setLocation(locationVal);
    setEventType(eventTypeVal);
    setIsAllDay(allDayVal);
    setStartDate(startDateVal);
    setStartTime(startTimeVal);
    setEndDate(endDateVal);
    setEndTime(endTimeVal);
    setAttendees(attendeesVal);
    setAccountEmail(accountVal);
    setCalendarId(calendarVal);

    // Initialize recurrence from existing event
    const existingRRule = getRRuleFromRecurrence(dialogEvent.recurrence);
    if (existingRRule) {
      const parsed = parseRRule(existingRRule);
      if (parsed) {
        setIsRecurring(true);
        setRecurrenceRule(parsed);
      }
    } else {
      setIsRecurring(false);
      setRecurrenceRule(getDefaultRecurrenceRule());
    }

    // Clear when input on init
    setWhenInput("");
    setWhenPreview(null);

    // Store original values for comparison
    originalValuesRef.current = {
      summary: summaryVal,
      description: descriptionVal,
      location: locationVal,
      eventType: eventTypeVal,
      isAllDay: allDayVal,
      startDate: startDateVal,
      startTime: startTimeVal,
      endDate: endDateVal,
      endTime: endTimeVal,
      attendees: attendeesVal,
      accountEmail: accountVal,
    };
  }, [dialogEvent, tz, accounts]);

  // Check if there are unsaved changes
  const hasChanges = useCallback(() => {
    const orig = originalValuesRef.current;
    if (!orig) return false;

    return (
      summary !== orig.summary ||
      description !== orig.description ||
      location !== orig.location ||
      eventType !== orig.eventType ||
      isAllDay !== orig.isAllDay ||
      startDate !== orig.startDate ||
      startTime !== orig.startTime ||
      endDate !== orig.endDate ||
      endTime !== orig.endTime ||
      attendees.length !== orig.attendees.length ||
      attendees.some((a, i) => a !== orig.attendees[i]) ||
      accountEmail !== orig.accountEmail
    );
  }, [summary, description, location, eventType, isAllDay, startDate, startTime, endDate, endTime, attendees, accountEmail]);

  const handleCancel = useCallback(() => {
    if (hasChanges()) {
      setShowDiscardConfirm(true);
    } else {
      initializedEventIdRef.current = null; // Reset for next dialog open
      pop();
    }
  }, [hasChanges, pop]);

  const handleDiscardConfirm = useCallback(() => {
    setShowDiscardConfirm(false);
    initializedEventIdRef.current = null; // Reset for next dialog open
    pop();
  }, [pop]);

  const handleDiscardCancel = useCallback(() => {
    setShowDiscardConfirm(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!dialogEvent) return;

    const localTz = getLocalTimezone();

    let start: GCalEvent["start"];
    let end: GCalEvent["end"];

    if (isAllDay) {
      // All-day events use date format
      start = { date: startDate };
      const endDt = DateTime.fromISO(endDate).plus({ days: 1 });
      end = { date: endDt.toFormat("yyyy-MM-dd") };
    } else {
      // Timed events use dateTime format - ensure times have values
      const effectiveStartTime = startTime || "09:00";
      const effectiveEndTime = endTime || "10:00";

      const startDt = DateTime.fromISO(`${startDate}T${effectiveStartTime}`, { zone: localTz });
      const endDt = DateTime.fromISO(`${endDate}T${effectiveEndTime}`, { zone: localTz });

      // Validate DateTime objects are valid
      if (!startDt.isValid || !endDt.isValid) {
        return; // Don't save if dates are invalid
      }

      start = toTimeObject(startDt, false, localTz);
      end = toTimeObject(endDt, false, localTz);
    }

    // Build recurrence array if recurring
    let recurrence: string[] | undefined;
    if (isRecurring) {
      recurrence = [buildRRule(recurrenceRule)];
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
      accountEmail: accountEmail || undefined,
      calendarId: calendarId || "primary",
      recurrence,
    };

    setDialogEvent(updatedEvent);
    initializedEventIdRef.current = null; // Reset for next dialog open
    save();
  }, [dialogEvent, isAllDay, startDate, endDate, startTime, endTime, summary, description, location, eventType, attendees, accountEmail, calendarId, isRecurring, recurrenceRule, setDialogEvent, save]);

  // Handler for Ctrl+S in inputs
  const handleInputKeyPress = useCallback((key: { name?: string; ctrl?: boolean }) => {
    if (key.name === "s" && key.ctrl) {
      handleSave();
      return true;
    }
    return false;
  }, [handleSave]);

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
        // Date range: set as all-day event spanning multiple days
        setIsAllDay(true);
        setStartTime("");
        setEndTime("");
        // End date is exclusive in Google Calendar for all-day events
        const endDateTime = whenPreview.endDate || whenPreview.date;
        setEndDate(endDateTime.toFormat("yyyy-MM-dd"));
      } else if (whenPreview.hasTime) {
        // Timed event
        setIsAllDay(false);
        setStartTime(whenPreview.date.toFormat("HH:mm"));

        // Use parsed end date if duration was specified, otherwise default to 1 hour
        const endDateTime = whenPreview.endDate || whenPreview.date.plus({ hours: 1 });
        setEndDate(endDateTime.toFormat("yyyy-MM-dd"));
        setEndTime(endDateTime.toFormat("HH:mm"));
      } else {
        // Single all-day date
        setIsAllDay(true);
        setStartTime("");
        setEndTime("");
        setEndDate(whenPreview.date.toFormat("yyyy-MM-dd"));
      }
      setWhenInput("");
      setWhenPreview(null);
    }
  }, [whenPreview]);

  const inputStyle = {
    color: theme.input.text,
    bg: theme.input.background,
  };

  const focusedInputStyle: Style = {
    bg: "#3a3a3a",
    color: "white" as const,
  };

  const dropdownStyle: Style = {
    bg: "#1a1a1a",
    color: "white" as const,
  };

  if (!dialogEvent) {
    return null;
  }

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
            maxHeight: maxDialogHeight,
            flexDirection: "column",
            paddingX: 1,
            bg: theme.modal.background,
            border: "none",
            clip: true,
          }}
        >
          <FocusScope trap>
            <DialogKeybinds onSave={handleSave} onCancel={handleCancel} />

            {/* Header */}
            <Box style={{ flexDirection: "row", justifyContent: "space-between", clip: true }}>
              <Text style={{ bold: true, color: theme.accent.primary }}>
                {isEditMode ? "Edit Event" : "New Event"}
              </Text>
              <Text style={{ color: theme.text.dim, dim: true }}>^S save</Text>
            </Box>

            {/* Form fields - scrollable */}
            <ScrollView style={{ flexGrow: 1, flexShrink: 1 }}>
              <Box style={{ flexDirection: "column", paddingY: 1, clip: true }}>
                {/* Title */}
                <Box style={{ flexDirection: "row", gap: 1, clip: true }}>
                  <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>title</Text>
                  <Box style={{ width: INPUT_WIDTH, clip: true }}>
                    <Input
                      value={summary}
                      onChange={setSummary}
                      placeholder="Event title"
                      style={{ ...inputStyle }}
                      focusedStyle={focusedInputStyle}
                      onKeyPress={handleInputKeyPress}
                    />
                  </Box>
                </Box>

                {/* Account */}
                {accounts.length > 0 && (
                  <Box style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
                    <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>account</Text>
                    <Select
                      items={accounts.map((acc) => ({
                        label: acc.email,
                        value: acc.email
                      }))}
                      value={accountEmail}
                      onChange={(email) => {
                        setAccountEmail(email);
                        // Reset to primary calendar when account changes
                        const newAccountCalendars = calendarsByAccount[email] || [];
                        const newPrimaryCal = newAccountCalendars.find(c => c.primary);
                        setCalendarId(newPrimaryCal?.id || newAccountCalendars[0]?.id || "");
                      }}
                      highlightColor={theme.accent.primary}
                      style={{ bg: theme.input.background }}
                      focusedStyle={focusedInputStyle}
                      dropdownStyle={dropdownStyle}
                    />
                  </Box>
                )}

                {/* Calendar */}
                <Box style={{ flexDirection: "row", gap: 1, alignItems: "center" }}>
                  <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>calendar</Text>
                  <Text style={{ color: getCalendarColor(accountEmail, calendarId || calendarsForAccount.find(c => c.primary)?.id, calendarColorMap) }}>●</Text>
                  <Select
                    items={calendarsForAccount.map((cal) => ({
                      label: cal.primary ? `★ ${cal.summary}` : cal.summary,
                      value: cal.id
                    }))}
                    disabled={calendarsForAccount.length === 0}
                    value={calendarId ?? calendarsForAccount.find(c => c.primary)?.id}
                    onChange={setCalendarId}
                    placeholder={calendarsForAccount.length ? "Select Calendar" : "Loading..."}
                    highlightColor={theme.accent.primary}
                    style={{ bg: theme.input.background }}
                    focusedStyle={focusedInputStyle}
                    dropdownStyle={dropdownStyle}
                  />
                </Box>

                {/* Type */}
                <Box style={{ flexDirection: "row", gap: 1 }}>
                  <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>type</Text>
                  <Select
                    items={EVENT_TYPES}
                    value={eventType}
                    onChange={(v) => setEventType(v as EventType)}
                    highlightColor={theme.accent.primary}
                    style={{ bg: theme.input.background }}
                    focusedStyle={focusedInputStyle}
                    dropdownStyle={dropdownStyle}
                  />
                  <Checkbox
                    checked={isAllDay}
                    onChange={(checked) => {
                      setIsAllDay(checked);
                      // When unchecking all-day, ensure times have default values
                      if (!checked) {
                        if (!startTime) setStartTime("09:00");
                        if (!endTime) setEndTime("10:00");
                      }
                    }}
                    label="all-day"
                    focusedStyle={{ color: theme.accent.primary }}
                  />
                </Box>

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
                            handleSave();
                            return true;
                          }
                          if (key.name === "return" && whenPreview) {
                            applyWhenInput();
                            return true;
                          }
                          return false;
                        }}
                        placeholder="tomorrow 3pm, from mar 5 for 2 weeks..."
                        style={{ ...inputStyle }}
                        focusedStyle={focusedInputStyle}
                      />
                    </Box>
                  </Box>
                  {whenPreview && (
                    <Box style={{ flexDirection: "row", gap: 1, marginLeft: LABEL_WIDTH + 1 }}>
                      <Text style={{ color: theme.accent.success, dim: true }}>
                        → {formatParsedPreview(whenPreview)} (Enter to apply)
                      </Text>
                    </Box>
                  )}
                </Box>

                {/* Start */}
                <Box style={{ flexDirection: "row", gap: 1 }}>
                  <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>start</Text>
                  <Input
                    value={startDate}
                    onChange={setStartDate}
                    onBeforeChange={dateMask}
                    placeholder="YYYY-MM-DD"
                    style={{ ...inputStyle, width: 12 }}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={handleInputKeyPress}
                  />
                  {!isAllDay && (
                    <Input
                      value={startTime}
                      onChange={setStartTime}
                      onBeforeChange={timeMask}
                      placeholder="HH:MM"
                      style={{ ...inputStyle, width: 7 }}
                      focusedStyle={focusedInputStyle}
                      onKeyPress={handleInputKeyPress}
                    />
                  )}
                </Box>

                {/* End */}
                <Box style={{ flexDirection: "row", gap: 1 }}>
                  <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>end</Text>
                  <Input
                    value={endDate}
                    onChange={setEndDate}
                    onBeforeChange={dateMask}
                    placeholder="YYYY-MM-DD"
                    style={{ ...inputStyle, width: 12 }}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={handleInputKeyPress}
                  />
                  {!isAllDay && (
                    <Input
                      value={endTime}
                      onChange={setEndTime}
                      onBeforeChange={timeMask}
                      placeholder="HH:MM"
                      style={{ ...inputStyle, width: 7 }}
                      focusedStyle={focusedInputStyle}
                      onKeyPress={handleInputKeyPress}
                    />
                  )}
                </Box>

                {/* Location */}
                <Box style={{ flexDirection: "row", gap: 1, clip: true }}>
                  <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>location</Text>
                  <Box style={{ width: INPUT_WIDTH, clip: true }}>
                    <Input
                      value={location}
                      onChange={setLocation}
                      placeholder="Add location"
                      style={{ ...inputStyle }}
                      focusedStyle={focusedInputStyle}
                      onKeyPress={handleInputKeyPress}
                    />
                  </Box>
                </Box>

                {/* Attendees */}
                <Box style={{ flexDirection: "row", gap: 1, clip: true }}>
                  <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>guests</Text>
                  <Box style={{ width: INPUT_WIDTH, clip: true }}>
                    <Input
                      value={attendeesInput}
                      onChange={setAttendeesInput}
                      onKeyPress={(key) => {
                        if (key.name === "s" && key.ctrl) {
                          handleSave();
                          return true;
                        }
                        if (key.name === "return" && attendeesInput.trim()) {
                          addAttendee();
                          return true;
                        }
                        return false;
                      }}
                      placeholder="email@example.com"
                      style={{ ...inputStyle }}
                      focusedStyle={focusedInputStyle}
                    />
                  </Box>
                </Box>

                {/* Attendees list */}
                {attendees.length > 0 && (
                  <Box style={{ flexDirection: "column", paddingLeft: 9, clip: true }}>
                    {attendees.map((email) => (
                      <Box key={email} style={{ flexDirection: "row", gap: 1, clip: true }}>
                        <Text style={{ color: theme.text.secondary }} wrap="truncate">· {email}</Text>
                        <Button onPress={() => removeAttendee(email)}>
                          <Text style={{ color: theme.accent.error }}>×</Text>
                        </Button>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* Notes */}
                <Box style={{ flexDirection: "row", gap: 1, clip: true }}>
                  <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>notes</Text>
                  <Box style={{ width: INPUT_WIDTH, clip: true }}>
                    <Input
                      value={description}
                      onChange={setDescription}
                      placeholder="Add notes"
                      style={{ ...inputStyle }}
                      focusedStyle={focusedInputStyle}
                      onKeyPress={handleInputKeyPress}
                      multiline
                    />
                  </Box>
                </Box>

                {/* Google Meet - only show if event doesn't already have a link */}
                {!dialogEvent?.hangoutLink && (
                  <Box style={{ flexDirection: "row", gap: 1, clip: true }}>
                    <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}> </Text>
                    <Checkbox
                      checked={addGoogleMeet}
                      onChange={setAddGoogleMeet}
                      label="Add Google Meet"
                      focusedStyle={{ color: theme.accent.primary }}
                    />
                  </Box>
                )}

                {/* Recurrence */}
                <Box style={{ flexDirection: "row", gap: 1, clip: true }}>
                  <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>repeat</Text>
                  <Checkbox
                    checked={isRecurring}
                    onChange={setIsRecurring}
                    label="Repeating event"
                    focusedStyle={{ color: theme.accent.primary }}
                  />
                </Box>

                {isRecurring && (
                  <>
                    {/* Frequency */}
                    <Box style={{ flexDirection: "row", gap: 1 }}>
                      <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}> </Text>
                      <Select
                        items={[
                          { label: "Daily", value: "DAILY" },
                          { label: "Weekly", value: "WEEKLY" },
                          { label: "Monthly", value: "MONTHLY" },
                          { label: "Yearly", value: "YEARLY" },
                        ]}
                        value={recurrenceRule.frequency}
                        onChange={(v) => setRecurrenceRule(r => ({ ...r, frequency: v as Frequency }))}
                        highlightColor={theme.accent.primary}
                        style={{ bg: theme.input.background, width: 10 }}
                        focusedStyle={focusedInputStyle}
                        dropdownStyle={dropdownStyle}
                      />
                      <Text style={{ color: theme.text.dim, width: 5 }}>every</Text>
                      <Input
                        value={String(recurrenceRule.interval)}
                        type="number"
                        onChange={(v) => {
                          const num = parseInt(v, 10);
                          if (!isNaN(num) && num > 0) {
                            setRecurrenceRule(r => ({ ...r, interval: num }));
                          }
                        }}
                        style={{ ...inputStyle, width: 5 }}
                        focusedStyle={focusedInputStyle}
                      />
                    </Box>

                    {/* Weekdays for weekly frequency */}
                    {recurrenceRule.frequency === "WEEKLY" && (
                      <Box style={{ flexDirection: "row", gap: 1 }}>
                        <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>on</Text>
                        <WeekdayPicker
                          value={recurrenceRule.weekdays || []}
                          onChange={(weekdays) => setRecurrenceRule(r => ({ ...r, weekdays }))}
                        />
                      </Box>
                    )}

                    {/* End condition */}
                    <Box style={{ flexDirection: "row", gap: 1 }}>
                      <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>ends</Text>
                      <Select
                        items={[
                          { label: "Never", value: "never" },
                          { label: "After", value: "count" },
                          { label: "On date", value: "until" },
                        ]}
                        value={recurrenceRule.endType}
                        onChange={(v) => setRecurrenceRule(r => ({ ...r, endType: v as EndType }))}
                        highlightColor={theme.accent.primary}
                        style={{ bg: theme.input.background }}
                        focusedStyle={focusedInputStyle}
                        dropdownStyle={dropdownStyle}
                      />
                      {recurrenceRule.endType === "count" && (
                        <>
                          <Input
                            value={String(recurrenceRule.count || 10)}
                            onChange={(v) => {
                              const num = parseInt(v, 10);
                              if (!isNaN(num) && num > 0) {
                                setRecurrenceRule(r => ({ ...r, count: num }));
                              }
                            }}
                            style={{ ...inputStyle, width: 4 }}
                            focusedStyle={focusedInputStyle}
                          />
                          <Text style={{ color: theme.text.dim }}>times</Text>
                        </>
                      )}
                      {recurrenceRule.endType === "until" && (
                        <Input
                          value={recurrenceRule.until || ""}
                          onChange={(v) => setRecurrenceRule(r => ({ ...r, until: v }))}
                          placeholder="YYYY-MM-DD"
                          onBeforeChange={dateMask}
                          style={{ ...inputStyle, width: 12 }}
                          focusedStyle={focusedInputStyle}
                        />
                      )}
                    </Box>

                    {/* Preview */}
                    <Box style={{ flexDirection: "row", gap: 1, clip: true }}>
                      <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}> </Text>
                      <Text style={{ color: theme.accent.success, dim: true }}>
                        → {formatRecurrenceRule(recurrenceRule)}
                      </Text>
                    </Box>
                  </>
                )}
              </Box>
            </ScrollView>

            {/* Footer */}
            <Box style={{ flexDirection: "row", gap: 1, justifyContent: "flex-end" }}>
              <Button
                onPress={handleCancel}
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

      {/* Discard changes confirmation */}
      {showDiscardConfirm && (
        <DiscardConfirmDialog
          onDiscard={handleDiscardConfirm}
          onCancel={handleDiscardCancel}
        />
      )}
    </Portal>
  );
}

function DiscardConfirmDialog({
  onDiscard,
  onCancel,
}: {
  onDiscard: () => void;
  onCancel: () => void;
}) {
  useInput((key) => {
    if (key.name === "y" || key.name === "return") {
      onDiscard();
    } else if (key.name === "n" || key.name === "escape") {
      onCancel();
    }
  });

  return (
    <Box
      style={{
        position: "absolute",
        inset: 0,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 100,
      }}
    >
      <Box
        style={{
          width: 35,
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
            Discard changes?
          </Text>
          <Text style={{ color: theme.text.dim }}>
            You have unsaved changes.
          </Text>

          <Box style={{ flexDirection: "row", gap: 2, paddingTop: 1 }}>
            <Button
              onPress={onDiscard}
              style={{ paddingX: 1, bg: theme.input.background }}
              focusedStyle={{ bg: theme.accent.error, color: "black", bold: true }}
            >
              <Text>[y]es, discard</Text>
            </Button>
            <Button
              onPress={onCancel}
              style={{ paddingX: 1, bg: theme.input.background }}
              focusedStyle={{ bg: theme.text.dim, color: "black" }}
            >
              <Text>[n]o, keep editing</Text>
            </Button>
          </Box>
        </FocusScope>
      </Box>
    </Box>
  );
}
