/**
 * Centralized path management with XDG Base Directory Specification support
 * 
 * Priority:
 * 1. Legacy ~/.aion directory (for backward compatibility)
 * 2. XDG directories:
 *    - Config: $XDG_CONFIG_HOME/aion (default: ~/.config/aion)
 *    - Data: $XDG_DATA_HOME/aion (default: ~/.local/share/aion)
 *    - Cache: $XDG_CACHE_HOME/aion (default: ~/.cache/aion)
 * 
 * If ~/.aion exists, we use it for all files (backward compat).
 * New installations use XDG paths.
 */

import { homedir } from "os";
import { join } from "path";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";

const home = homedir();

// Legacy directory (for backward compatibility)
export const LEGACY_AION_DIR = join(home, ".aion");

// Check if legacy directory exists (cached at module load)
const useLegacyPaths = existsSync(LEGACY_AION_DIR);

// XDG Base Directories with defaults
const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(home, ".config");
const XDG_DATA_HOME = process.env.XDG_DATA_HOME || join(home, ".local", "share");
const XDG_CACHE_HOME = process.env.XDG_CACHE_HOME || join(home, ".cache");

// Aion directories - use legacy if it exists, otherwise XDG
export const AION_CONFIG_DIR = useLegacyPaths ? LEGACY_AION_DIR : join(XDG_CONFIG_HOME, "aion");
export const AION_DATA_DIR = useLegacyPaths ? LEGACY_AION_DIR : join(XDG_DATA_HOME, "aion");
export const AION_CACHE_DIR = useLegacyPaths ? LEGACY_AION_DIR : join(XDG_CACHE_HOME, "aion");

// Config files (user-editable)
export const CONFIG_FILE = join(AION_CONFIG_DIR, "config.toml");
export const CONTACTS_FILE = join(AION_CONFIG_DIR, "contacts.json");

// Data files (app-managed)
export const DB_FILE = join(AION_DATA_DIR, "aion.db");
export const TOKENS_FILE = join(AION_DATA_DIR, "tokens.json");
export const SYNC_TOKENS_FILE = join(AION_DATA_DIR, "sync-tokens.json");
export const CALENDAR_SETTINGS_FILE = join(AION_DATA_DIR, "calendar-settings.json");
export const ACCOUNT_SETTINGS_FILE = join(AION_DATA_DIR, "account-settings.json");

// Logs directory
export const LOGS_DIR = join(AION_DATA_DIR, "logs");

/**
 * Check if using legacy paths
 */
export function isUsingLegacyPaths(): boolean {
  return useLegacyPaths;
}

/**
 * Ensure all Aion directories exist
 */
export async function ensureDirectories(): Promise<void> {
  if (useLegacyPaths) {
    // Legacy: single directory
    await mkdir(LEGACY_AION_DIR, { recursive: true });
    await mkdir(join(LEGACY_AION_DIR, "logs"), { recursive: true });
  } else {
    // XDG: separate directories
    await mkdir(AION_CONFIG_DIR, { recursive: true });
    await mkdir(AION_DATA_DIR, { recursive: true });
    await mkdir(AION_CACHE_DIR, { recursive: true });
    await mkdir(LOGS_DIR, { recursive: true });
  }
}
