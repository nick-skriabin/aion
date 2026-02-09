/**
 * Search index using lunr.js
 * Indexes events by title and description for full-text search
 */

import lunr from "lunr";
import type { GCalEvent } from "../domain/gcalEvent.ts";

let searchIndex: lunr.Index | null = null;
let indexedEvents: Map<string, GCalEvent> = new Map();

/**
 * Build or rebuild the search index from events
 */
export function buildSearchIndex(events: Record<string, GCalEvent>): void {
  indexedEvents = new Map(Object.entries(events));
  
  searchIndex = lunr(function () {
    // Configure fields to search
    this.ref("id");
    this.field("title", { boost: 10 }); // Title is more important
    this.field("description");
    this.field("location");
    
    // Add all events to the index
    for (const [id, event] of Object.entries(events)) {
      this.add({
        id,
        title: event.summary || "",
        description: event.description || "",
        location: event.location || "",
      });
    }
  });
}

/**
 * Add a single event to the index
 * Note: lunr doesn't support incremental updates, so we rebuild
 */
export function addToIndex(event: GCalEvent): void {
  indexedEvents.set(event.id, event);
  rebuildIndex();
}

/**
 * Remove an event from the index
 */
export function removeFromIndex(eventId: string): void {
  indexedEvents.delete(eventId);
  rebuildIndex();
}

/**
 * Update an event in the index
 */
export function updateInIndex(event: GCalEvent): void {
  indexedEvents.set(event.id, event);
  rebuildIndex();
}

/**
 * Rebuild index from current indexed events
 */
function rebuildIndex(): void {
  const events: Record<string, GCalEvent> = {};
  for (const [id, event] of indexedEvents) {
    events[id] = event;
  }
  buildSearchIndex(events);
}

/**
 * Search for events matching the query
 * Returns events sorted by relevance
 */
export function searchEvents(query: string): GCalEvent[] {
  if (!searchIndex || !query.trim()) {
    return [];
  }
  
  try {
    // Add wildcard for partial matches
    const searchQuery = query
      .split(/\s+/)
      .filter(term => term.length > 0)
      .map(term => `${term}*`)
      .join(" ");
    
    if (!searchQuery) return [];
    
    const results = searchIndex.search(searchQuery);
    
    // Map results back to events
    return results
      .map(result => indexedEvents.get(result.ref))
      .filter((event): event is GCalEvent => event !== undefined);
  } catch (error) {
    // lunr throws on invalid queries, return empty results
    console.error("Search error:", error);
    return [];
  }
}

/**
 * Check if index is built
 */
export function isIndexReady(): boolean {
  return searchIndex !== null;
}
