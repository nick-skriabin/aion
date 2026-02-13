import React from "react";
import { Keybind } from "@semos-labs/glyph";
import { KEYBIND_REGISTRY, type KeybindScope, type KeybindDef } from "./registry.ts";

type ActionHandlers = Record<string, (() => void) | undefined>;

/**
 * Key event from useInput - matches Glyph's key event structure
 */
interface KeyEvent {
  name: string;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  sequence?: string;
}

/**
 * Parse a key string like "shift+d" or "ctrl+c" or "N" into components
 * Uppercase single letters like "N" are treated as shift + lowercase
 */
function parseKeyString(keyStr: string): { name: string; shift: boolean; ctrl: boolean } {
  // Handle uppercase single letters (e.g., "N" means Shift+n)
  if (keyStr.length === 1 && keyStr >= "A" && keyStr <= "Z") {
    return { name: keyStr.toLowerCase(), shift: true, ctrl: false };
  }

  const parts = keyStr.toLowerCase().split("+");
  const name = parts[parts.length - 1] ?? "";
  const shift = parts.includes("shift");
  const ctrl = parts.includes("ctrl");
  return { name, shift, ctrl };
}

/**
 * Normalize key event to { name, shift, ctrl } format
 */
function normalizeKeyEvent(event: KeyEvent): { name: string; shift: boolean; ctrl: boolean } {
  let name = event.name?.toLowerCase() || "";
  let shift = !!event.shift;
  const ctrl = !!event.ctrl;

  // Check sequence for special characters
  if (event.sequence === "?") return { name: "?", shift: false, ctrl };
  if (event.sequence === ":") return { name: ":", shift: false, ctrl };
  if (event.sequence === "space") return { name: "space", shift, ctrl };

  // Handle uppercase letters as shift + lowercase
  // When you press Shift+G, some terminals send name="G" without shift flag
  if (event.sequence && event.sequence.length === 1) {
    const char = event.sequence;
    if (char >= "A" && char <= "Z") {
      name = char.toLowerCase();
      shift = true;
    }
  }

  // Map alternative names
  if (name === "enter") name = "return";
  if (name === "esc") name = "escape";

  return { name, shift, ctrl };
}

/**
 * Check if a key event matches a keybind definition
 */
function matchesKey(event: KeyEvent, keyStr: string): boolean {
  const parsed = parseKeyString(keyStr);
  const normalized = normalizeKeyEvent(event);

  // Match name
  const nameMatch = normalized.name === parsed.name;

  // Match modifiers
  const shiftMatch = normalized.shift === parsed.shift;
  const ctrlMatch = normalized.ctrl === parsed.ctrl;

  return nameMatch && shiftMatch && ctrlMatch;
}

/**
 * Process a key event through the registry and execute matching handler
 * Returns the action name if handled, undefined otherwise
 */
export function handleKeyEvent(
  scope: KeybindScope,
  event: KeyEvent,
  handlers: ActionHandlers
): string | undefined {
  const keybinds = KEYBIND_REGISTRY[scope] || [];

  for (const kb of keybinds) {
    if (matchesKey(event, kb.key)) {
      const handler = handlers[kb.action];
      if (handler) {
        handler();
        return kb.action;
      }
    }
  }

  return undefined;
}

/**
 * Get keybind definitions for a scope to use with useInput
 */
export function getKeybindMap(scope: KeybindScope): Map<string, KeybindDef> {
  const keybinds = KEYBIND_REGISTRY[scope] || [];
  const map = new Map<string, KeybindDef>();

  for (const kb of keybinds) {
    map.set(kb.key, kb);
  }

  return map;
}

/**
 * Component that renders keybinds for a scope
 */
export function ScopedKeybinds({
  scope,
  handlers,
  enabled = true,
}: {
  scope: KeybindScope;
  handlers: ActionHandlers;
  enabled?: boolean;
}) {
  if (!enabled) return null;

  const keybinds = KEYBIND_REGISTRY[scope] || [];

  return (
    <>
      {keybinds
        .filter((kb) => handlers[kb.action])
        .map((kb, i) => (
          <Keybind
            key={`${scope}-${kb.key}-${i}`}
            keypress={kb.key}
            onPress={handlers[kb.action]!}
          />
        ))}
    </>
  );
}
