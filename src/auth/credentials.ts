/**
 * Google OAuth 2.0 credentials for Aion (Desktop application type)
 * 
 * Uses PKCE (Proof Key for Code Exchange) for enhanced security.
 * See: https://developers.google.com/identity/protocols/oauth2/native-app
 * 
 * Note: Google REQUIRES client_secret even for Desktop apps with PKCE.
 * For desktop apps, the secret is not truly "secret" (it's embedded in the app),
 * but Google still requires it. PKCE provides the actual security.
 * 
 * Configure credentials via:
 * 1. Environment variables: AION_GOOGLE_CLIENT_ID and AION_GOOGLE_CLIENT_SECRET
 * 2. Config file (~/.aion/config.toml):
 *    [google]
 *    clientId = "your-client-id.apps.googleusercontent.com"
 *    clientSecret = "your-client-secret"
 */

import { getConfig } from "../config/config.ts";

// Get credentials from config or environment variables (fallback)
function getCredentials(): { clientId: string | undefined; clientSecret: string | undefined } {
  const config = getConfig();
  
  return {
    clientId: config.google?.clientId || process.env.AION_GOOGLE_CLIENT_ID,
    clientSecret: config.google?.clientSecret || process.env.AION_GOOGLE_CLIENT_SECRET,
  };
}

// Lazy getters for credentials (config may not be loaded at module init)
export function getGoogleClientId(): string {
  const { clientId } = getCredentials();
  if (!clientId) {
    throw new Error(
      "Google Client ID not configured.\n\n" +
      "Please set up your Google Cloud credentials:\n" +
      "1. Create a project at https://console.cloud.google.com\n" +
      "2. Enable Google Calendar API\n" +
      "3. Create OAuth 2.0 credentials (Desktop app type)\n" +
      "4. Add credentials to ~/.aion/config.toml:\n\n" +
      "   [google]\n" +
      '   clientId = "your-client-id.apps.googleusercontent.com"\n' +
      '   clientSecret = "your-client-secret"\n\n' +
      "Or set environment variables:\n" +
      "   export AION_GOOGLE_CLIENT_ID=your-client-id\n" +
      "   export AION_GOOGLE_CLIENT_SECRET=your-client-secret\n"
    );
  }
  return clientId;
}

export function getGoogleClientSecret(): string {
  const { clientSecret } = getCredentials();
  if (!clientSecret) {
    throw new Error(
      "Google Client Secret not configured.\n\n" +
      "Please add your client secret to ~/.aion/config.toml:\n\n" +
      "   [google]\n" +
      '   clientId = "your-client-id.apps.googleusercontent.com"\n' +
      '   clientSecret = "your-client-secret"\n'
    );
  }
  return clientSecret;
}

// Legacy exports for backwards compatibility (will throw if not configured)
export const GOOGLE_CLIENT_ID = process.env.AION_GOOGLE_CLIENT_ID || "";
export const GOOGLE_CLIENT_SECRET = process.env.AION_GOOGLE_CLIENT_SECRET || "";

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

// ===== PKCE (Proof Key for Code Exchange) =====

/**
 * Generate a cryptographically random code verifier for PKCE
 * Must be 43-128 characters, using unreserved URI characters
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32); // 32 bytes = 43 base64url chars
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate the code challenge from a code verifier using SHA-256
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Base64 URL encode (RFC 4648 §5)
 * Replaces + with -, / with _, and removes = padding
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * PKCE parameters to be passed through the OAuth flow
 */
export interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
}

/**
 * Generate PKCE parameters for a new OAuth flow
 */
export async function generatePKCE(): Promise<PKCEParams> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
}

// ===== Authorization URLs =====

/**
 * Build the authorization URL with PKCE
 */
export function getAuthUrl(state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: OAUTH_CONFIG.redirectUri,
    response_type: "code",
    scope: OAUTH_CONFIG.scopes.join(" "),
    access_type: "offline", // Get refresh token
    prompt: "consent", // Always show consent screen to get refresh token
    state,
    // PKCE parameters
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${OAUTH_CONFIG.authUrl}?${params.toString()}`;
}

/**
 * Build authorization URL for incremental consent (upgrading permissions) with PKCE
 * Only shows consent for NEW scopes, keeps existing grants
 */
export function getIncrementalAuthUrl(loginHint: string, state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: OAUTH_CONFIG.redirectUri,
    response_type: "code",
    scope: OAUTH_CONFIG.scopes.join(" "),
    access_type: "offline",
    include_granted_scopes: "true", // Keep existing scopes, add new ones
    prompt: "consent", // Show consent for new scopes
    state,
    login_hint: loginHint,
    // PKCE parameters
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${OAUTH_CONFIG.authUrl}?${params.toString()}`;
}
