import { join } from "path";
import { homedir } from "os";
import TOML from "@iarna/toml";
import { ConfigSchema, type Config } from "./schema.ts";
import { appLogger } from "../lib/logger.ts";

const CONFIG_DIR = join(homedir(), ".aion");
const CONFIG_PATH = join(CONFIG_DIR, "config.toml");

// Default config as TOML string for reference
export const DEFAULT_CONFIG_TOML = `# Aion Configuration
# Place this file at ~/.aion/config.toml

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
  if (cachedConfig) return cachedConfig;

  try {
    const file = Bun.file(CONFIG_PATH);
    if (await file.exists()) {
      const content = await file.text();
      const parsed = TOML.parse(content);
      cachedConfig = ConfigSchema.parse(parsed);
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
    // Sync fallback - should call loadConfig() first
    cachedConfig = ConfigSchema.parse({});
  }
  return cachedConfig;
}

export async function createDefaultConfig(): Promise<void> {
  try {
    await Bun.write(join(CONFIG_DIR, ".keep"), "");
    await Bun.write(CONFIG_PATH, DEFAULT_CONFIG_TOML);
  } catch {
    // Ignore errors
  }
}
