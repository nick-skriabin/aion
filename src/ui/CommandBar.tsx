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
          height: 1,
          bg: theme.modal.background,
        }}
      >
        <FocusScope trap>
          <Box style={{ flexDirection: "row", gap: 1, paddingX: 1 }}>
            <Text style={{ color: theme.accent.primary, bold: true }}>:</Text>
            <Input
              value={input}
              onChange={setInput}
              placeholder="/new [title]"
              style={{ 
                flexGrow: 1, 
                color: theme.input.text,
                bg: theme.input.background,
              }}
            />
          </Box>
        </FocusScope>
      </Box>
    </Portal>
  );
}
