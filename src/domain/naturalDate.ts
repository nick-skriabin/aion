/**
 * Natural language date/time parsing using chrono-node
 * 
 * Supports:
 * - Simple dates: "tomorrow", "next friday", "march 5"
 * - Dates with time: "tomorrow 3pm", "friday at 2:30pm"
 * - Time durations: "today 5pm for 15 minutes", "tomorrow 3pm for 2 hours"
 * - Date durations: "from march 5 for 2 weeks", "starting tomorrow for 3 days"
 * - Date ranges: "from today until next friday", "between march 6 and 12"
 */
import * as chrono from "chrono-node";
import { DateTime } from "luxon";

export interface ParsedDateTime {
  date: DateTime;
  endDate?: DateTime; // Optional end date/time (when duration or range is specified)
  hasTime: boolean; // Whether a specific time was mentioned
  duration?: number; // Duration in minutes (if specified for time-based durations)
  isDateRange?: boolean; // Whether this is a multi-day event (all-day)
}

interface ExtractedDuration {
  cleanInput: string;
  durationMinutes: number | null;
  durationDays: number | null;
}

/**
 * Parse duration from input like "for 15 minutes", "for 2 hours", "for 3 days", "for 2 weeks"
 * Returns the duration and the input with duration removed
 */
function extractDuration(input: string): ExtractedDuration {
  // Match time-based patterns: "for 15 minutes", "for 2 hours", "for 1h", "for 30m"
  const timeDurationPattern = /\s+for\s+(\d+(?:\.\d+)?)\s*(m|min|mins|minutes?|h|hr|hrs|hours?)(?:\s|$)/i;
  const timeMatch = input.match(timeDurationPattern);
  
  if (timeMatch && timeMatch[1] && timeMatch[2]) {
    const amount = parseFloat(timeMatch[1]);
    const unit = timeMatch[2].toLowerCase();
    
    let minutes: number;
    if (unit.startsWith("h")) {
      minutes = Math.round(amount * 60);
    } else {
      minutes = Math.round(amount);
    }
    
    const cleanInput = input.replace(timeDurationPattern, " ").trim();
    return { cleanInput, durationMinutes: minutes, durationDays: null };
  }
  
  // Match date-based patterns: "for 3 days", "for 2 weeks", "for 1 week"
  const dateDurationPattern = /\s+for\s+(\d+)\s*(d|day|days|w|wk|wks|week|weeks)(?:\s|$)/i;
  const dateMatch = input.match(dateDurationPattern);
  
  if (dateMatch && dateMatch[1] && dateMatch[2]) {
    const amount = parseInt(dateMatch[1]);
    const unit = dateMatch[2].toLowerCase();
    
    let days: number;
    if (unit.startsWith("w")) {
      days = amount * 7;
    } else {
      days = amount;
    }
    
    const cleanInput = input.replace(dateDurationPattern, " ").trim();
    return { cleanInput, durationMinutes: null, durationDays: days };
  }
  
  return { cleanInput: input, durationMinutes: null, durationDays: null };
}

/**
 * Parse date range patterns like "from X until Y", "from X to Y", "between X and Y"
 * Returns start date, end date, and whether it matched
 */
