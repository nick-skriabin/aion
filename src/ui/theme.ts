import { getConfig } from "../config/config.ts";

// Get theme from config
function getTheme() {
  return getConfig().theme;
}

// Theme accessor that reads from config
export const theme = {
  get bg() {
    return getTheme().bg;
  },
  get text() {
    return getTheme().text;
  },
  get accent() {
    return getTheme().accent;
  },
  get eventType() {
    return getTheme().eventType;
  },
  get border() {
    return getTheme().border;
  },
  get status() {
    return getTheme().status;
  },
};

// Style helpers
export const styles = {
  get panel() {
    return {
      bg: theme.bg.secondary,
      border: "round" as const,
      borderColor: theme.border.normal,
    };
  },
  get panelFocused() {
    return {
      bg: theme.bg.secondary,
      border: "round" as const,
      borderColor: theme.border.focus,
    };
  },
  get header() {
    return {
      color: theme.text.primary,
      bold: true,
    };
  },
};
