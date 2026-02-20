/**
 * Multi-account token storage and refresh logic for Google OAuth
 */

import { join } from "path";
import { getGoogleClientId, getGoogleClientSecret, OAUTH_CONFIG } from "./credentials.ts";
import { authLogger } from "../lib/logger.ts";
import { AION_DATA_DIR, TOKENS_FILE, LEGACY_AION_DIR, ensureDirectories } from "../lib/paths.ts";

export interface TokenData {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  // We add this to track expiration
  expires_at?: number;
}

export type AccountType = "google" | "caldav";

export interface AccountInfo {
  email: string;
  name?: string;
  picture?: string;
  type: AccountType; // "google" or "caldav"
}

export interface CalDAVCredentials {
  serverUrl: string;
  username: string;
  password?: string;
  password_command?: string;
}

export interface AccountData {
  account: AccountInfo;
  tokens?: TokenData; // Google OAuth tokens
  caldavCredentials?: CalDAVCredentials; // CalDAV server credentials
}

export interface AccountsStore {
  accounts: Record<string, AccountData>; // Keyed by email
  defaultAccount?: string; // Email of default account
}

const ACCOUNTS_FILE = join(AION_DATA_DIR, "accounts.json");

// Legacy single-account file (for migration)
const LEGACY_TOKENS_FILE = join(LEGACY_AION_DIR, "tokens.json");

/**
 * Load accounts store from disk
 */
export async function loadAccountsStore(): Promise<AccountsStore> {
  try {
    const file = Bun.file(ACCOUNTS_FILE);
    if (await file.exists()) {
      const content = await file.text();
      const store = JSON.parse(content) as AccountsStore;
      // Migrate: ensure all accounts have a type (default to "google" for backward compat)
      for (const key of Object.keys(store.accounts)) {
        const acct = store.accounts[key];
        if (acct && !acct.account.type) {
          acct.account.type = "google";
        }
      }
      return store;
    }
  } catch {
    // File doesn't exist or is invalid
  }
  
  // Try to migrate from legacy single-account file
  try {
    const legacyFile = Bun.file(LEGACY_TOKENS_FILE);
    if (await legacyFile.exists()) {
      const content = await legacyFile.text();
      const tokens = JSON.parse(content) as TokenData;
      
      // We don't have the email, so we'll need to fetch it
      // For now, create a placeholder that will be updated on first use
      return {
        accounts: {},
        defaultAccount: undefined,
      };
    }
  } catch {
    // Legacy file doesn't exist
  }
  
  return { accounts: {} };
}

/**
 * Save accounts store to disk
 */
async function saveAccountsStore(store: AccountsStore): Promise<void> {
  await ensureDirectories();
  await Bun.write(ACCOUNTS_FILE, JSON.stringify(store, null, 2));
}

/**
 * Get all logged-in accounts (Google from accounts.json + CalDAV from config.toml)
 */
export async function getAccounts(): Promise<AccountData[]> {
  const store = await loadAccountsStore();
  // Google accounts from accounts.json
  const googleAccounts = Object.values(store.accounts).filter(
    (a) => a.account.type !== "caldav"
  );

  // CalDAV accounts from config.toml
  const { getCalDAVAccounts } = await import("../config/config.ts");
  const caldavConfigs = getCalDAVAccounts();
  const caldavAccounts: AccountData[] = caldavConfigs.map((cfg) => ({
    account: {
      email: cfg.email,
      name: cfg.name,
      type: "caldav" as AccountType,
    },
    caldavCredentials: {
      serverUrl: cfg.server_url,
      username: cfg.username,
      password: cfg.password,
      password_command: cfg.password_command,
    },
  }));

  return [...googleAccounts, ...caldavAccounts];
}

/**
 * Get account by email
 */
export async function getAccount(email: string): Promise<AccountData | null> {
  const store = await loadAccountsStore();
  return store.accounts[email] ?? null;
}

