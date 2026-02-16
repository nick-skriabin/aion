/**
 * CalDAV Login Dialog
 * Collects server URL, username, and password for CalDAV account setup.
 * Supports presets for common CalDAV providers (iCloud, Fastmail, Nextcloud, etc.)
 */

import { useState, useCallback } from "react";
import { Box, Text, Input, Button, Portal, FocusScope, Select, useInput } from "@semos-labs/glyph";
import { useSetAtom } from "jotai";
import { popOverlayAtom, showMessageAtom, addCalDAVAccountAtom } from "../state/actions.ts";
import { theme } from "./theme.ts";
import { CALDAV_PRESETS } from "../api/caldav.ts";

const DIALOG_WIDTH = 56;
const LABEL_WIDTH = 9;
const INPUT_WIDTH = 42;

type PresetKey = "custom" | keyof typeof CALDAV_PRESETS;

const presetItems = [
  { label: "Custom server", value: "custom" },
  ...Object.entries(CALDAV_PRESETS).map(([key, preset]) => ({
    label: preset.name,
    value: key,
  })),
];

function DialogKeybinds({ onCancel }: { onCancel: () => void }) {
  useInput((key) => {
    if (key.name === "escape") {
      onCancel();
    }
  });
  return null;
}

type PasswordMode = "password" | "password_command";

