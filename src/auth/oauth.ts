/**
 * OAuth flow implementation with temporary HTTP server (multi-account support)
 * Uses PKCE (Proof Key for Code Exchange) for enhanced security
 */

import { getAuthUrl, getIncrementalAuthUrl, OAUTH_CONFIG, generatePKCE } from "./credentials.ts";
import { authLogger } from "../lib/logger.ts";
import {
  exchangeCodeForTokens,
  fetchUserInfo,
  saveAccountTokens,
  getAccount,
  removeAccount,
  getAccounts,
  type TokenData,
  type AccountInfo,
  type AccountData,
} from "./tokens.ts";

export interface LoginResult {
  success: boolean;
  error?: string;
  account?: AccountInfo;
  tokens?: TokenData;
}

/**
 * Generate a random state string for CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * HTML page shown after successful login
 */
function getSuccessHtml(email: string, title = "Login Successful!"): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Aion - ${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h1 {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
    }
    p {
      margin: 0;
      opacity: 0.8;
    }
    .email {
      margin-top: 1rem;
      padding: 0.5rem 1rem;
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✅</div>
    <h1>${title}</h1>
    <p>You can close this window and return to Aion.</p>
    <div class="email">${email}</div>
  </div>
</body>
</html>
`;
}

/**
 * HTML page shown after failed login
 */
function getErrorHtml(error: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Aion - Login Failed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #2e1a1a 0%, #3e1621 100%);
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 400px;
    }
    .icon {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
    h1 {
      margin: 0 0 0.5rem 0;
      font-size: 1.5rem;
    }
    p {
      margin: 0;
      opacity: 0.8;
    }
    .error {
      margin-top: 1rem;
      padding: 1rem;
      background: rgba(255,255,255,0.1);
      border-radius: 8px;
      font-family: monospace;
      font-size: 0.875rem;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">❌</div>
    <h1>Login Failed</h1>
    <p>Something went wrong during authentication.</p>
    <div class="error">${error}</div>
  </div>
</body>
</html>
`;
}

/**
 * Start the OAuth login flow to add a new account
 * 
 * Uses PKCE (Proof Key for Code Exchange) for enhanced security:
 * 1. Generates PKCE code_verifier and code_challenge
 * 2. Starts a temporary HTTP server on localhost
 * 3. Opens the browser to Google's consent screen (with code_challenge)
 * 4. Waits for the callback with the authorization code
 * 5. Exchanges the code for tokens (with code_verifier)
 * 6. Fetches user info to identify the account
 * 7. Saves tokens and shuts down the server
 */
export async function startLoginFlow(callbacks?: {
  onAuthUrl?: (url: string) => void;
  onSuccess?: (account: AccountInfo) => void;
  onError?: (error: string) => void;
}): Promise<LoginResult> {
  authLogger.info("Starting OAuth login flow with PKCE");
  
  // Generate PKCE parameters
  const { codeVerifier, codeChallenge } = await generatePKCE();
  const state = generateState();
  const authUrl = getAuthUrl(state, codeChallenge);
  
  return new Promise((resolve) => {
    let server: ReturnType<typeof Bun.serve> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    // Timeout after 5 minutes
    const TIMEOUT_MS = 5 * 60 * 1000;
    
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (server) {
        server.stop();
        server = null;
      }
    };
    
    timeoutId = setTimeout(() => {
      cleanup();
      const error = "Login timed out. Please try again.";
      callbacks?.onError?.(error);
      resolve({ success: false, error });
    }, TIMEOUT_MS);
    
    server = Bun.serve({
      port: OAUTH_CONFIG.port,
      
      async fetch(req) {
        const url = new URL(req.url);
        
        // Handle the OAuth callback
        if (url.pathname === "/callback") {
          const code = url.searchParams.get("code");
          const returnedState = url.searchParams.get("state");
          const error = url.searchParams.get("error");
          
          // Check for errors from Google
          if (error) {
            cleanup();
            const errorMsg = `Google returned error: ${error}`;
            callbacks?.onError?.(errorMsg);
            resolve({ success: false, error: errorMsg });
            return new Response(getErrorHtml(errorMsg), {
              headers: { "Content-Type": "text/html" },
            });
          }
          
          // Validate state (CSRF protection)
          if (returnedState !== state) {
            cleanup();
            const errorMsg = "Invalid state parameter. Possible CSRF attack.";
            callbacks?.onError?.(errorMsg);
            resolve({ success: false, error: errorMsg });
            return new Response(getErrorHtml(errorMsg), {
              headers: { "Content-Type": "text/html" },
            });
          }
          
          // Validate code
          if (!code) {
            cleanup();
            const errorMsg = "No authorization code received.";
            callbacks?.onError?.(errorMsg);
            resolve({ success: false, error: errorMsg });
            return new Response(getErrorHtml(errorMsg), {
              headers: { "Content-Type": "text/html" },
            });
          }
          
          try {
            // Exchange code for tokens (with PKCE code_verifier)
            authLogger.debug("Received authorization code, exchanging for tokens with PKCE");
            const tokens = await exchangeCodeForTokens(code, codeVerifier);
            
            // Fetch user info to identify the account
            authLogger.debug("Fetching user info");
            const userInfo = await fetchUserInfo(tokens.access_token);
            
            // Save account with tokens
            authLogger.debug("Saving account tokens", { email: userInfo.email });
            await saveAccountTokens(userInfo, tokens);
            
            authLogger.info("Login successful", { email: userInfo.email, name: userInfo.name });
            cleanup();
            callbacks?.onSuccess?.(userInfo);
            resolve({ success: true, account: userInfo, tokens });
            return new Response(getSuccessHtml(userInfo.email), {
              headers: { "Content-Type": "text/html" },
            });
          } catch (err) {
            cleanup();
            const errorMsg = err instanceof Error ? err.message : "Failed to complete login";
            authLogger.error("Login failed", { error: errorMsg, stack: err instanceof Error ? err.stack : undefined });
            callbacks?.onError?.(errorMsg);
            resolve({ success: false, error: errorMsg });
            return new Response(getErrorHtml(errorMsg), {
              headers: { "Content-Type": "text/html" },
            });
          }
        }
        
        // Any other path - redirect to callback info
        return new Response("Waiting for OAuth callback...", {
          headers: { "Content-Type": "text/plain" },
        });
      },
      
      error(err) {
        authLogger.error("OAuth server error", err);
        return new Response("Internal server error", { status: 500 });
      },
    });
    
    // Notify about the auth URL
    callbacks?.onAuthUrl?.(authUrl);
    
    // Try to open browser automatically
    try {
      Bun.spawn(["open", authUrl]);
    } catch {
      // If auto-open fails, user can click the link manually
    }
  });
}

