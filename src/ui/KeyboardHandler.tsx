import React, { useMemo } from "react";
import { Keybind } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  topOverlayAtom,
  overlayStackAtom,
} from "../state/atoms.ts";
import {
  popOverlayAtom,
  continueDeleteWithNotifyAtom,
  openHelpAtom,
  openNotificationsAtom,
} from "../state/actions.ts";
import { ScopedKeybinds } from "../keybinds/useKeybinds.tsx";
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
  const continueDeleteWithNotify = useSetAtom(continueDeleteWithNotifyAtom);
  const openHelp = useSetAtom(openHelpAtom);
  const openNotifications = useSetAtom(openNotificationsAtom);
  
  const isNotifyModal = topOverlay?.payload?.type === "notifyAttendees";
  const isHelpOpen = topOverlay?.kind === "help";
  const isNotificationsOpen = topOverlay?.kind === "notifications";
  
  // Get keys from registry
  const helpKey = getKeyForAction("global", "openHelp");
  const notificationsKey = getKeyForAction("global", "openNotifications");
  const escapeKey = getKeyForAction("global", "popOverlay");
  
  // Confirm modal handlers (for notify attendees prompt)
  const confirmHandlers = useMemo(() => ({
    confirm: () => continueDeleteWithNotify(true),
    cancel: () => continueDeleteWithNotify(false),
  }), [continueDeleteWithNotify]);
  
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
      
      {/* Escape - from registry */}
      {escapeKey && hasOverlay && (
        <Keybind keypress={escapeKey} onPress={() => popOverlay()} />
      )}
      
      {/* Confirm modal shortcuts (only for notify attendees modal) */}
      {isNotifyModal && (
        <ScopedKeybinds scope="confirm" handlers={confirmHandlers} />
      )}
    </>
  );
}
