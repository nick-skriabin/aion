import { z } from "zod";

// Terminal color names supported by Glyph
const TerminalColorSchema = z.enum([
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "blackBright",
  "redBright",
  "greenBright",
  "yellowBright",
  "blueBright",
  "magentaBright",
  "cyanBright",
  "whiteBright",
]);

export type TerminalColor = z.infer<typeof TerminalColorSchema>;

// Theme configuration schema - minimal, inherits from terminal
const ThemeSchema = z.object({
  text: z.object({
    primary: TerminalColorSchema.default("white"),
    secondary: TerminalColorSchema.default("whiteBright"),
    dim: TerminalColorSchema.default("blackBright"),
    weekend: TerminalColorSchema.default("redBright"),
  }).default({}),
  accent: z.object({
    primary: TerminalColorSchema.default("cyan"),
    success: TerminalColorSchema.default("green"),
    warning: TerminalColorSchema.default("yellow"),
    error: TerminalColorSchema.default("red"),
  }).default({}),
  eventType: z.object({
    default: TerminalColorSchema.default("cyan"),
    outOfOffice: TerminalColorSchema.default("magenta"),
    focusTime: TerminalColorSchema.default("blue"),
    birthday: TerminalColorSchema.default("yellow"),
  }).default({}),
  selection: z.object({
    background: TerminalColorSchema.default("blackBright"),
    text: TerminalColorSchema.default("whiteBright"),
  }).default({}),
  status: z.object({
    accepted: TerminalColorSchema.default("green"),
    declined: TerminalColorSchema.default("red"),
    tentative: TerminalColorSchema.default("yellow"),
    needsAction: TerminalColorSchema.default("blackBright"),
  }).default({}),
  modal: z.object({
    background: TerminalColorSchema.default("black"),
    border: TerminalColorSchema.default("blackBright"),
  }).default({}),
  input: z.object({
    background: TerminalColorSchema.default("black"),
    text: TerminalColorSchema.default("white"),
    placeholder: TerminalColorSchema.default("blackBright"),
  }).default({}),
  statusBar: z.object({
    background: TerminalColorSchema.default("black"),
    text: TerminalColorSchema.default("white"),
  }).default({}),
  calendarColors: z.record(z.string(), TerminalColorSchema).default({
    "1": "blue",
    "2": "green",
    "3": "magenta",
    "4": "red",
    "5": "yellow",
    "6": "cyan",
  }),
}).default({});

// Google OAuth configuration
const GoogleSchema = z.object({
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
}).default({});

// View configuration
const ViewSchema = z.object({
  columns: z.number().min(1).max(5).default(1),
}).default({});

// CalDAV account configuration (stored in config.toml, not accounts.json)
export const CalDAVAccountSchema = z.object({
  /** Display name for the account */
  name: z.string(),
  /** Email / identifier for this account */
  email: z.string(),
  /** CalDAV server URL (e.g. https://caldav.icloud.com) */
  server_url: z.string(),
  /** CalDAV username (often same as email) */
  username: z.string(),
  /** Plain-text password (prefer password_command instead) */
  password: z.string().optional(),
  /** Shell command whose stdout is used as the password. Takes precedence over `password`. */
  password_command: z.string().optional(),
});

export type CalDAVAccount = z.infer<typeof CalDAVAccountSchema>;

// Full config schema
export const ConfigSchema = z.object({
  theme: ThemeSchema,
  google: GoogleSchema,
  view: ViewSchema,
  caldav: z.array(CalDAVAccountSchema).default([]),
}).default({});

export type Config = z.infer<typeof ConfigSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
