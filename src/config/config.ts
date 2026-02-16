import TOML from "@iarna/toml";
import { ConfigSchema, type Config, type CalDAVAccount } from "./schema.ts";
import { appLogger } from "../lib/logger.ts";
import { AION_CONFIG_DIR, CONFIG_FILE, ensureDirectories } from "../lib/paths.ts";

// Default config as TOML string for reference
export const DEFAULT_CONFIG_TOML = `# Aion Configuration
# Place this file at ~/.config/aion/config.toml

# Google OAuth credentials (required for Google Calendar)
# Get these from https://console.cloud.google.com
[google]
clientId = ""
clientSecret = ""

[theme.text]
primary = "white"
secondary = "whiteBright"
dim = "blackBright"

[theme.accent]
primary = "cyan"
success = "green"
warning = "yellow"
error = "red"

[theme.eventType]
default = "cyan"
outOfOffice = "magenta"
focusTime = "blue"
birthday = "yellow"

[theme.selection]
indicator = "cyan"
text = "white"

[theme.status]
accepted = "green"
declined = "red"
tentative = "yellow"
needsAction = "blackBright"

# ===== CalDAV Accounts =====
# Add CalDAV calendar accounts (iCloud, Fastmail, Nextcloud, etc.)
# Use :caldav in the app to add accounts interactively.
#
# [[caldav]]
# name = "iCloud"
# email = "me@icloud.com"
# server_url = "https://caldav.icloud.com"
# username = "me@icloud.com"
# password_command = "security find-generic-password -a me@icloud.com -s aion-caldav -w"
#
# Password options (pick one):
#   password = "plain-text"                — simple but less secure
#   password_command = "pass show cal"     — recommended, works with any secret manager
#
# password_command examples:
#   "security find-generic-password -a me@icloud.com -s aion-caldav -w"  — macOS Keychain
#   "pass show calendar/icloud"                                           — pass (GPG)
#   "op read op://Personal/iCloud/password"                               — 1Password CLI
#   "bw get password icloud-caldav"                                       — Bitwarden CLI
`;

let cachedConfig: Config | null = null;

export async function loadConfig(): Promise<Config> {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Ensure directories exist
  await ensureDirectories();

  try {
    const file = Bun.file(CONFIG_FILE);
    if (await file.exists()) {
      const content = await file.text();
      const parsed = TOML.parse(content);
      cachedConfig = ConfigSchema.parse(parsed);
      appLogger.debug("Loaded config from file", { columns: cachedConfig.view.columns });
    } else {
      cachedConfig = ConfigSchema.parse({});
    }
  } catch (error) {
    appLogger.warn("Failed to load config, using defaults", error);
    cachedConfig = ConfigSchema.parse({});
  }

  return cachedConfig;
}

export function getConfig(): Config {
  if (!cachedConfig) {
    // Sync fallback - return defaults but DON'T cache them
    // This allows loadConfig() to properly load from file later
    return ConfigSchema.parse({});
  }
  return cachedConfig;
}

export async function createDefaultConfig(): Promise<void> {
  try {
    await ensureDirectories();
    await Bun.write(CONFIG_FILE, DEFAULT_CONFIG_TOML);
  } catch {
    // Ignore errors
  }
}

// Update a specific config value and save to disk
export async function updateConfig(updates: Partial<Config>): Promise<void> {
  const current = getConfig();
  
  // Deep merge updates
  const updated = {
    ...current,
    ...updates,
    theme: { ...current.theme, ...updates.theme },
    google: { ...current.google, ...updates.google },
    view: { ...current.view, ...updates.view },
    caldav: updates.caldav ?? current.caldav,
  };
  
  cachedConfig = updated;
  
  try {
    await ensureDirectories();
    const tomlContent = TOML.stringify(updated as unknown as TOML.JsonMap);
    await Bun.write(CONFIG_FILE, tomlContent);
  } catch (error) {
    appLogger.error("Failed to save config", error);
  }
}

// ===== CalDAV Account Management =====

/**
 * Get all CalDAV accounts from config
 */
export function getCalDAVAccounts(): CalDAVAccount[] {
  return getConfig().caldav;
}

/**
 * Add or update a CalDAV account in config and save to disk.
 * Matches by email — updates if exists, appends if new.
 */
export async function saveCalDAVAccountToConfig(account: CalDAVAccount): Promise<void> {
  const config = getConfig();
  const existing = config.caldav.findIndex((a) => a.email === account.email);

  const updated = [...config.caldav];
  if (existing >= 0) {
    updated[existing] = account;
  } else {
    updated.push(account);
  }

  await updateConfig({ caldav: updated } as Partial<Config>);
  appLogger.info(`CalDAV account saved to config: ${account.email}`);
}

/**
 * Remove a CalDAV account from config by email and save to disk.
 */
export async function removeCalDAVAccountFromConfig(email: string): Promise<void> {
  const config = getConfig();
  const updated = config.caldav.filter((a) => a.email !== email);
  await updateConfig({ caldav: updated } as Partial<Config>);
  appLogger.info(`CalDAV account removed from config: ${email}`);
}
