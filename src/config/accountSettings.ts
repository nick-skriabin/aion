/**
 * Account settings persistence
 * Stores custom account names and other local-only settings
 */

import { appLogger } from "../lib/logger.ts";
import { ACCOUNT_SETTINGS_FILE, ensureDirectories } from "../lib/paths.ts";

export interface AccountSettings {
  customNames: Record<string, string>; // email -> custom name
}

const defaultSettings: AccountSettings = {
  customNames: {},
};

export async function loadAccountSettings(): Promise<AccountSettings> {
  try {
    const file = Bun.file(ACCOUNT_SETTINGS_FILE);
    if (await file.exists()) {
      const data = await file.json();
      return { ...defaultSettings, ...data };
    }
  } catch (error) {
    appLogger.warn("Failed to load account settings:", error);
  }
  return defaultSettings;
}

export async function saveAccountSettings(settings: AccountSettings): Promise<void> {
  try {
    await ensureDirectories();
    await Bun.write(ACCOUNT_SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    appLogger.error("Failed to save account settings:", error);
  }
}

export async function getCustomAccountName(email: string): Promise<string | undefined> {
  const settings = await loadAccountSettings();
  return settings.customNames[email];
}

export async function setCustomAccountName(email: string, name: string): Promise<void> {
  const settings = await loadAccountSettings();
  if (name.trim()) {
    settings.customNames[email] = name.trim();
  } else {
    delete settings.customNames[email];
  }
  await saveAccountSettings(settings);
}

export async function removeAccountSettings(email: string): Promise<void> {
  const settings = await loadAccountSettings();
  delete settings.customNames[email];
  await saveAccountSettings(settings);
}
