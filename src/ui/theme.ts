import { getConfig } from "../config/config.ts";

// Get theme from config
function getTheme() {
  return getConfig().theme;
}

// Theme accessor that reads from config
export const theme = {
  get text() {
    return getTheme().text;
  },
  get accent() {
    return getTheme().accent;
  },
  get eventType() {
    return getTheme().eventType;
  },
  get selection() {
    return getTheme().selection;
  },
  get status() {
    return getTheme().status;
  },
  get modal() {
    return getTheme().modal;
  },
  get input() {
    return getTheme().input;
  },
};
