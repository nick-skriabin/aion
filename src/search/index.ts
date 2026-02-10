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
 * Uses simple case-insensitive substring matching for predictable results
 */
export function searchEvents(query: string): GCalEvent[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }
  
  const terms = trimmed.split(/\s+/).filter(t => t.length > 0);
  if (terms.length === 0) return [];
  
  const results: GCalEvent[] = [];
  
  for (const event of indexedEvents.values()) {
    const title = (event.summary || "").toLowerCase();
    const description = (event.description || "").toLowerCase();
    const location = (event.location || "").toLowerCase();
    const searchable = `${title} ${description} ${location}`;
    
    // All terms must match somewhere in the event
    const allMatch = terms.every(term => searchable.includes(term));
    if (allMatch) {
      results.push(event);
    }
  }
  
  // Sort by title match quality (title matches first)
  return results.sort((a, b) => {
    const aTitle = (a.summary || "").toLowerCase();
    const bTitle = (b.summary || "").toLowerCase();
    const aInTitle = terms.every(t => aTitle.includes(t));
    const bInTitle = terms.every(t => bTitle.includes(t));
    
    if (aInTitle && !bInTitle) return -1;
    if (!aInTitle && bInTitle) return 1;
    return 0;
  });
}

/**
 * Check if index is built
 */
export function isIndexReady(): boolean {
  return searchIndex !== null;
}
