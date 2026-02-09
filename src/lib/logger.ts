/**
 * Logger module with file persistence
 * 
 * Logs are stored in ~/.local/share/aion/logs/ with daily rotation
 * (respects XDG Base Directory Specification)
 */

import { join } from "path";
import { LOGS_DIR, ensureDirectories } from "./paths.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: unknown;
}

// Log level priority (higher = more severe)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Current minimum log level (can be configured)
let minLogLevel: LogLevel = "debug";

/**
 * Get today's log file path
 */
function getLogFilePath(): string {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return join(LOGS_DIR, `aion-${date}.log`);
}

/**
 * Ensure logs directory exists
 */
async function ensureLogsDir(): Promise<void> {
  await ensureDirectories();
}

/**
 * Format a log entry for file output
 */
function formatLogEntry(entry: LogEntry): string {
  const { timestamp, level, category, message, data } = entry;
  const levelStr = level.toUpperCase().padEnd(5);
  const categoryStr = category ? `[${category}]` : "";
  
  let line = `${timestamp} ${levelStr} ${categoryStr} ${message}`;
  
  if (data !== undefined) {
    try {
      const dataStr = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      // Indent multi-line data
      if (dataStr.includes("\n")) {
        line += "\n  " + dataStr.split("\n").join("\n  ");
      } else {
        line += ` ${dataStr}`;
      }
    } catch {
      line += ` [unserializable data]`;
    }
  }
  
  return line;
}

/**
 * Write a log entry to file
 */
async function writeLog(entry: LogEntry): Promise<void> {
  // Check log level
  if (LOG_LEVELS[entry.level] < LOG_LEVELS[minLogLevel]) {
    return;
  }
  
  await ensureLogsDir();
  
  const logPath = getLogFilePath();
  const formattedEntry = formatLogEntry(entry) + "\n";
  
  try {
    const file = Bun.file(logPath);
    const existing = await file.exists() ? await file.text() : "";
    await Bun.write(logPath, existing + formattedEntry);
  } catch {
    // Silently fail - we can't log to console in a TUI app
  }
}

/**
 * Create a logger instance for a specific category
 * 
 * IMPORTANT: Never output to console - it corrupts the TUI!
 * All logs go to ~/.local/share/aion/logs/ only.
 */
export function createLogger(category: string) {
  const log = (level: LogLevel, message: string, data?: unknown) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };
    
    // Write to file only (async, don't await)
    writeLog(entry).catch(() => {});
  };
  
  return {
    debug: (message: string, data?: unknown) => log("debug", message, data),
    info: (message: string, data?: unknown) => log("info", message, data),
    warn: (message: string, data?: unknown) => log("warn", message, data),
    error: (message: string, data?: unknown) => log("error", message, data),
  };
}

/**
 * Set the minimum log level
 */
export function setLogLevel(level: LogLevel): void {
  minLogLevel = level;
}

/**
 * Get the current log level
 */
export function getLogLevel(): LogLevel {
  return minLogLevel;
}

/**
 * Read recent logs (last N lines)
 */
export async function readRecentLogs(lines = 100): Promise<string[]> {
  try {
    const logPath = getLogFilePath();
    const file = Bun.file(logPath);
    
    if (!(await file.exists())) {
      return [];
    }
    
    const content = await file.text();
    const allLines = content.split("\n").filter(Boolean);
    
    return allLines.slice(-lines);
  } catch {
    return [];
  }
}

/**
 * Get path to logs directory
 */
export function getLogsDir(): string {
  return LOGS_DIR;
}

/**
 * Clean up old log files (keep last N days)
 */
export async function cleanupOldLogs(keepDays = 7): Promise<number> {
  try {
    await ensureLogsDir();
    
    const now = Date.now();
    const maxAge = keepDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    
    // Read directory using Bun's glob
    const glob = new Bun.Glob("aion-*.log");
    
    for await (const filename of glob.scan(LOGS_DIR)) {
      const filePath = join(LOGS_DIR, filename);
      const file = Bun.file(filePath);
      const stat = await file.stat();
      
      if (stat && now - stat.mtime.getTime() > maxAge) {
        await Bun.write(filePath, ""); // Clear the file
        // Note: Bun doesn't have a direct delete, but we can overwrite with empty
        deletedCount++;
      }
    }
    
    return deletedCount;
  } catch {
    return 0;
  }
}

// Pre-created loggers for common categories
export const authLogger = createLogger("auth");
export const apiLogger = createLogger("api");
export const dbLogger = createLogger("db");
export const appLogger = createLogger("app");
