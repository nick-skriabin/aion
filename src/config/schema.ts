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

// Theme configuration schema
const ThemeSchema = z.object({
  bg: z.object({
    primary: TerminalColorSchema.default("black"),
    secondary: TerminalColorSchema.default("black"),
    selected: TerminalColorSchema.default("blue"),
    hover: TerminalColorSchema.default("blackBright"),
  }).default({}),
  text: z.object({
    primary: TerminalColorSchema.default("white"),
    secondary: TerminalColorSchema.default("whiteBright"),
    dim: TerminalColorSchema.default("blackBright"),
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
  border: z.object({
    normal: TerminalColorSchema.default("blackBright"),
    focus: TerminalColorSchema.default("cyan"),
  }).default({}),
  status: z.object({
    accepted: TerminalColorSchema.default("green"),
    declined: TerminalColorSchema.default("red"),
    tentative: TerminalColorSchema.default("yellow"),
    needsAction: TerminalColorSchema.default("blackBright"),
  }).default({}),
}).default({});

// Full config schema
export const ConfigSchema = z.object({
  theme: ThemeSchema,
}).default({});

export type Config = z.infer<typeof ConfigSchema>;
export type Theme = z.infer<typeof ThemeSchema>;
