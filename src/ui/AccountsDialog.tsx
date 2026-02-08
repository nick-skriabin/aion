/**
 * Accounts Dialog - Manage connected Google accounts
 * - View all accounts in a sidebar
 * - Set custom names (local-only)
 * - Set primary account
 * - Remove accounts (logout)
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, Input, Button, Portal, Keybind, useInput } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { accountsAtom } from "../state/atoms.ts";
import { popOverlayAtom, showMessageAtom, syncAtom } from "../state/actions.ts";
import { theme } from "./theme.ts";
import {
  loadAccountSettings,
  setCustomAccountName,
  removeAccountSettings,
  type AccountSettings,
} from "../config/accountSettings.ts";
import {
  getDefaultAccount,
  setDefaultAccount,
  removeAccount,
  getAccounts,
} from "../auth/index.ts";

const DIALOG_WIDTH = 65;
const SIDEBAR_WIDTH = 22;

export function AccountsDialog() {
  const accounts = useAtomValue(accountsAtom);
  const popOverlay = useSetAtom(popOverlayAtom);
  const showMessage = useSetAtom(showMessageAtom);
  const sync = useSetAtom(syncAtom);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [defaultEmail, setDefaultEmail] = useState<string | null>(null);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handlersRef = useRef({
    moveUp: () => {},
    moveDown: () => {},
  });

  // Load settings on mount
  useEffect(() => {
    async function load() {
      const settings = await loadAccountSettings();
      setCustomNames(settings.customNames);

      const def = await getDefaultAccount();
      setDefaultEmail(def?.account.email || null);
    }
    load();
  }, []);

  const selectedAccount = accounts[selectedIndex];

  // Navigation handlers
  handlersRef.current.moveUp = () => {
    if (!editingName && !showDeleteConfirm) {
      setSelectedIndex((i) => Math.max(0, i - 1));
    }
  };

  handlersRef.current.moveDown = () => {
    if (!editingName && !showDeleteConfirm) {
      setSelectedIndex((i) => Math.min(accounts.length - 1, i + 1));
    }
  };

  const handleClose = useCallback(() => {
    popOverlay();
  }, [popOverlay]);

  const handleSetPrimary = useCallback(async () => {
    if (!selectedAccount) return;

    try {
      await setDefaultAccount(selectedAccount.email);
      setDefaultEmail(selectedAccount.email);
      showMessage({ text: `${selectedAccount.email} is now primary`, type: "success" });
    } catch (error) {
      showMessage({ text: "Failed to set primary account", type: "error" });
    }
  }, [selectedAccount, showMessage]);

  const handleStartEditName = useCallback(() => {
    if (!selectedAccount) return;
    setNameInput(customNames[selectedAccount.email] || "");
    setEditingName(true);
  }, [selectedAccount, customNames]);

  const handleSaveName = useCallback(async () => {
    if (!selectedAccount) return;

    await setCustomAccountName(selectedAccount.email, nameInput);
    setCustomNames((prev) => ({
      ...prev,
      [selectedAccount.email]: nameInput.trim() || selectedAccount.name || "",
    }));
    setEditingName(false);
    showMessage({ text: "Account name updated", type: "success" });
  }, [selectedAccount, nameInput, showMessage]);

  const handleCancelEditName = useCallback(() => {
    setEditingName(false);
    setNameInput("");
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    if (!selectedAccount) return;

    try {
      await removeAccount(selectedAccount.email);
      await removeAccountSettings(selectedAccount.email);

      // Refresh accounts
      const updatedAccounts = await getAccounts();
      if (updatedAccounts.length === 0) {
        popOverlay();
        showMessage({ text: "All accounts removed", type: "info" });
      } else {
        // Update selection if needed
        setSelectedIndex((i) => Math.min(i, updatedAccounts.length - 1));
        showMessage({ text: `Removed ${selectedAccount.email}`, type: "success" });
        // Trigger sync to update state
        sync();
      }
      setShowDeleteConfirm(false);
    } catch (error) {
      showMessage({ text: "Failed to remove account", type: "error" });
      setShowDeleteConfirm(false);
    }
  }, [selectedAccount, popOverlay, showMessage, sync]);

  // Keyboard handler component
  function DialogKeybinds() {
    useInput((key) => {
      if (showDeleteConfirm) {
        if (key.name === "escape" || key.name === "n") {
          setShowDeleteConfirm(false);
        } else if (key.name === "y") {
          handleDeleteAccount();
        }
        return;
      }

      if (editingName) {
        if (key.name === "escape") {
          handleCancelEditName();
        }
        return;
      }

      if (key.name === "escape") {
        handleClose();
      } else if (key.name === "up" || key.name === "k") {
        handlersRef.current.moveUp();
      } else if (key.name === "down" || key.name === "j") {
        handlersRef.current.moveDown();
      } else if (key.name === "p") {
        handleSetPrimary();
      } else if (key.name === "n") {
        handleStartEditName();
      } else if (key.name === "d") {
        setShowDeleteConfirm(true);
      }
    });
    return null;
  }

  if (accounts.length === 0) {
    return (
      <Portal zIndex={100}>
        <Keybind keypress="escape" onPress={handleClose} />
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
              width: 40,
              bg: theme.modal.background,
              padding: 1,
              flexDirection: "column",
            }}
          >
            <Text style={{ color: theme.text.dim }}>
              No accounts connected. Run ':login' to add one.
            </Text>
          </Box>
        </Box>
      </Portal>
    );
  }

  const displayName = selectedAccount
    ? customNames[selectedAccount.email] || selectedAccount.name || selectedAccount.email
    : "";
  const isPrimary = selectedAccount?.email === defaultEmail;

  return (
    <Portal zIndex={100}>
      <DialogKeybinds />
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
            width: DIALOG_WIDTH,
            height: 14,
            bg: theme.modal.background,
            padding: 1,
            flexDirection: "column",
            clip: true,
          }}
        >
          {/* Header */}
          <Box style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 1 }}>
            <Text style={{ color: theme.accent.primary, bold: true }}>Accounts</Text>
            <Text style={{ color: theme.text.dim }}>{accounts.length} connected</Text>
          </Box>

          {/* Main content */}
          <Box style={{ flexDirection: "row", flexGrow: 1, clip: true }}>
            {/* Sidebar - account list */}
            <Box
              style={{
                width: SIDEBAR_WIDTH,
                flexDirection: "column",
                borderRight: true,
                borderColor: theme.text.dim,
                paddingRight: 1,
              }}
            >
              {accounts.map((account, i) => {
                const isSelected = i === selectedIndex;
                const isDefault = account.email === defaultEmail;
                const name = customNames[account.email] || account.name || account.email.split("@")[0];

                return (
                  <Text
                    key={account.email}
                    style={{
                      color: isSelected ? theme.selection.text : theme.text.primary,
                      bg: isSelected ? theme.selection.background : undefined,
                    }}
                  >
                    {isDefault ? "● " : "  "}
                    {name.slice(0, SIDEBAR_WIDTH - 4)}
                  </Text>
                );
              })}
            </Box>

            {/* Details panel */}
            <Box style={{ flexDirection: "column", paddingLeft: 1, flexGrow: 1, clip: true }}>
              {selectedAccount && (
                <>
                  {/* Email */}
                  <Box style={{ flexDirection: "row", gap: 1, clip: true }}>
                    <Text style={{ color: theme.text.dim, width: 6 }}>email</Text>
                    <Text style={{ color: theme.text.primary }}>
                      {selectedAccount.email.length > 24 
                        ? selectedAccount.email.slice(0, 22) + "…" 
                        : selectedAccount.email}
                    </Text>
                  </Box>

                  {/* Name */}
                  <Box style={{ flexDirection: "row", gap: 1 }}>
                    <Text style={{ color: theme.text.dim, width: 6 }}>name</Text>
                    {editingName ? (
                      <Input
                        value={nameInput}
                        onChange={setNameInput}
                        placeholder="Custom name..."
                        autoFocus
                        style={{ bg: theme.input.background }}
                        focusedStyle={{ bg: "#3a3a3a", color: "white" }}
                        onKeyPress={(key) => {
                          if (key.name === "return") {
                            handleSaveName();
                            return true;
                          }
                          if (key.name === "escape") {
                            handleCancelEditName();
                            return true;
                          }
                          return false;
                        }}
                      />
                    ) : (
                      <Text style={{ color: theme.text.primary }}>{displayName}</Text>
                    )}
                  </Box>

                  {/* Primary status */}
                  <Box style={{ flexDirection: "row", gap: 1, paddingTop: 1 }}>
                    <Text style={{ color: theme.text.dim, width: 6 }}> </Text>
                    {isPrimary ? (
                      <Text style={{ color: theme.accent.success }}>✓ Primary account</Text>
                    ) : (
                      <Text style={{ color: theme.text.dim }}>Not primary</Text>
                    )}
                  </Box>

                  {/* Delete confirmation */}
                  {showDeleteConfirm && (
                    <Box style={{ paddingTop: 1 }}>
                      <Text style={{ color: theme.accent.error }}>
                        Remove this account? (y/n)
                      </Text>
                    </Box>
                  )}
                </>
              )}
            </Box>
          </Box>

          {/* Footer */}
          <Box style={{ flexDirection: "row", gap: 2, paddingTop: 1 }}>
            <Text style={{ color: theme.text.dim, dim: true }}>
              {editingName
                ? "Enter:save  Esc:cancel"
                : showDeleteConfirm
                  ? "y:confirm  n:cancel"
                  : "n:rename  p:primary  d:delete  Esc:close"}
            </Text>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
