/**
 * Meet With Dialog - Two-step flow for scheduling meetings
 * Step 1: Select people to meet with
 * Step 2: View and select available time slots
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Box, Text, Input, Keybind, Portal } from "@nick-skriabin/glyph";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { DateTime } from "luxon";
import {
  meetWithStateAtom,
  availableSlotsAtom,
  slotsLoadingAtom,
  deriveContactsAtom,
  type Contact,
  type TimeSlot,
} from "../state/atoms.ts";
import { popOverlayAtom, showMessageAtom } from "../state/actions.ts";
import { theme } from "./theme.ts";

// ===== People Picker Step =====

function PeoplePicker({
  onNext,
  onCancel,
}: {
  onNext: () => void;
  onCancel: () => void;
}) {
  const [meetWithState, setMeetWithState] = useAtom(meetWithStateAtom);
  const contacts = useAtomValue(deriveContactsAtom);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter contacts based on search
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.email.toLowerCase().includes(query) ||
        c.displayName?.toLowerCase().includes(query)
    );
  }, [contacts, searchQuery]);

  // Check if a contact is selected
  const isSelected = useCallback(
    (contact: Contact) =>
      meetWithState.selectedPeople.some((p) => p.email === contact.email),
    [meetWithState.selectedPeople]
  );

  // Toggle contact selection
  const toggleContact = useCallback(
    (contact: Contact) => {
      setMeetWithState((prev) => {
        const isAlreadySelected = prev.selectedPeople.some(
          (p) => p.email === contact.email
        );
        return {
          ...prev,
          selectedPeople: isAlreadySelected
            ? prev.selectedPeople.filter((p) => p.email !== contact.email)
            : [...prev.selectedPeople, contact],
        };
      });
    },
    [setMeetWithState]
  );

  // Add email directly (for new contacts not in the list)
  const addEmail = useCallback(() => {
    const email = searchQuery.trim();
    if (!email || !email.includes("@")) return;

    // Check if already selected
    if (meetWithState.selectedPeople.some((p) => p.email === email)) {
      return;
    }

    setMeetWithState((prev) => ({
      ...prev,
      selectedPeople: [...prev.selectedPeople, { email }],
    }));
    setSearchQuery("");
  }, [searchQuery, meetWithState.selectedPeople, setMeetWithState]);

  // Use ref to avoid stale closures
  const handlersRef = useRef({
    moveUp: () => { },
    moveDown: () => { },
    toggle: () => { },
    submit: () => { },
    addEmail: () => { },
  });

  handlersRef.current.moveUp = () => {
    setSelectedIndex((i) => Math.max(0, i - 1));
  };

  handlersRef.current.moveDown = () => {
    setSelectedIndex((i) => Math.min(filteredContacts.length - 1, i + 1));
  };

  handlersRef.current.toggle = () => {
    if (filteredContacts[selectedIndex]) {
      toggleContact(filteredContacts[selectedIndex]);
    }
  };

  handlersRef.current.submit = () => {
    if (meetWithState.selectedPeople.length > 0) {
      onNext();
    }
  };

  handlersRef.current.addEmail = addEmail;

  // Handle all key presses through the input
  const handleInputKeyPress = useCallback((key: { name: string; ctrl?: boolean; shift?: boolean }) => {
    // Navigation: up/down arrows
    if (key.name === "up") {
      handlersRef.current.moveUp();
      return;
    }
    if (key.name === "down") {
      handlersRef.current.moveDown();
      return;
    }

    // Toggle selection with Tab
    if (key.name === "tab" && !key.shift) {
      handlersRef.current.toggle();
      return;
    }

    // Enter to toggle selection or add email
    if (key.name === "return") {
      if (searchQuery.includes("@")) {
        handlersRef.current.addEmail();
      } else if (filteredContacts[selectedIndex]) {
        handlersRef.current.toggle();
      }
      return;
    }
  }, [searchQuery, filteredContacts, selectedIndex]);

  // Ensure selected index is in bounds
  useEffect(() => {
    if (selectedIndex >= filteredContacts.length) {
      setSelectedIndex(Math.max(0, filteredContacts.length - 1));
    }
  }, [filteredContacts.length, selectedIndex]);

  return (
    <Box style={{ flexDirection: "column", flexGrow: 1, clip: true }}>
      {/* Ctrl+Enter to proceed */}
      <Keybind
        keypress="ctrl+n"
        onPress={() => {
          if (meetWithState.selectedPeople.length > 0) {
            onNext();
          }
        }}
        priority
      />

      {/* Search input */}
      <Input
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search or type email..."
        autoFocus
        onKeyPress={handleInputKeyPress}
        style={{ bg: theme.input.background }}
      />

      {/* Selected people chips */}
      {meetWithState.selectedPeople.length > 0 && (
        <Text style={{ color: theme.accent.primary }}>
          Selected: {meetWithState.selectedPeople.map((p) => p.displayName || p.email.split("@")[0]).join(", ")}
        </Text>
      )}

      {/* Contacts list - show max visible items centered around selected */}
      {(() => {
        if (filteredContacts.length === 0) {
          return (
            <Text style={{ color: theme.text.dim }}>
              {searchQuery.includes("@")
                ? "Press Enter to add this email"
                : "No contacts found. Type an email address."}
            </Text>
          );
        }

        const maxVisible = 6;
        let startIdx = Math.max(0, selectedIndex - Math.floor(maxVisible / 2));
        let endIdx = startIdx + maxVisible;

        if (endIdx > filteredContacts.length) {
          endIdx = filteredContacts.length;
          startIdx = Math.max(0, endIdx - maxVisible);
        }

        const visibleContacts = filteredContacts.slice(startIdx, endIdx);

        return (
          <Box style={{ flexDirection: "column" }}>
            {startIdx > 0 && (
              <Text style={{ color: theme.text.dim, dim: true }}>
                {" "}↑ {startIdx} more
              </Text>
            )}
            {visibleContacts.map((contact, i) => {
              const realIndex = startIdx + i;
              const sel = isSelected(contact);
              const hl = realIndex === selectedIndex;
              const name = contact.displayName || contact.email;
              const checkbox = sel ? "☑" : "☐";

              return (
                <Text
                  key={contact.email}
                  style={{
                    color: hl ? theme.selection.text : theme.text.primary,
                    bg: hl ? theme.selection.background : undefined,
                  }}
                >
                  {" "}{checkbox} {name}
                </Text>
              );
            })}
            {endIdx < filteredContacts.length && (
              <Text style={{ color: theme.text.dim, dim: true }}>
                {" "}↓ {filteredContacts.length - endIdx} more
              </Text>
            )}
          </Box>
        );
      })()}

      {/* Footer */}
      <Text style={{ color: theme.text.dim, dim: true }}>
        ↑↓:nav  Enter:select  C-n:next
      </Text>
    </Box>
  );
}

