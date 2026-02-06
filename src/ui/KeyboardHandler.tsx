import { useInput } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { useRef, useCallback } from "react";
import {
  focusAtom,
  topOverlayAtom,
  hasOverlayAtom,
} from "../state/atoms.ts";
import {
  toggleFocusAtom,
  popOverlayAtom,
  moveDaySelectionAtom,
  moveEventSelectionAtom,
  scrollTimelineAtom,
  jumpToNowAtom,
  openDetailsAtom,
  openEditDialogAtom,
  initiateDeleteAtom,
  openCommandAtom,
  executeCommandAtom,
  continueDeleteWithNotifyAtom,
} from "../state/actions.ts";

export function KeyboardHandler() {
  const focus = useAtomValue(focusAtom);
  const topOverlay = useAtomValue(topOverlayAtom);
  const hasOverlay = useAtomValue(hasOverlayAtom);
  
  // Actions
  const toggleFocus = useSetAtom(toggleFocusAtom);
  const popOverlay = useSetAtom(popOverlayAtom);
  const moveDaySelection = useSetAtom(moveDaySelectionAtom);
  const moveEventSelection = useSetAtom(moveEventSelectionAtom);
  const scrollTimeline = useSetAtom(scrollTimelineAtom);
  const jumpToNow = useSetAtom(jumpToNowAtom);
  const openDetails = useSetAtom(openDetailsAtom);
  const openEditDialog = useSetAtom(openEditDialogAtom);
  const initiateDelete = useSetAtom(initiateDeleteAtom);
  const openCommand = useSetAtom(openCommandAtom);
  const executeCommand = useSetAtom(executeCommandAtom);
  const continueDeleteWithNotify = useSetAtom(continueDeleteWithNotifyAtom);
  
  // Track 'g' press for gg command
  const lastKeyRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  
  const handleInput = useCallback((key: { name: string; ctrl?: boolean; shift?: boolean; alt?: boolean; sequence: string }) => {
    const now = Date.now();
    
    // Don't handle input when in command or dialog mode (let inputs handle it)
    if (focus === "command" || focus === "dialog") {
      // Only handle Escape and Enter in these modes
      if (key.name === "escape") {
        popOverlay();
        return;
      }
      if (key.name === "return" && focus === "command") {
        executeCommand();
        return;
      }
      return;
    }
    
    // Global: Escape to close overlays
    if (key.name === "escape") {
      if (hasOverlay) {
        popOverlay();
      }
      return;
    }
    
    // Global: Tab to toggle focus (when no modal)
    if (key.name === "tab" && !hasOverlay) {
      toggleFocus();
      return;
    }
    
    // Global: q to quit (handled in App)
    if (key.name === "q" && !hasOverlay) {
      return; // Let App handle this
    }
    
    // Global: : to open command
    if (key.sequence === ":" && !hasOverlay) {
      openCommand();
      return;
    }
    
    // Notify attendees modal shortcuts
    if (topOverlay?.payload?.type === "notifyAttendees") {
      if (key.name === "y") {
        continueDeleteWithNotify(true);
        return;
      }
      if (key.name === "n" && !key.ctrl) {
        continueDeleteWithNotify(false);
        return;
      }
    }
    
    // Confirm modal - let the buttons handle interaction
    if (focus === "confirm") {
      return;
    }
    
    // Days sidebar navigation
    if (focus === "days" && !hasOverlay) {
      switch (key.name) {
        case "j":
        case "down":
          moveDaySelection("down");
          return;
        case "k":
        case "up":
          moveDaySelection("up");
          return;
        case "g":
          if (!key.shift) {
            // Check for gg
            if (lastKeyRef.current === "g" && now - lastKeyTimeRef.current < 500) {
              moveDaySelection("start");
              lastKeyRef.current = "";
            } else {
              lastKeyRef.current = "g";
              lastKeyTimeRef.current = now;
            }
          } else {
            // G (shift+g)
            moveDaySelection("end");
          }
          return;
        case "return":
          // Enter focuses timeline
          toggleFocus();
          return;
      }
    }
    
    // Timeline navigation
    if (focus === "timeline" && !hasOverlay) {
      switch (key.name) {
        case "j":
        case "down":
          moveEventSelection("next");
          return;
        case "k":
        case "up":
          moveEventSelection("prev");
          return;
        case "g":
          if (!key.shift) {
            // Check for gg
            if (lastKeyRef.current === "g" && now - lastKeyTimeRef.current < 500) {
              moveEventSelection("first");
              lastKeyRef.current = "";
            } else {
              lastKeyRef.current = "g";
              lastKeyTimeRef.current = now;
            }
          } else {
            // G (shift+g)
            moveEventSelection("last");
          }
          return;
        case "d":
          if (key.ctrl) {
            scrollTimeline("down");
          } else if (key.shift) {
            initiateDelete();
          }
          return;
        case "u":
          if (key.ctrl) {
            scrollTimeline("up");
          }
          return;
        case "n":
          jumpToNow();
          return;
        case "return":
        case "space":
          openDetails();
          return;
        case "e":
          openEditDialog();
          return;
      }
    }
    
    // Details panel
    if (focus === "details") {
      switch (key.name) {
        case "e":
          openEditDialog();
          return;
        case "d":
          if (key.shift) {
            initiateDelete();
          }
          return;
      }
    }
    
    // Reset gg tracking for non-g keys
    if (key.name !== "g") {
      lastKeyRef.current = "";
    }
  }, [
    focus,
    hasOverlay,
    topOverlay,
    toggleFocus,
    popOverlay,
    moveDaySelection,
    moveEventSelection,
    scrollTimeline,
    jumpToNow,
    openDetails,
    openEditDialog,
    initiateDelete,
    openCommand,
    executeCommand,
    continueDeleteWithNotify,
  ]);
  
  useInput(handleInput);
  
  return null;
}
