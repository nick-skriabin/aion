/**
 * Google OAuth 2.0 credentials for Aion (Desktop application type)
 * 
 * These are safe to commit for desktop apps - security comes from user consent,
 * not from hiding these values. See: https://developers.google.com/identity/protocols/oauth2/native-app
 */

// Client ID - use env var or default
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Client secret - REQUIRED by Google even with PKCE for Desktop apps
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// OAuth configuration
export const OAUTH_CONFIG = {
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  redirectUri: "http://localhost:8085/callback",
  port: 8085,

  // Scopes for Google Calendar and user info
  scopes: [
    "https://www.googleapis.com/auth/calendar.events", // Read/write events
    "https://www.googleapis.com/auth/calendar.readonly", // Read calendars list
    "https://www.googleapis.com/auth/userinfo.email", // Get user email
    "https://www.googleapis.com/auth/userinfo.profile", // Get user profile (name, picture)
  ],
};

// Build the authorization URL
export function getAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    response_type: "code",
    scope: OAUTH_CONFIG.scopes.join(" "),
    access_type: "offline", // Get refresh token
    prompt: "consent", // Always show consent screen to get refresh token
  });

  if (state) {
    params.set("state", state);
  }

  return `${OAUTH_CONFIG.authUrl}?${params.toString()}`;
}
