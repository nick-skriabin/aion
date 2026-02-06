import React from "react";
import { Box, Text, Input, Portal, FocusScope } from "@nick-skriabin/glyph";
import { useAtom } from "jotai";
import { commandInputAtom } from "../state/atoms.ts";
import { theme } from "./theme.ts";

export function CommandBar() {
  const [input, setInput] = useAtom(commandInputAtom);
  
  return (
    <Portal zIndex={100}>
      <Box
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          bg: theme.bg.secondary,
          border: "single",
          borderColor: theme.border.focus,
          flexDirection: "column",
        }}
      >
        <FocusScope trap>
          <Box style={{ flexDirection: "row", paddingX: 1, gap: 1 }}>
            <Text style={{ color: theme.accent.primary, bold: true }}>:</Text>
            <Input
              value={input}
              onChange={setInput}
              placeholder="/new [title] - Create event"
              style={{
                flexGrow: 1,
                color: theme.text.primary,
              }}
              focusedStyle={{
                bg: theme.bg.secondary,
              }}
            />
          </Box>
          <Box style={{ paddingX: 1 }}>
            <Text style={{ color: theme.text.dim, dim: true }}>
              Enter to execute │ Esc to cancel
            </Text>
          </Box>
        </FocusScope>
      </Box>
    </Portal>
  );
}