export function CalDAVLoginDialog() {
  const popOverlay = useSetAtom(popOverlayAtom);
  const showMessage = useSetAtom(showMessageAtom);
  const addAccount = useSetAtom(addCalDAVAccountAtom);

  const [preset, setPreset] = useState<PresetKey>("custom");
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordCommand, setPasswordCommand] = useState("");
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("password");
  const [accountName, setAccountName] = useState("");
  const [connecting, setConnecting] = useState(false);

  const handlePresetChange = useCallback((value: string) => {
    const key = value as PresetKey;
    setPreset(key);
    if (key !== "custom" && CALDAV_PRESETS[key]) {
      const presetConfig = CALDAV_PRESETS[key];
      if (presetConfig.serverUrl) {
        setServerUrl(presetConfig.serverUrl);
      }
    }
  }, []);

  const handleCancel = useCallback(() => {
    popOverlay();
  }, [popOverlay]);

  const handleConnect = useCallback(async () => {
    if (!serverUrl.trim()) {
      showMessage({ text: "Server URL is required", type: "error" });
      return;
    }
    if (!username.trim()) {
      showMessage({ text: "Username is required", type: "error" });
      return;
    }
    if (passwordMode === "password" && !password.trim()) {
      showMessage({ text: "Password is required", type: "error" });
      return;
    }
    if (passwordMode === "password_command" && !passwordCommand.trim()) {
      showMessage({ text: "Password command is required", type: "error" });
      return;
    }

    setConnecting(true);
    try {
      const success = await addAccount({
        serverUrl: serverUrl.trim(),
        username: username.trim(),
        name: accountName.trim() || undefined,
        ...(passwordMode === "password"
          ? { password: password.trim() }
          : { password_command: passwordCommand.trim() }),
      });

      if (success) {
        popOverlay();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Connection failed";
      showMessage({ text: msg, type: "error" });
    } finally {
      setConnecting(false);
    }
  }, [serverUrl, username, password, passwordCommand, passwordMode, accountName, addAccount, popOverlay, showMessage]);

  const handleInputKeyPress = useCallback(
    (key: { name?: string; ctrl?: boolean }) => {
      if (key.name === "s" && key.ctrl) {
        handleConnect();
        return true;
      }
      return false;
    },
    [handleConnect]
  );

  const selectedPresetHelp =
    preset !== "custom" && CALDAV_PRESETS[preset]
      ? CALDAV_PRESETS[preset].help
      : null;

  const inputStyle = {
    color: theme.input.text,
    bg: theme.input.background,
  };

  const focusedInputStyle = {
    bg: "#3a3a3a" as const,
    color: "white" as const,
  };

  const dropdownStyle = {
    bg: "#1a1a1a" as const,
    color: "white" as const,
  };

  return (
    <Portal zIndex={100}>
      <DialogKeybinds onCancel={handleCancel} />
      <Box
        style={{
          position: "absolute",
          inset: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Box
          style={{
            width: DIALOG_WIDTH,
            flexDirection: "column",
            paddingX: 1,
            bg: theme.modal.background,
          }}
        >
          <FocusScope trap>
            {/* Header */}
            <Box
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ bold: true, color: theme.accent.primary }}>
                Add CalDAV Account
              </Text>
              <Text style={{ color: theme.text.dim, dim: true }}>^S connect</Text>
            </Box>

            {/* Form */}
            <Box style={{ flexDirection: "column", paddingY: 1 }}>
              {/* Preset selector */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>provider</Text>
                <Select
                  items={presetItems}
                  value={preset}
                  onChange={handlePresetChange}
                  highlightColor={theme.accent.primary}
                  style={{ bg: theme.input.background }}
                  focusedStyle={focusedInputStyle}
                  dropdownStyle={dropdownStyle}
                />
              </Box>

              {/* Help text for preset */}
              {selectedPresetHelp && (
                <Box
                  style={{
                    flexDirection: "row",
                    gap: 1,
                    paddingLeft: LABEL_WIDTH + 1,
                  }}
                >
                  <Text style={{ color: theme.accent.success, dim: true }}>
                    {selectedPresetHelp}
                  </Text>
                </Box>
              )}

              {/* Account name */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>name</Text>
                <Box style={{ width: INPUT_WIDTH }}>
                  <Input
                    value={accountName}
                    onChange={setAccountName}
                    placeholder="Work Calendar (optional)"
                    style={inputStyle}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={handleInputKeyPress}
                  />
                </Box>
              </Box>

              {/* Server URL */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>server</Text>
                <Box style={{ width: INPUT_WIDTH }}>
                  <Input
                    value={serverUrl}
                    onChange={setServerUrl}
                    placeholder="https://caldav.example.com"
                    style={inputStyle}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={handleInputKeyPress}
                  />
                </Box>
              </Box>

              {/* Username */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>username</Text>
                <Box style={{ width: INPUT_WIDTH }}>
                  <Input
                    value={username}
                    onChange={setUsername}
                    placeholder="user@example.com"
                    style={inputStyle}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={handleInputKeyPress}
                  />
                </Box>
              </Box>

              {/* Password mode toggle */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>auth</Text>
                <Select
                  items={[
                    { label: "Password", value: "password" },
                    { label: "Password command", value: "password_command" },
                  ]}
                  value={passwordMode}
                  onChange={(v) => setPasswordMode(v as PasswordMode)}
                  highlightColor={theme.accent.primary}
                  style={{ bg: theme.input.background }}
                  focusedStyle={focusedInputStyle}
                  dropdownStyle={dropdownStyle}
                />
              </Box>

              {/* Password or password command */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: theme.text.dim, width: LABEL_WIDTH }}>
                  {passwordMode === "password" ? "password" : "command"}
                </Text>
                <Box style={{ width: INPUT_WIDTH }}>
                  {passwordMode === "password" ? (
                    <Input
                      value={password}
                      onChange={setPassword}
                      placeholder="app-specific password"
                      style={inputStyle}
                      focusedStyle={focusedInputStyle}
                      onKeyPress={(key) => {
                        if (key.name === "s" && key.ctrl) { handleConnect(); return true; }
                        if (key.name === "return") { handleConnect(); return true; }
                        return false;
                      }}
                    />
                  ) : (
                    <Input
                      value={passwordCommand}
                      onChange={setPasswordCommand}
                      placeholder="pass show calendar/icloud"
                      style={inputStyle}
                      focusedStyle={focusedInputStyle}
                      onKeyPress={(key) => {
                        if (key.name === "s" && key.ctrl) { handleConnect(); return true; }
                        if (key.name === "return") { handleConnect(); return true; }
                        return false;
                      }}
                    />
                  )}
                </Box>
              </Box>
            </Box>

            {/* Footer */}
            <Box style={{ flexDirection: "row", gap: 1, justifyContent: "flex-end" }}>
              <Button
                onPress={handleCancel}
                style={{ paddingX: 1 }}
                focusedStyle={{ bg: theme.text.dim, color: "black" }}
              >
                <Text>cancel</Text>
              </Button>
              <Button
                onPress={handleConnect}
                style={{ paddingX: 1 }}
                focusedStyle={{
                  bg: theme.accent.primary,
                  color: "black",
                  bold: true,
                }}
              >
                <Text>{connecting ? "connecting..." : "connect"}</Text>
              </Button>
            </Box>
          </FocusScope>
        </Box>
      </Box>
    </Portal>
  );
}
