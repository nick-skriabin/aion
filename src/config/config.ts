import TOML from "@iarna/toml";
import { ConfigSchema, type Config } from "./schema.ts";
import { appLogger } from "../lib/logger.ts";
import { AION_CONFIG_DIR, CONFIG_FILE, ensureDirectories } from "../lib/paths.ts";

// Default config as TOML string for reference
export const DEFAULT_CONFIG_TOML = `# Aion Configuration
# Place this file at ~/.config/aion/config.toml

# Google OAuth credentials (required)
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
