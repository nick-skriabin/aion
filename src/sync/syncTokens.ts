/**
 * Sync token storage for incremental Google Calendar sync
 * Stores tokens per calendar (accountEmail:calendarId)
 */

import { join } from "path";
import { homedir } from "os";
import { mkdir } from "fs/promises";
import { appLogger } from "../lib/logger.ts";

const SYNC_TOKENS_PATH = join(homedir(), ".aion", "sync-tokens.json");

interface SyncTokenStore {
  // Key is "accountEmail:calendarId"
  tokens: Record<string, string>;
  lastFullSync?: string; // ISO timestamp of last full sync
}

let cache: SyncTokenStore | null = null;

/**
 * Get the sync token key for a calendar
 */
export function getSyncTokenKey(accountEmail: string, calendarId: string): string {
  return `${accountEmail}:${calendarId}`;
}

/**
 * Load sync tokens from disk
 */
async function loadTokens(): Promise<SyncTokenStore> {
  if (cache) return cache;
  
  try {
    const file = Bun.file(SYNC_TOKENS_PATH);
    if (await file.exists()) {
      cache = await file.json();
      return cache!;
    }
  } catch (error) {
    appLogger.warn("Failed to load sync tokens, starting fresh", { error });
  }
  
  cache = { tokens: {} };
  return cache;
}

/**
 * Save sync tokens to disk
 */
async function saveTokens(store: SyncTokenStore): Promise<void> {
  try {
    // Ensure directory exists
    await mkdir(join(homedir(), ".aion"), { recursive: true });
    await Bun.write(SYNC_TOKENS_PATH, JSON.stringify(store, null, 2));
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
