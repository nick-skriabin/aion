import React from "react";
import { Keybind } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  topOverlayAtom,
  overlayStackAtom,
} from "../state/atoms.ts";
import {
  popOverlayAtom,
  openHelpAtom,
  openNotificationsAtom,
  newEventAtom,
  openSearchAtom,
  toggleColumnsAtom,
} from "../state/actions.ts";
import { KEYBIND_REGISTRY } from "../keybinds/registry.ts";

// Get key from registry by action name
function getKeyForAction(scope: keyof typeof KEYBIND_REGISTRY, action: string): string | undefined {
  const keybinds = KEYBIND_REGISTRY[scope];
  const kb = keybinds?.find((k) => k.action === action);
  return kb?.key;
}

/**
 * Global keyboard handler using keybinds from registry.
 */
export function KeyboardHandler() {
  const topOverlay = useAtomValue(topOverlayAtom);
  const overlayStack = useAtomValue(overlayStackAtom);
  const hasOverlay = overlayStack.length > 0;
  
  const popOverlay = useSetAtom(popOverlayAtom);
  const openHelp = useSetAtom(openHelpAtom);
  const openNotifications = useSetAtom(openNotificationsAtom);
  const newEvent = useSetAtom(newEventAtom);
  const openSearch = useSetAtom(openSearchAtom);
  const toggleColumns = useSetAtom(toggleColumnsAtom);
  
  const isHelpOpen = topOverlay?.kind === "help";
  const isNotificationsOpen = topOverlay?.kind === "notifications";
  const isDialogOpen = topOverlay?.kind === "dialog";
  
  // Get keys from registry
  const helpKey = getKeyForAction("global", "openHelp");
  const notificationsKey = getKeyForAction("global", "openNotifications");
  const newEventKey = getKeyForAction("global", "newEvent");
  const escapeKey = getKeyForAction("global", "popOverlay");
  const toggleColumnsKey = getKeyForAction("global", "toggleColumns");
  
  return (
    <>
      {/* Help - from registry */}
      {helpKey && !isHelpOpen && (
        <Keybind keypress={helpKey} onPress={() => openHelp()} />
      )}
      
      {/* Notifications - from registry */}
      {notificationsKey && !isNotificationsOpen && !hasOverlay && (
        <Keybind keypress={notificationsKey} onPress={() => openNotifications()} />
      )}
      
      {/* New event - from registry (Ctrl+N) */}
      {newEventKey && !isDialogOpen && !hasOverlay && (
        <Keybind keypress={newEventKey} onPress={() => newEvent()} />
      )}
      
      {/* Escape - from registry */}
      {escapeKey && hasOverlay && (
        <Keybind keypress={escapeKey} onPress={() => popOverlay()} />
      )}
      
      {/* Search - / key */}
      {!hasOverlay && (
        <Keybind keypress="/" onPress={() => openSearch()} />
      )}
      
      {/* Toggle 3-day view - from registry */}
      {toggleColumnsKey && !hasOverlay && (
        <Keybind keypress={toggleColumnsKey} onPress={() => toggleColumns()} />
      )}
    </>
  );
}