// ===== Slots View Step =====

function SlotsView({
  onBack,
  onSelect,
  onCancel,
  onRefresh,
}: {
  onBack: () => void;
  onSelect: (slot: TimeSlot) => void;
  onCancel: () => void;
  onRefresh: () => void;
}) {
  const [meetWithState, setMeetWithState] = useAtom(meetWithStateAtom);
  const slots = useAtomValue(availableSlotsAtom);
  const loading = useAtomValue(slotsLoadingAtom);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const prevDurationRef = useRef(meetWithState.duration);

  // Duration options in minutes
  const durationOptions = [15, 30, 45, 60, 90, 120];

  // Use ref to avoid stale closures
  const handlersRef = useRef({
    moveUp: () => { },
    moveDown: () => { },
    select: () => { },
    changeDuration: (delta: number) => { },
  });

  handlersRef.current.moveUp = () => {
    setSelectedIndex((i) => Math.max(0, i - 1));
  };

  handlersRef.current.moveDown = () => {
    setSelectedIndex((i) => Math.min(slots.length - 1, i + 1));
  };

  handlersRef.current.select = () => {
    if (slots[selectedIndex]) {
      onSelect(slots[selectedIndex]);
    }
  };

  handlersRef.current.changeDuration = async (delta: number) => {
    const currentIdx = durationOptions.indexOf(meetWithState.duration);
    const newIdx = Math.max(0, Math.min(durationOptions.length - 1, currentIdx + delta));
    const newDuration = durationOptions[newIdx] ?? meetWithState.duration;

    if (newDuration !== meetWithState.duration) {
      setMeetWithState((prev) => ({ ...prev, duration: newDuration }));
    }
  };

  // Re-fetch when duration changes
  useEffect(() => {
    if (prevDurationRef.current !== meetWithState.duration) {
      prevDurationRef.current = meetWithState.duration;
      onRefresh();
    }
  }, [meetWithState.duration, onRefresh]);

  // Format duration for display
  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remaining = mins % 60;
    return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  // Format slot for display
  const formatSlot = (slot: TimeSlot) => {
    const start = slot.start.toFormat("EEE, MMM d 'at' h:mm a");
    const end = slot.end.toFormat("h:mm a");
    return `${start} - ${end}`;
  };

  return (
    <Box style={{ flexDirection: "column", flexGrow: 1 }}>
      {/* Keybinds */}
      <Keybind keypress="up" onPress={() => handlersRef.current.moveUp()} />
      <Keybind keypress="k" onPress={() => handlersRef.current.moveUp()} />
      <Keybind keypress="down" onPress={() => handlersRef.current.moveDown()} />
      <Keybind keypress="j" onPress={() => handlersRef.current.moveDown()} />
      <Keybind keypress="return" onPress={() => handlersRef.current.select()} />
      <Keybind keypress="left" onPress={() => handlersRef.current.changeDuration(-1)} />
      <Keybind keypress="h" onPress={() => handlersRef.current.changeDuration(-1)} />
      <Keybind keypress="right" onPress={() => handlersRef.current.changeDuration(1)} />
      <Keybind keypress="l" onPress={() => handlersRef.current.changeDuration(1)} />
      <Keybind keypress="b" onPress={onBack} />

      {/* Header with selected people and duration */}
      <Text style={{ color: theme.text.dim }}>
        With: {meetWithState.selectedPeople.map((p) => p.displayName || p.email.split("@")[0]).join(", ")}
      </Text>
      <Box style={{ flexDirection: "row" }}>
        <Text style={{ color: theme.text.dim }}>Duration: </Text>
        <Text style={{ color: theme.accent.primary }}>{formatDuration(meetWithState.duration)}</Text>
        <Text style={{ color: theme.text.dim }}> (←/→)</Text>
      </Box>

      {/* Slots list - windowed */}
      {loading ? (
        <Text style={{ color: theme.text.dim }}>Loading available slots...</Text>
      ) : slots.length === 0 ? (
        <Text style={{ color: theme.text.dim }}>No available slots found.</Text>
      ) : (
        (() => {
          const maxVisible = 6;
          let startIdx = Math.max(0, selectedIndex - Math.floor(maxVisible / 2));
          let endIdx = startIdx + maxVisible;
          
          if (endIdx > slots.length) {
            endIdx = slots.length;
            startIdx = Math.max(0, endIdx - maxVisible);
          }
          
          const visibleSlots = slots.slice(startIdx, endIdx);
          
          return (
            <Box style={{ flexDirection: "column" }}>
              {startIdx > 0 && (
                <Text style={{ color: theme.text.dim, dim: true }}>
                  {" "}↑ {startIdx} more
                </Text>
              )}
              {visibleSlots.map((slot, i) => {
                const realIndex = startIdx + i;
                const hl = realIndex === selectedIndex;
                return (
                  <Text
                    key={slot.start.toISO()}
                    style={{
                      color: hl ? theme.selection.text : theme.text.primary,
                      bg: hl ? theme.selection.background : undefined,
                    }}
                  >
                    {hl ? " ▸" : "  "} {formatSlot(slot)}
                  </Text>
                );
              })}
              {endIdx < slots.length && (
                <Text style={{ color: theme.text.dim, dim: true }}>
                  {" "}↓ {slots.length - endIdx} more
                </Text>
              )}
            </Box>
          );
        })()
      )}

      {/* Footer */}
      <Text style={{ color: theme.text.dim, dim: true }}>
        j/k:nav  ←→:duration  Enter:select  b:back
      </Text>
    </Box>
  );
}

