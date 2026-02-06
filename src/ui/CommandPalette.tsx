import React, { useMemo } from "react";
import { Box, Text, ScrollView } from "@nick-skriabin/glyph";
import { useAtomValue, useAtom } from "jotai";
import { commandInputAtom, commandSelectedIndexAtom } from "../state/atoms.ts";
import { getAllCommands } from "../keybinds/registry.ts";
import { theme } from "./theme.ts";

const PALETTE_WIDTH = 50;
const PALETTE_HEIGHT = 12;

interface CommandItemProps {
  name: string;
  description: string;
  isSelected: boolean;
}

function CommandItem({ name, description, isSelected }: CommandItemProps) {
  return (
    <Box
      style={{
        flexDirection: "row",
        paddingX: 1,
        bg: isSelected ? theme.selection.background : undefined,
      }}
    >
      <Text
        style={{
          color: isSelected ? theme.selection.text : theme.accent.primary,
          bold: isSelected,
          width: 15,
        }}
      >
        {name}
      </Text>
      <Text
        style={{
          color: isSelected ? theme.selection.text : theme.text.dim,
        }}
        wrap="truncate"
      >
        {description}
      </Text>
    </Box>
  );
}

export function CommandPalette() {
  const input = useAtomValue(commandInputAtom);
  const [selectedIndex, setSelectedIndex] = useAtom(commandSelectedIndexAtom);
  
  // Get all commands and filter based on input
  const allCommands = useMemo(() => getAllCommands(), []);
  
  const filteredCommands = useMemo(() => {
    if (!input.trim()) return allCommands;
    
    const search = input.toLowerCase().trim();
    return allCommands.filter((cmd) => 
      cmd.name.toLowerCase().includes(search) ||
      cmd.description.toLowerCase().includes(search)
    );
  }, [allCommands, input]);
  
  // Reset selection when filter changes
  React.useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, selectedIndex, setSelectedIndex]);
  
  if (filteredCommands.length === 0) {
    return (
      <Box
        style={{
          position: "absolute",
          bottom: 1,
          left: 0,
          width: PALETTE_WIDTH,
          bg: theme.modal.background,
          padding: 1,
        }}
      >
        <Text style={{ color: theme.text.dim }}>No matching commands</Text>
      </Box>
    );
  }
  
  return (
    <Box
        style={{
          position: "absolute",
          bottom: 1,
          left: 0,
          width: PALETTE_WIDTH,
          height: Math.min(PALETTE_HEIGHT, filteredCommands.length + 2),
          bg: theme.modal.background,
          flexDirection: "column",
        }}
    >
      {/* Header */}
      <Box style={{ paddingX: 1, paddingBottom: 1, flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: theme.text.dim }}>
          Commands ({filteredCommands.length})
        </Text>
        <Text style={{ color: theme.text.dim }}>↑↓ C-p/n</Text>
      </Box>
      
      {/* Command list */}
      <Box style={{ height: Math.min(PALETTE_HEIGHT - 2, filteredCommands.length) }}>
        <ScrollView
          style={{ height: "100%" }}
          scrollOffset={Math.max(0, selectedIndex - 3)}
        >
          {filteredCommands.map((cmd, index) => (
            <CommandItem
              key={cmd.name}
              name={cmd.name}
              description={cmd.description}
              isSelected={index === selectedIndex}
            />
          ))}
        </ScrollView>
      </Box>
      
    </Box>
  );
}

// Get the currently selected command
export function getSelectedCommand(input: string, selectedIndex: number) {
  const allCommands = getAllCommands();
  const search = input.toLowerCase().trim();
  
  const filteredCommands = search
    ? allCommands.filter((cmd) => 
        cmd.name.toLowerCase().includes(search) ||
        cmd.description.toLowerCase().includes(search)
      )
    : allCommands;
  
  return filteredCommands[selectedIndex] || null;
}