function parseDateRange(
  input: string,
  ref: Date,
  tz: string
): ParsedDateTime | null {
  const lowerInput = input.toLowerCase();
  
  // Pattern: "from X until/to Y" or "starting X until/to Y"
  const fromUntilMatch = input.match(/^(?:from|starting)\s+(.+?)\s+(?:until|to|till)\s+(.+)$/i);
  if (fromUntilMatch && fromUntilMatch[1] && fromUntilMatch[2]) {
    const startResults = chrono.parse(fromUntilMatch[1], ref, { forwardDate: true });
    const endResults = chrono.parse(fromUntilMatch[2], ref, { forwardDate: true });
    const startResult = startResults[0];
    const endResult = endResults[0];
    
    if (startResult && endResult) {
      const startDate = DateTime.fromJSDate(startResult.start.date(), { zone: tz });
      const endDate = DateTime.fromJSDate(endResult.start.date(), { zone: tz });
      const startHasTime = startResult.start.isCertain("hour");
      const endHasTime = endResult.start.isCertain("hour");
      
      return {
        date: startDate,
        endDate: endDate,
        hasTime: startHasTime && endHasTime,
        isDateRange: !startHasTime || !endHasTime,
      };
    }
  }
  
  // Pattern: "between X and Y"
  const betweenMatch = input.match(/^between\s+(.+?)\s+and\s+(.+)$/i);
  if (betweenMatch && betweenMatch[1] && betweenMatch[2]) {
    const startResults = chrono.parse(betweenMatch[1], ref, { forwardDate: true });
    const endResults = chrono.parse(betweenMatch[2], ref, { forwardDate: true });
    const startResult = startResults[0];
    const endResult = endResults[0];
    
    if (startResult && endResult) {
      const startDate = DateTime.fromJSDate(startResult.start.date(), { zone: tz });
      const endDate = DateTime.fromJSDate(endResult.start.date(), { zone: tz });
      const startHasTime = startResult.start.isCertain("hour");
      const endHasTime = endResult.start.isCertain("hour");
      
      return {
        date: startDate,
        endDate: endDate,
        hasTime: startHasTime && endHasTime,
        isDateRange: !startHasTime || !endHasTime,
      };
    }
    
    // Handle "between march 6 and 12" where "12" is just a day number
    if (startResult) {
      const dayMatch = betweenMatch[2].match(/^(\d{1,2})$/);
      if (dayMatch && dayMatch[1]) {
        const startDate = DateTime.fromJSDate(startResult.start.date(), { zone: tz });
        const endDay = parseInt(dayMatch[1]);
        // Use the same month/year as start date
        let endDate = startDate.set({ day: endDay });
        // If end day is before start day, assume next month
        if (endDate < startDate) {
          endDate = endDate.plus({ months: 1 });
        }
        
        return {
          date: startDate,
          endDate: endDate,
          hasTime: false,
          isDateRange: true,
        };
      }
    }
  }
  
  // Pattern: "X - Y" or "X through Y"
  const dashMatch = input.match(/^(.+?)\s*(?:-|–|through)\s*(.+)$/i);
  if (dashMatch && dashMatch[1] && dashMatch[2] && !dashMatch[1].match(/^\d{1,2}:\d{2}/) && !dashMatch[2].match(/^\d{1,2}:\d{2}/)) {
    // Make sure it's not a time range like "3:00 - 5:00"
    const startResults = chrono.parse(dashMatch[1], ref, { forwardDate: true });
    const endResults = chrono.parse(dashMatch[2], ref, { forwardDate: true });
    const startResult = startResults[0];
    const endResult = endResults[0];
    
    if (startResult && endResult) {
      const startDate = DateTime.fromJSDate(startResult.start.date(), { zone: tz });
      const endDate = DateTime.fromJSDate(endResult.start.date(), { zone: tz });
      const startHasTime = startResult.start.isCertain("hour");
      const endHasTime = endResult.start.isCertain("hour");
      
      // Only treat as date range if at least one part doesn't have time
      if (!startHasTime || !endHasTime) {
        return {
          date: startDate,
          endDate: endDate,
          hasTime: false,
          isDateRange: true,
        };
      }
    }
  }
  
  return null;
}

/**
 * Parse natural language date/time input
 * 
 * Examples:
 * - "tomorrow" → tomorrow at current time
 * - "tomorrow 3pm" → tomorrow at 3:00 PM
 * - "next friday" → next Friday
 * - "fri 2:30pm" → this/next Friday at 2:30 PM
 * - "in 2 hours" → 2 hours from now
 * - "+1d" → tomorrow (same time)
 * - "feb 14" → February 14
 * - "3pm" → today at 3 PM
 * - "today 5pm for 15 minutes" → today 5pm-5:15pm
 * - "tomorrow 3pm for 2 hours" → tomorrow 3pm-5pm
 * - "from march 5 for 2 weeks" → march 5-19 (all-day range)
 * - "from today until next friday" → today through friday
 * - "between march 6 and 12" → march 6-12
 * - "march 5 - march 10" → march 5-10
 */
