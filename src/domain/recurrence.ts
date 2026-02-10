/**
 * Recurrence rule helpers (RFC 5545 RRULE format)
 * Simple implementation without external dependencies
 */

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

export type EndType = "never" | "count" | "until";

export interface RecurrenceRule {
  frequency: Frequency;
  interval: number;
  weekdays?: Weekday[];
  monthDay?: number;
  endType: EndType;
  count?: number;
  until?: string; // ISO date string
}

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const FREQUENCY_UNITS: Record<Frequency, { singular: string; plural: string }> = {
  DAILY: { singular: "day", plural: "days" },
  WEEKLY: { singular: "week", plural: "weeks" },
  MONTHLY: { singular: "month", plural: "months" },
  YEARLY: { singular: "year", plural: "years" },
};

/**
 * Build RRULE string from RecurrenceRule object
 */
export function buildRRule(rule: RecurrenceRule): string {
  const parts: string[] = [`FREQ=${rule.frequency}`];

  if (rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }

  if (rule.frequency === "WEEKLY" && rule.weekdays && rule.weekdays.length > 0) {
    parts.push(`BYDAY=${rule.weekdays.join(",")}`);
  }

  if (rule.frequency === "MONTHLY" && rule.monthDay) {
    parts.push(`BYMONTHDAY=${rule.monthDay}`);
  }

  if (rule.endType === "count" && rule.count) {
    parts.push(`COUNT=${rule.count}`);
  } else if (rule.endType === "until" && rule.until) {
    // Convert to RRULE date format (YYYYMMDD)
    const untilDate = rule.until.replace(/-/g, "");
    parts.push(`UNTIL=${untilDate}`);
  }

  return `RRULE:${parts.join(";")}`;
}

/**
 * Parse RRULE string into RecurrenceRule object
 */
export function parseRRule(rruleStr: string): RecurrenceRule | null {
  try {
    // Remove RRULE: prefix if present
    const str = rruleStr.replace(/^RRULE:/i, "");
    const parts = str.split(";");
    const params: Record<string, string> = {};

    for (const part of parts) {
      const [key, value] = part.split("=");
      if (key && value) {
        params[key.toUpperCase()] = value;
      }
    }

    const frequency = params.FREQ as Frequency;
    if (!frequency || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(frequency)) {
      return null;
    }

    const rule: RecurrenceRule = {
      frequency,
      interval: params.INTERVAL ? parseInt(params.INTERVAL, 10) : 1,
      endType: "never",
    };

    // Parse weekdays (BYDAY)
    if (params.BYDAY) {
      const days = params.BYDAY.split(",");
      rule.weekdays = days.filter((d): d is Weekday =>
        ["MO", "TU", "WE", "TH", "FR", "SA", "SU"].includes(d)
      );
    }

    // Parse month day
    if (params.BYMONTHDAY) {
      rule.monthDay = parseInt(params.BYMONTHDAY, 10);
    }

    // Parse end condition
    if (params.COUNT) {
      rule.endType = "count";
      rule.count = parseInt(params.COUNT, 10);
    } else if (params.UNTIL) {
      rule.endType = "until";
      // Convert YYYYMMDD to YYYY-MM-DD
      const until = params.UNTIL;
      if (until.length >= 8) {
        rule.until = `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`;
      }
    }

    return rule;
  } catch {
    return null;
  }
}

/**
 * Get default RecurrenceRule
 */
export function getDefaultRecurrenceRule(): RecurrenceRule {
  return {
    frequency: "WEEKLY",
    interval: 1,
    weekdays: [],
    endType: "never",
  };
}

/**
 * Format recurrence rule for display
 */
export function formatRecurrenceRule(rule: RecurrenceRule): string {
  const unit = FREQUENCY_UNITS[rule.frequency];
  
  let text: string;
  if (rule.interval === 1) {
    text = rule.frequency === "DAILY" ? "Daily" :
           rule.frequency === "WEEKLY" ? "Weekly" :
           rule.frequency === "MONTHLY" ? "Monthly" : "Yearly";
  } else {
    text = `Every ${rule.interval} ${unit.plural}`;
  }

  // Add weekdays for weekly
  if (rule.frequency === "WEEKLY" && rule.weekdays && rule.weekdays.length > 0) {
    const dayNames = rule.weekdays.map((d) => WEEKDAY_LABELS[d]).join(", ");
    text += ` on ${dayNames}`;
  }

  // Add month day for monthly
  if (rule.frequency === "MONTHLY" && rule.monthDay) {
    const suffix = getOrdinalSuffix(rule.monthDay);
    text += ` on the ${rule.monthDay}${suffix}`;
  }

  // Add end condition
  if (rule.endType === "count" && rule.count) {
    text += `, ${rule.count} times`;
  } else if (rule.endType === "until" && rule.until) {
    text += ` until ${rule.until}`;
  }

  return text;
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0] ?? "th";
}

/**
 * Check if an event has recurrence
 */
export function hasRecurrence(recurrence?: string[]): boolean {
  return !!recurrence && recurrence.length > 0 && recurrence.some((r) => r.startsWith("RRULE:"));
}

/**
 * Get RRULE from recurrence array
 */
export function getRRuleFromRecurrence(recurrence?: string[]): string | null {
  if (!recurrence) return null;
  return recurrence.find((r) => r.startsWith("RRULE:")) || null;
}
