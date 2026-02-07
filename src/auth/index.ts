/**
 * Authentication module exports
 */

export { startLoginFlow, logout, logoutAccount, logoutAll, isLoggedIn, upgradePermissions } from "./oauth.ts";
export {
  getValidAccessToken,
  getValidAccessTokenForAccount,
  hasTokens,
  hasAnyAccount,
  loadTokens,
  getAccounts,
  getAccount,
  getDefaultAccount,
  setDefaultAccount,
  removeAccount,
  loadAccountsStore,
} from "./tokens.ts";
export { GOOGLE_CLIENT_ID, OAUTH_CONFIG } from "./credentials.ts";
export type { TokenData, AccountInfo, AccountData, AccountsStore } from "./tokens.ts";
export type { LoginResult } from "./oauth.ts";