/**
 * Get the default account
 */
export async function getDefaultAccount(): Promise<AccountData | null> {
  const store = await loadAccountsStore();
  if (store.defaultAccount && store.accounts[store.defaultAccount]) {
    return store.accounts[store.defaultAccount] ?? null;
  }
  // Fall back to first account if no default set
  const accounts = Object.values(store.accounts);
  return accounts[0] ?? null;
}

/**
 * Set the default account
 */
export async function setDefaultAccount(email: string): Promise<void> {
  const store = await loadAccountsStore();
  if (!store.accounts[email]) {
    throw new Error(`Account ${email} not found`);
  }
  store.defaultAccount = email;
  await saveAccountsStore(store);
}

/**
 * Save account tokens (Google OAuth)
 */
export async function saveAccountTokens(account: AccountInfo, tokens: TokenData): Promise<void> {
  const store = await loadAccountsStore();
  
  // Calculate absolute expiration time
  const tokensWithExpiry: TokenData = {
    ...tokens,
    expires_at: Date.now() + (tokens.expires_in * 1000),
  };
  
  store.accounts[account.email] = {
    account: { ...account, type: account.type || "google" },
    tokens: tokensWithExpiry,
  };
  
  // Set as default if it's the first account
  if (!store.defaultAccount || Object.keys(store.accounts).length === 1) {
    store.defaultAccount = account.email;
  }
  
  await saveAccountsStore(store);
}

/**
 * Save CalDAV account credentials (writes to config.toml)
 */
export async function saveCalDAVAccount(
  account: AccountInfo,
  credentials: CalDAVCredentials
): Promise<void> {
  const { saveCalDAVAccountToConfig } = await import("../config/config.ts");
  await saveCalDAVAccountToConfig({
    name: account.name || account.email,
    email: account.email,
    server_url: credentials.serverUrl,
    username: credentials.username,
    password: credentials.password,
    password_command: credentials.password_command,
  });
}

/**
 * Remove an account
 */
export async function removeAccount(email: string): Promise<void> {
  // Check if it's a CalDAV account (from config.toml)
  const { getCalDAVAccounts, removeCalDAVAccountFromConfig } = await import("../config/config.ts");
  const caldavAccounts = getCalDAVAccounts();
  const isCaldav = caldavAccounts.some((a) => a.email === email);

  if (isCaldav) {
    const { clearCalDAVClient } = await import("../api/caldav.ts");
    clearCalDAVClient(email);
    await removeCalDAVAccountFromConfig(email);
    return;
  }

  // Google account — remove from accounts.json
  const store = await loadAccountsStore();
  delete store.accounts[email];
  
  if (store.defaultAccount === email) {
    const remaining = Object.keys(store.accounts);
    store.defaultAccount = remaining[0];
  }
  
  await saveAccountsStore(store);
}

/**
 * Check if any accounts exist (Google or CalDAV)
 */
export async function hasAnyAccount(): Promise<boolean> {
  const store = await loadAccountsStore();
  if (Object.keys(store.accounts).length > 0) return true;
  const { getCalDAVAccounts } = await import("../config/config.ts");
  return getCalDAVAccounts().length > 0;
}

/**
 * Check if the access token is expired (with 5 minute buffer)
 */
export function isTokenExpired(tokens: TokenData): boolean {
  if (!tokens.expires_at) {
    return true;
  }
  // Consider expired 5 minutes before actual expiration
  return Date.now() > (tokens.expires_at - 5 * 60 * 1000);
}

/**
 * Refresh the access token for an account
 */
