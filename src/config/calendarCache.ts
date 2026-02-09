/**
 * Calendar data cache for instant startup
 * Stores calendar metadata (id, name, color) locally
 */

import { appLogger } from "../lib/logger.ts";
import { AION_DATA_DIR, ensureDirectories } from "../lib/paths.ts";
import { join } from "path";

const CACHE_FILE = join(AION_DATA_DIR, "calendars-cache.json");

export interface CachedCalendar {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  accountEmail: string;
}

interface CalendarCache {
  calendars: CachedCalendar[];
  updatedAt: string;
}

/**
 * Load cached calendars from disk
 */
export async function loadCalendarCache(): Promise<CachedCalendar[]> {
  try {
    const file = Bun.file(CACHE_FILE);
    if (await file.exists()) {
      const cache: CalendarCache = await file.json();
      appLogger.debug(`Loaded ${cache.calendars.length} calendars from cache`);
      return cache.calendars;
    }
  } catch (error) {
    appLogger.debug("No calendar cache found or invalid");
  }
  return [];
}

/**
 * Save calendars to cache
 */
export async function saveCalendarCache(calendars: CachedCalendar[]): Promise<void> {
  try {
    await ensureDirectories();
    const cache: CalendarCache = {
      calendars,
      updatedAt: new Date().toISOString(),
    };
    await Bun.write(CACHE_FILE, JSON.stringify(cache, null, 2));
    appLogger.debug(`Saved ${calendars.length} calendars to cache`);
  } catch (error) {
    appLogger.warn("Failed to save calendar cache", error);
  }
}
