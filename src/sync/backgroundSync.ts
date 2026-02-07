/**
 * Background sync manager
 * Performs incremental sync every 30 seconds when logged in
 */

import { appLogger } from "../lib/logger.ts";

const SYNC_INTERVAL_MS = 30_000; // 30 seconds

let syncTimer: ReturnType<typeof setInterval> | null = null;
let syncCallback: (() => Promise<void>) | null = null;

/**
 * Start background sync with the given callback
 */
export function startBackgroundSync(callback: () => Promise<void>): void {
  if (syncTimer) {
    appLogger.warn("Background sync already running");
    return;
  }
  
  syncCallback = callback;
  
  // Start the interval
  syncTimer = setInterval(async () => {
    if (syncCallback) {
      try {
        await syncCallback();
      } catch (error) {
        appLogger.error("Background sync failed", { error });
      }
    }
  }, SYNC_INTERVAL_MS);
  
  appLogger.info("Background sync started (30s interval)");
}

/**
 * Stop background sync
 */
export function stopBackgroundSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    syncCallback = null;
    appLogger.info("Background sync stopped");
  }
}

/**
 * Check if background sync is running
 */
export function isBackgroundSyncRunning(): boolean {
  return syncTimer !== null;
}

/**
 * Trigger an immediate sync (outside the regular interval)
 */
export async function triggerImmediateSync(): Promise<void> {
  if (syncCallback) {
    await syncCallback();
  }
}