export function parseNaturalDate(
  input: string,
  referenceDate?: Date,
  timezone?: string
): ParsedDateTime | null {
  if (!input.trim()) return null;

  const ref = referenceDate || new Date();
  const tz = timezone || DateTime.local().zoneName || "local";

  // Try to parse as a date range first (from X until Y, between X and Y)
  const rangeResult = parseDateRange(input, ref, tz);
  if (rangeResult) {
    return rangeResult;
  }

  // Extract duration (time-based or date-based)
  const { cleanInput, durationMinutes, durationDays } = extractDuration(input);

  // Handle our shorthand syntax: +1d, +2w, -1h, etc.
  const shorthandResult = parseShorthand(cleanInput, ref, tz);
  if (shorthandResult) {
    if (durationMinutes) {
      shorthandResult.duration = durationMinutes;
      shorthandResult.endDate = shorthandResult.date.plus({ minutes: durationMinutes });
    } else if (durationDays) {
      // Date-based duration creates a multi-day event
      shorthandResult.endDate = shorthandResult.date.plus({ days: durationDays });
      shorthandResult.isDateRange = true;
      shorthandResult.hasTime = false;
    }
    return shorthandResult;
  }

  // Clean up "from" or "starting" prefix for simple date + duration patterns
  let parseInput = cleanInput;
  if (/^(?:from|starting)\s+/i.test(parseInput)) {
    parseInput = parseInput.replace(/^(?:from|starting)\s+/i, "");
  }

  // Use chrono-node for natural language
  const results = chrono.parse(parseInput, ref, { forwardDate: true });
  
  const parsed = results[0];
  if (!parsed) return null;
  
  const date = parsed.start.date();
  
  // Check if time was explicitly mentioned
  const hasTime = parsed.start.isCertain("hour");
  
  const startDate = DateTime.fromJSDate(date, { zone: tz });
  
  // Calculate end date based on duration type
  let endDate: DateTime | undefined;
  let isDateRange = false;
  
  if (durationMinutes) {
    // Time-based duration
    endDate = startDate.plus({ minutes: durationMinutes });
  } else if (durationDays) {
    // Date-based duration creates a multi-day event
    endDate = startDate.plus({ days: durationDays });
    isDateRange = true;
  }

  return {
    date: startDate,
    endDate,
    hasTime: isDateRange ? false : hasTime, // Date ranges are all-day
    duration: durationMinutes || undefined,
    isDateRange,
  };
}

/**
 * Parse shorthand notation like +1d, +2w, -3h
 */
function parseShorthand(
  input: string,
  ref: Date,
  tz: string
): ParsedDateTime | null {
  const match = input.trim().match(/^([+-])(\d+)([dwhmDWHM])$/);
  if (!match || !match[1] || !match[2] || !match[3]) return null;

  const sign = match[1] === "+" ? 1 : -1;
  const amount = parseInt(match[2]) * sign;
  const unit = match[3].toLowerCase();

  const unitMap: Record<string, keyof Duration> = {
    d: "days",
    w: "weeks",
    h: "hours",
    m: "minutes",
  };

  const luxonUnit = unitMap[unit];
  if (!luxonUnit) return null;

  const date = DateTime.fromJSDate(ref, { zone: tz }).plus({ [luxonUnit]: amount });
  
  return {
    date,
    hasTime: unit === "h" || unit === "m", // Time-based units imply time
  };
}

// Type helper for Luxon duration
type Duration = {
  days?: number;
  weeks?: number;
  hours?: number;
  minutes?: number;
};

/**
 * Format a parsed date for preview display
 */
export function formatParsedPreview(parsed: ParsedDateTime): string {
  // Handle date ranges (multi-day all-day events)
  if (parsed.isDateRange && parsed.endDate) {
    const startStr = parsed.date.toFormat("EEE, MMM d");
    const endStr = parsed.endDate.toFormat("EEE, MMM d");
    
    // Calculate duration in days
    const days = Math.round(parsed.endDate.diff(parsed.date, "days").days);
    
    if (parsed.date.hasSame(parsed.endDate, "month")) {
      // Same month: "Mon, Mar 5 - Fri, Mar 10 (5 days)"
      return `${startStr} - ${endStr} (${days} day${days !== 1 ? "s" : ""})`;
    } else {
      // Different months
      return `${startStr} - ${endStr} (${days} day${days !== 1 ? "s" : ""})`;
    }
  }
  
  if (parsed.hasTime) {
    let result = parsed.date.toFormat("EEE, MMM d 'at' h:mm a");
    
    // Add end time if duration was specified
    if (parsed.endDate) {
      // If same day, just show end time
      if (parsed.date.hasSame(parsed.endDate, "day")) {
        result += ` - ${parsed.endDate.toFormat("h:mm a")}`;
      } else {
        result += ` - ${parsed.endDate.toFormat("MMM d h:mm a")}`;
      }
      
      // Add duration info
      if (parsed.duration) {
        const hours = Math.floor(parsed.duration / 60);
        const mins = parsed.duration % 60;
        if (hours > 0 && mins > 0) {
          result += ` (${hours}h ${mins}m)`;
        } else if (hours > 0) {
          result += ` (${hours}h)`;
        } else {
          result += ` (${mins}m)`;
        }
      }
    }
    
    return result;
  } else {
    // Single all-day date
    return parsed.date.toFormat("EEE, MMM d, yyyy") + " (all-day)";
  }
}

/**
 * Try to parse and return formatted date string for the input field
 * Returns null if parsing fails
 */
export function tryParseToISO(
  input: string,
  referenceDate?: Date,
  timezone?: string
): { date: string; time: string } | null {
  const parsed = parseNaturalDate(input, referenceDate, timezone);
  if (!parsed) return null;

  return {
    date: parsed.date.toFormat("yyyy-MM-dd"),
    time: parsed.date.toFormat("HH:mm"),
  };
}
