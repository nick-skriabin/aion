/**
 * Contact name lookup service
 * 
 * Looks up display names for email addresses using:
 * 1. Stored account names (for your own accounts)
 * 2. Optional manual contacts file (~/.config/aion/contacts.json)
 * 
 * Manual contacts file format:
 * {
 *   "john@example.com": "John Smith",
 *   "jane@company.org": "Jane Doe"
 * }
 */

import { getAccounts } from "../auth/tokens.ts";
import { apiLogger } from "../lib/logger.ts";
import { CONTACTS_FILE } from "../lib/paths.ts";

let manualContacts: Record<string, string> | null = null;

/**
 * Load manual contacts from disk
 */
async function loadManualContacts(): Promise<Record<string, string>> {
  if (manualContacts !== null) return manualContacts;
  
  try {
    const file = Bun.file(CONTACTS_FILE);
    if (await file.exists()) {
      manualContacts = await file.json();
      apiLogger.debug(`Loaded ${Object.keys(manualContacts!).length} manual contacts`);
      return manualContacts!;
    }
  } catch (error) {
    apiLogger.debug("No manual contacts file found (this is normal)");
  }
  
  manualContacts = {};
  return manualContacts;
}

/**
 * Look up name for an email from stored accounts
 */
async function getAccountName(email: string): Promise<string | null> {
  const accounts = await getAccounts();
  const account = accounts.find(
    (a) => a.account.email.toLowerCase() === email.toLowerCase()
  );
  return account?.account.name || null;
}

/**
 * Look up name from manual contacts file
 */
async function getManualContactName(email: string): Promise<string | null> {
  const contacts = await loadManualContacts();
  
  // Try exact match first
  if (contacts[email]) {
    return contacts[email];
  }
  
  // Try case-insensitive match
  const lowerEmail = email.toLowerCase();
  for (const [contactEmail, name] of Object.entries(contacts)) {
    if (contactEmail.toLowerCase() === lowerEmail) {
      return name;
    }
  }
  
  return null;
}

/**
 * Bulk fetch and cache contact names for a list of emails
 * This enriches events with display names where available
 */
export async function prefetchContactNames(emails: string[]): Promise<void> {
  // Just load manual contacts to warm the cache
  await loadManualContacts();
}

/**
 * Get display name for an email address
 * Returns the name if found, or null if not found
 */
export async function getDisplayName(email: string): Promise<string | null> {
  // Check account names first (your own accounts)
  const accountName = await getAccountName(email);
  if (accountName) {
    return accountName;
  }
  
  // Check manual contacts
  const manualName = await getManualContactName(email);
  if (manualName) {
    return manualName;
  }
  
  return null;
}

/**
 * Clear loaded contacts (forces reload on next lookup)
 */
export function clearContactsCache(): void {
  manualContacts = null;
}