/**
 * Upgrade permissions for an existing account (incremental consent)
 * Shows consent screen only for NEW scopes, keeps existing ones
 * Uses PKCE for enhanced security
 */
export async function upgradePermissions(
  email: string,
  callbacks?: {
    onAuthUrl?: (url: string) => void;
    onSuccess?: (account: AccountInfo) => void;
    onError?: (error: string) => void;
  }
): Promise<LoginResult> {
  authLogger.info("Starting permission upgrade flow with PKCE", { email });
  
  // Generate PKCE parameters
  const { codeVerifier, codeChallenge } = await generatePKCE();
  const state = generateState();
  const authUrl = getIncrementalAuthUrl(email, state, codeChallenge);
  
  return new Promise((resolve) => {
    let server: ReturnType<typeof Bun.serve> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const TIMEOUT_MS = 5 * 60 * 1000;
    
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (server) {
        server.stop();
        server = null;
      }
    };
    
    timeoutId = setTimeout(() => {
      cleanup();
      const error = "Permission upgrade timed out. Please try again.";
      callbacks?.onError?.(error);
      resolve({ success: false, error });
    }, TIMEOUT_MS);
    
    server = Bun.serve({
      port: OAUTH_CONFIG.port,
      
      async fetch(req) {
        const url = new URL(req.url);
        
        if (url.pathname === "/callback") {
          const code = url.searchParams.get("code");
          const returnedState = url.searchParams.get("state");
          const error = url.searchParams.get("error");
          
          if (error) {
            cleanup();
            const errorMsg = `Google returned error: ${error}`;
            callbacks?.onError?.(errorMsg);
            resolve({ success: false, error: errorMsg });
            return new Response(getErrorHtml(errorMsg), {
              headers: { "Content-Type": "text/html" },
            });
          }
          
          if (returnedState !== state) {
            cleanup();
            const errorMsg = "Invalid state parameter.";
            callbacks?.onError?.(errorMsg);
            resolve({ success: false, error: errorMsg });
            return new Response(getErrorHtml(errorMsg), {
              headers: { "Content-Type": "text/html" },
            });
          }
          
          if (!code) {
            cleanup();
            const errorMsg = "No authorization code received.";
            callbacks?.onError?.(errorMsg);
            resolve({ success: false, error: errorMsg });
            return new Response(getErrorHtml(errorMsg), {
              headers: { "Content-Type": "text/html" },
            });
          }
          
          try {
            authLogger.debug("Exchanging code for upgraded tokens with PKCE");
            const tokens = await exchangeCodeForTokens(code, codeVerifier);
            
            authLogger.debug("Fetching user info");
            const userInfo = await fetchUserInfo(tokens.access_token);
            
            // Update account tokens
            authLogger.debug("Updating account tokens", { email: userInfo.email });
            await saveAccountTokens(userInfo, tokens);
            
            authLogger.info("Permission upgrade successful", { email: userInfo.email });
            cleanup();
            callbacks?.onSuccess?.(userInfo);
            resolve({ success: true, account: userInfo, tokens });
            return new Response(getSuccessHtml(userInfo.email, "Permissions upgraded!"), {
              headers: { "Content-Type": "text/html" },
            });
          } catch (err) {
            cleanup();
            const errorMsg = err instanceof Error ? err.message : "Unknown error during permission upgrade";
            authLogger.error("Permission upgrade failed", { error: errorMsg });
            callbacks?.onError?.(errorMsg);
            resolve({ success: false, error: errorMsg });
            return new Response(getErrorHtml(errorMsg), {
              headers: { "Content-Type": "text/html" },
            });
          }
        }
        
        return new Response("Not found", { status: 404 });
      },
    });
    
    callbacks?.onAuthUrl?.(authUrl);
    
    try {
      Bun.spawn(["open", authUrl]);
    } catch {
      // User can click the link manually
    }
  });
}

/**
 * Logout a specific account by email
 */
export async function logoutAccount(email: string): Promise<void> {
  await removeAccount(email);
}

/**
 * Logout all accounts
 */
export async function logoutAll(): Promise<void> {
  const accounts = await getAccounts();
  for (const account of accounts) {
    await removeAccount(account.account.email);
  }
}

/**
 * Check if any account is logged in
 */
export async function isLoggedIn(): Promise<boolean> {
  const accounts = await getAccounts();
  return accounts.length > 0;
}

/**
 * Legacy alias
 */
export const logout = logoutAll;
