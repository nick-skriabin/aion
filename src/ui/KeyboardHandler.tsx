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
} from "../state/actions.ts";

/**
 * Global keyboard handler using Keybind components (not useInput)
 * to avoid conflicts with FocusScope trap in panels.
 * 
 * Only handles:
 * - Escape to close overlays
 * - y/n for confirm modals
 */
export function KeyboardHandler() {
  const topOverlay = useAtomValue(topOverlayAtom);
  const overlayStack = useAtomValue(overlayStackAtom);
  const hasOverlay = overlayStack.length > 0;
  
  const popOverlay = useSetAtom(popOverlayAtom);
  const continueDeleteWithNotify = useSetAtom(continueDeleteWithNotifyAtom);
  const openHelp = useSetAtom(openHelpAtom);
  
  const isNotifyModal = topOverlay?.payload?.type === "notifyAttendees";
  const isHelpOpen = topOverlay?.kind === "help";
  
  return (
    <>
      {/* Help dialog - ? key (not when help is already open) */}
      {!isHelpOpen && (
        <Keybind keypress="?" onPress={() => openHelp()} />
      )}
      
      {/* Escape closes overlays */}
      {hasOverlay && (
        <Keybind keypress="escape" onPress={() => popOverlay()} />
      )}
      
      {/* Confirm modal shortcuts */}
      {isNotifyModal && (
        <>
          <Keybind keypress="y" onPress={() => continueDeleteWithNotify(true)} />
          <Keybind keypress="n" onPress={() => continueDeleteWithNotify(false)} />
        </>
      )}
    </>
  );
}
