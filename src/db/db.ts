import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.ts";
import { DB_FILE, ensureDirectories } from "../lib/paths.ts";

// Initialize SQLite database
let sqlite: Database | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function initDb(): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  if (db) return db;
  
  await ensureDirectories();
  
  sqlite = new Database(DB_FILE);
  
  // Run migrations inline (simple approach for v0)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      description TEXT,
      location TEXT,
      html_link TEXT,
      status TEXT NOT NULL,
      event_type TEXT,
      visibility TEXT,
      start_date TEXT,
      start_date_time TEXT,
      start_time_zone TEXT,
      end_date TEXT,
      end_date_time TEXT,
      end_time_zone TEXT,
      recurrence_json TEXT,
      recurring_event_id TEXT,
      original_start_json TEXT,
      attendees_json TEXT,
      organizer_json TEXT,
      hangout_link TEXT,
      reminders_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
  // Add new columns if they don't exist (migration for existing DBs)
  try {
    sqlite.exec(`ALTER TABLE events ADD COLUMN visibility TEXT;`);
  } catch { /* column already exists */ }
  try {
    sqlite.exec(`ALTER TABLE events ADD COLUMN reminders_json TEXT;`);
  } catch { /* column already exists */ }
  try {
    sqlite.exec(`ALTER TABLE events ADD COLUMN account_email TEXT;`);
  } catch { /* column already exists */ }
  try {
    sqlite.exec(`ALTER TABLE events ADD COLUMN calendar_id TEXT;`);
  } catch { /* column already exists */ }
  
  db = drizzle(sqlite, { schema });
  return db;
}

export function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return db;
}

export function closeDb(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}

export { DB_FILE as DB_PATH };