// ===== Main Dialog =====

export function MeetWithDialog() {
  const [meetWithState, setMeetWithState] = useAtom(meetWithStateAtom);
  const setSlots = useSetAtom(availableSlotsAtom);
  const setLoading = useSetAtom(slotsLoadingAtom);
  const popOverlay = useSetAtom(popOverlayAtom);
  const showMessage = useSetAtom(showMessageAtom);

  const handleCancel = useCallback(() => {
    // Reset state
    setMeetWithState({
      step: "people",
      selectedPeople: [],
      duration: 30,
      dateRange: {
        start: DateTime.now().startOf("day"),
        end: DateTime.now().plus({ days: 7 }).endOf("day"),
      },
    });
    setSlots([]);
    popOverlay();
  }, [setMeetWithState, setSlots, popOverlay]);

  const handleNextToSlots = useCallback(async () => {
    setMeetWithState((prev) => ({ ...prev, step: "slots" }));
    setLoading(true);

    try {
      const { queryFreeBusy, queryMyFreeBusy } = await import("../api/calendar.ts");
      const { findFreeSlots, splitIntoMeetingSlots, combineBusyPeriods } = await import("../domain/freeSlots.ts");

      const now = DateTime.now();
      const rangeStart = now;
      const rangeEnd = now.plus({ days: 7 }).endOf("day");

      // Get emails to query (selected people)
      const emails = meetWithState.selectedPeople.map((p) => p.email);

      // Query free/busy for selected people
      const busyByPerson = await queryFreeBusy(
        emails,
        rangeStart.toISO()!,
        rangeEnd.toISO()!
      );

      // Also get our own busy times
      const myBusy = await queryMyFreeBusy(rangeStart.toISO()!, rangeEnd.toISO()!);

      // Add our busy times to the map
      busyByPerson.set("__self__", myBusy);

      // Combine all busy periods
      const allBusy = combineBusyPeriods(busyByPerson);

      // Find free slots
      const freeSlots = findFreeSlots(allBusy, rangeStart, rangeEnd, {
        minDuration: meetWithState.duration,
        workingHoursStart: 9,
        workingHoursEnd: 18,
        includeWeekends: false,
        timezone: DateTime.local().zoneName || "local",
      });

      // Split into meeting-sized slots
      const meetingSlots = splitIntoMeetingSlots(freeSlots, meetWithState.duration);

      // Convert to TimeSlot format
      const slots: TimeSlot[] = meetingSlots.map((s) => ({
        start: s.start,
        end: s.end,
        duration: s.duration,
      }));

      setSlots(slots);

      if (slots.length === 0) {
        showMessage({ text: "No available slots found in the next 7 days", type: "info" });
      }
    } catch (error) {
      console.error("Failed to fetch free/busy:", error);
      showMessage({ text: "Failed to fetch available slots", type: "error" });
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [meetWithState.selectedPeople, meetWithState.duration, setMeetWithState, setSlots, setLoading, showMessage]);

  const handleBackToPeople = useCallback(() => {
    setMeetWithState((prev) => ({ ...prev, step: "people" }));
  }, [setMeetWithState]);

  const handleSelectSlot = useCallback(async (slot: TimeSlot) => {
    try {
      const { createEvent } = await import("../api/calendar.ts");
      const { getAccounts } = await import("../auth/tokens.ts");

      // Get the first account to create the event
      const accounts = await getAccounts();
      if (accounts.length === 0) {
        showMessage({ text: "No accounts available", type: "error" });
        return;
      }

      const accountEmail = accounts[0].account.email;

      // Create the event with attendees
      const attendees = meetWithState.selectedPeople.map((p) => ({
        email: p.email,
        displayName: p.displayName,
      }));

      const event = await createEvent(
        {
          summary: `Meeting with ${meetWithState.selectedPeople.map((p) => p.displayName || p.email.split("@")[0]).join(", ")}`,
          start: {
            dateTime: slot.start.toISO()!,
            timeZone: DateTime.local().zoneName || undefined,
          },
          end: {
            dateTime: slot.end.toISO()!,
            timeZone: DateTime.local().zoneName || undefined,
          },
          attendees,
        },
        "primary",
        accountEmail
      );

      showMessage({ text: `Meeting scheduled for ${slot.start.toFormat("EEE, MMM d 'at' h:mm a")}`, type: "success" });

      // Reset state and close
      setMeetWithState({
        step: "people",
        selectedPeople: [],
        duration: 30,
        dateRange: {
          start: DateTime.now().startOf("day"),
          end: DateTime.now().plus({ days: 7 }).endOf("day"),
        },
      });
      setSlots([]);
      popOverlay();

      // Trigger a sync to show the new event
      // The sync will happen automatically via background sync
    } catch (error) {
      console.error("Failed to create event:", error);
      showMessage({ text: "Failed to create meeting", type: "error" });
    }
  }, [meetWithState.selectedPeople, setMeetWithState, setSlots, popOverlay, showMessage]);

  return (
    <Portal zIndex={100}>
      <Keybind keypress="escape" onPress={handleCancel} />
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
            width: 55,
            height: 16,
            bg: theme.modal.background,
            padding: 1,
            flexDirection: "column",
            clip: true,
          }}
        >
          {/* Header */}
          <Box style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 1 }}>
            <Text style={{ color: theme.accent.primary, bold: true }}>
              {meetWithState.step === "people" ? "Meet With" : "Available Slots"}
            </Text>
            <Text style={{ color: theme.text.dim }}>
              {meetWithState.step === "people" ? "1/2" : "2/2"}
            </Text>
          </Box>

          {/* Content */}
          {meetWithState.step === "people" ? (
            <PeoplePicker onNext={handleNextToSlots} onCancel={handleCancel} />
          ) : (
            <SlotsView
              onBack={handleBackToPeople}
              onSelect={handleSelectSlot}
              onCancel={handleCancel}
              onRefresh={handleNextToSlots}
            />
          )}
        </Box>
      </Box>
    </Portal>
  );
}