async function refreshAccountToken(email: string, refreshToken: string): Promise<TokenData> {
  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    // Parse Google's error response for user-friendly messages
    let errorMsg = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error === "invalid_grant") {
        errorMsg = "Token expired/revoked. Run 'login' to re-authenticate.";
      } else if (parsed.error_description) {
        errorMsg = parsed.error_description;
      } else if (parsed.error) {
        errorMsg = parsed.error;
      }
    } catch {
      // Not JSON, use raw text
    }
    throw new Error(errorMsg);
  }
  
  const data = await response.json() as { access_token: string; expires_in: number; token_type: string; scope: string };
  
  // Google doesn't return refresh_token on refresh, keep the old one
  const tokens: TokenData = {
    access_token: data.access_token,
    token_type: data.token_type,
    scope: data.scope,
    expires_in: data.expires_in,
    refresh_token: refreshToken,
    expires_at: Date.now() + (data.expires_in * 1000),
  };
  
  // Update stored tokens
  const store = await loadAccountsStore();
  if (store.accounts[email]) {
    store.accounts[email].tokens = tokens;
    await saveAccountsStore(store);
  }
  
  return tokens;
}

/**
 * Get a valid access token for an account, refreshing if necessary
 * Returns null for CalDAV accounts (they use credentials, not tokens)
 * Throws on token refresh failure so caller can show the error
 */
export async function getValidAccessTokenForAccount(email: string): Promise<string | null> {
  const account = await getAccount(email);
  
  if (!account) {
    return null;
  }
  
  // CalDAV accounts don't use OAuth tokens
  if (account.account.type === "caldav" || !account.tokens) {
    return null;
  }
  
  if (isTokenExpired(account.tokens)) {
    if (!account.tokens.refresh_token) {
      throw new Error(`No refresh token for ${email}. Please re-login.`);
    }
    
    // Let token refresh errors propagate so user sees the actual issue
    const refreshed = await refreshAccountToken(email, account.tokens.refresh_token);
    authLogger.info(`Token refreshed for ${email}`);
    return refreshed.access_token;
  }
  
  return account.tokens.access_token;
}

/**
 * Get a valid access token (for default account - backwards compatibility)
 */
export async function getValidAccessToken(): Promise<string | null> {
  const defaultAccount = await getDefaultAccount();
  if (!defaultAccount) {
    return null;
  }
  return getValidAccessTokenForAccount(defaultAccount.account.email);
}

/**
 * Exchange authorization code for tokens (with PKCE)
 * @param code - Authorization code from OAuth callback
 * @param codeVerifier - PKCE code verifier used when generating the auth URL
 */
export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenData> {
  authLogger.debug("Exchanging authorization code for tokens (with PKCE)");
  
  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: OAUTH_CONFIG.redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier, // PKCE verification
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    authLogger.error("Failed to exchange code for tokens", { status: response.status, error });
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }
  
  const tokens = await response.json() as TokenData;
  
  // Validate we got a refresh_token - Google sometimes omits it on re-auth
  if (!tokens.refresh_token) {
    authLogger.warn("No refresh_token in response - user may need to revoke access first");
    throw new Error(
      "Google didn't provide a refresh token. Please revoke Aion's access at " +
      "https://myaccount.google.com/permissions and try again."
    );
  }
  
  authLogger.info("Successfully exchanged code for tokens");
  return tokens;
}

/**
 * Fetch user info using access token
 */
export async function fetchUserInfo(accessToken: string): Promise<AccountInfo> {
  authLogger.debug("Fetching user info from Google");
  
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    authLogger.error("Failed to fetch user info", { status: response.status, error });
    throw new Error(`Failed to fetch user info: ${error}`);
  }
  
  const data = await response.json() as { email: string; name?: string; picture?: string };
  authLogger.info("User info fetched successfully", { email: data.email });
  return {
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}

// Legacy compatibility
export async function loadTokens(): Promise<TokenData | null> {
  const defaultAccount = await getDefaultAccount();
  return defaultAccount?.tokens ?? null;
}

export async function hasTokens(): Promise<boolean> {
  return await hasAnyAccount();
}

export async function deleteTokens(): Promise<void> {
  const store = await loadAccountsStore();
  store.accounts = {};
  store.defaultAccount = undefined;
  await saveAccountsStore(store);
}
