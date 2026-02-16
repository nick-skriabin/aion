/**
 * Sync token storage for incremental Google Calendar sync
 * Stores tokens per calendar (accountEmail:calendarId)
 */

import { appLogger } from "../lib/logger.ts";
import { SYNC_TOKENS_FILE, ensureDirectories } from "../lib/paths.ts";

interface SyncTokenStore {
  // Key is "accountEmail:calendarId"
  tokens: Record<string, string>;
  lastFullSync?: string; // ISO timestamp of last full sync
}

let cache: SyncTokenStore | null = null;

/**
 * Separator used in sync token keys. Must not appear in email addresses or calendar IDs.
 * Using tab character since CalDAV calendar IDs are URLs (contain colons).
 */
const SYNC_KEY_SEP = "\t";

/**
 * Get the sync token key for a calendar
 */
export function getSyncTokenKey(accountEmail: string, calendarId: string): string {
  return `${accountEmail}${SYNC_KEY_SEP}${calendarId}`;
}

/**
 * Parse a sync token key back into accountEmail and calendarId
 */
export function parseSyncTokenKey(key: string): { accountEmail: string; calendarId: string } | null {
  const sepIdx = key.indexOf(SYNC_KEY_SEP);
  if (sepIdx === -1) {
    // Legacy key format (colon-separated) - only works for Google calendar IDs
    const colonIdx = key.indexOf(":");
    if (colonIdx === -1) return null;
    return {
      accountEmail: key.substring(0, colonIdx),
      calendarId: key.substring(colonIdx + 1),
    };
  }
  return {
    accountEmail: key.substring(0, sepIdx),
    calendarId: key.substring(sepIdx + 1),
  };
}

/**
 * Load sync tokens from disk
 * @param forceReload - If true, ignores cache and reads from disk
 */
async function loadTokens(forceReload = false): Promise<SyncTokenStore> {
  if (cache && !forceReload) return cache;
  
  try {
    const file = Bun.file(SYNC_TOKENS_FILE);
    if (await file.exists()) {
      cache = await file.json();
      appLogger.debug("Loaded sync tokens from disk", { count: Object.keys(cache!.tokens).length });
      return cache!;
    }
  } catch (error) {
    appLogger.warn("Failed to load sync tokens, starting fresh", { error });
  }
  
  appLogger.debug("No sync tokens file, starting fresh");
  cache = { tokens: {} };
  return cache;
}

/**
 * Save sync tokens to disk
 */
async function saveTokens(store: SyncTokenStore): Promise<void> {
  try {
    await ensureDirectories();
    await Bun.write(SYNC_TOKENS_FILE, JSON.stringify(store, null, 2));
    cache = store;
  } catch (error) {
    appLogger.error("Failed to save sync tokens", { error });
  }
}

/**
 * Get sync token for a specific calendar
 */
export async function getSyncToken(accountEmail: string, calendarId: string): Promise<string | undefined> {
  const store = await loadTokens();
  const key = getSyncTokenKey(accountEmail, calendarId);
  return store.tokens[key];
}

/**
 * Set sync token for a specific calendar
 */
export async function setSyncToken(accountEmail: string, calendarId: string, token: string): Promise<void> {
  const store = await loadTokens();
  const key = getSyncTokenKey(accountEmail, calendarId);
  store.tokens[key] = token;
  await saveTokens(store);
}

/**
 * Clear sync token for a specific calendar (forces full sync next time)
 */
export async function clearSyncToken(accountEmail: string, calendarId: string): Promise<void> {
  const store = await loadTokens();
  const key = getSyncTokenKey(accountEmail, calendarId);
  delete store.tokens[key];
  await saveTokens(store);
}

/**
 * Clear all sync tokens (forces full sync for everything)
 */
export async function clearAllSyncTokens(): Promise<void> {
  cache = { tokens: {} };
  await saveTokens(cache);
}

/**
 * Get last full sync timestamp
 */
export async function getLastFullSync(): Promise<string | undefined> {
  const store = await loadTokens();
  return store.lastFullSync;
}

/**
 * Set last full sync timestamp
 */
export async function setLastFullSync(timestamp: string): Promise<void> {
  const store = await loadTokens();
  store.lastFullSync = timestamp;
  await saveTokens(store);
}
