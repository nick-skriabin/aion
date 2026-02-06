import React, { useState, useMemo } from "react";
import { Box, Text, Portal, ScrollView, Keybind, Input } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { focusAtom, overlayStackAtom } from "../state/atoms.ts";
import { popOverlayAtom } from "../state/actions.ts";
import { getKeybindsForHelp, COMMANDS, type KeybindDef } from "../keybinds/registry.ts";
import { theme } from "./theme.ts";
import type { FocusContext } from "../state/atoms.ts";

const KEY_WIDTH = 14;

function KeybindRow({ display, description }: { display: string; description: string }) {
  return (
    <Box style={{ flexDirection: "row", gap: 1 }}>
      <Text style={{ color: theme.accent.primary, width: KEY_WIDTH }}>{display}</Text>
      <Text style={{ color: theme.text.secondary }}>{description}</Text>
    </Box>
  );
}

function filterKeybinds(
  sections: { title: string; keybinds: KeybindDef[] }[],
  query: string
): { title: string; keybinds: KeybindDef[] }[] {
  if (!query.trim()) return sections;
  
  const lowerQuery = query.toLowerCase();
  
  return sections
    .map((section) => ({
      title: section.title,
      keybinds: section.keybinds.filter(
        (kb) =>
          kb.display.toLowerCase().includes(lowerQuery) ||
          kb.description.toLowerCase().includes(lowerQuery)
      ),
    }))
    .filter((section) => section.keybinds.length > 0);
}

export function HelpDialog() {
  const focus = useAtomValue(focusAtom);
  const overlayStack = useAtomValue(overlayStackAtom);
  const popOverlay = useSetAtom(popOverlayAtom);
  const [filter, setFilter] = useState("");

  // Get the previous focus context (before help was opened)
  const helpOverlay = overlayStack.find((o) => o.kind === "help");
  const contextFocus = (helpOverlay?.prevFocus || focus) as FocusContext;
  
  // Get keybinds from registry
  const allSections = getKeybindsForHelp(contextFocus);
  
  // Filter sections based on search
  const sections = useMemo(
    () => filterKeybinds(allSections, filter),
    [allSections, filter]
  );
  
  // Add commands section if in command context
  const showCommands = contextFocus === "command" && !filter.trim();
  
  // Filter commands too
  const filteredCommands = useMemo(() => {
    if (!filter.trim()) return COMMANDS;
    const lowerQuery = filter.toLowerCase();
    return COMMANDS.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery)
    );
  }, [filter]);

  return (
    <Portal zIndex={100}>
      <Keybind keypress="escape" onPress={() => popOverlay()} />
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
            height: "80%",
            bg: theme.modal.background,
            padding: 1,
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <Box style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 1 }}>
            <Text style={{ color: theme.accent.primary, bold: true }}>
              Keyboard Shortcuts
            </Text>
            <Text style={{ color: theme.text.dim }}>esc</Text>
          </Box>
          
          {/* Filter input */}
          <Box style={{ paddingBottom: 1 }}>
            <Input
              placeholder="Search..."
              value={filter}
              onChange={setFilter}
              style={{
                bg: theme.input.background,
                color: theme.text.primary,
              }}
            />
          </Box>

          {/* Content */}
          <ScrollView style={{ flexGrow: 1, flexShrink: 1 }}>
            {sections.length === 0 && filteredCommands.length === 0 ? (
              <Text style={{ color: theme.text.dim }}>No matches found</Text>
            ) : (
              <>
                {sections.map((section, i) => (
                  <Box key={i} style={{ flexDirection: "column", paddingBottom: 1 }}>
                    <Text style={{ color: theme.text.dim, dim: true }}>
                      {section.title}
                    </Text>
                    {section.keybinds.map((kb, j) => (
                      <KeybindRow key={j} display={kb.display} description={kb.description} />
                    ))}
                  </Box>
                ))}
                
                {/* Commands section */}
                {(showCommands || (filter.trim() && filteredCommands.length > 0)) && (
                  <Box style={{ flexDirection: "column", paddingBottom: 1 }}>
                    <Text style={{ color: theme.text.dim, dim: true }}>
                      Commands
                    </Text>
                    {filteredCommands.map((cmd, i) => (
                      <KeybindRow key={i} display={cmd.name} description={cmd.description} />
                    ))}
                  </Box>
                )}
              </>
            )}
          </ScrollView>
        </Box>
      </Box>
    </Portal>
  );
}
