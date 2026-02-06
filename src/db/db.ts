import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.ts";
import { join } from "path";
import { homedir } from "os";

// Database file location
const DB_DIR = join(homedir(), ".aion");
const DB_PATH = join(DB_DIR, "aion.db");

// Ensure directory exists
async function ensureDbDir(): Promise<void> {
  const dir = Bun.file(DB_DIR);
  try {
    await Bun.write(join(DB_DIR, ".keep"), "");
  } catch {
    // Directory might exist, that's fine
  }
}

// Initialize SQLite database
let sqlite: Database | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function initDb(): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  if (db) return db;
  
  await ensureDbDir();
  
  sqlite = new Database(DB_PATH);
  
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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  
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

export { DB_PATH };
