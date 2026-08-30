/**
 * Instagram identity resolution.
 *
 * Two different values can reach us and they are NOT interchangeable:
 *
 *  - `instagram_username` — the public @handle (e.g. "gurasis_.singh"). Linkable.
 *  - `instagram_user_id`  — the numeric account ID the DM automation keys on
 *                           (e.g. "1547352950471604"). NOT linkable; instagram.com
 *                           has no route for it.
 *
 * Legacy manual rows predate the username column and stored a handle directly in
 * `instagram_user_id`, so a non-numeric value there is still treated as a handle.
 */

/** Numeric account IDs are long; a short all-digit value is more likely a handle. */
const ACCOUNT_ID_MIN_DIGITS = 10;

export interface InstagramIdentity {
  /** Handle without the leading "@", when one is known. */
  handle?: string;
  /** Raw numeric account ID, when that is all we have. */
  accountId?: string;
  /** Profile URL — only present when a handle is known. */
  url?: string;
}

function isAccountId(value: string): boolean {
  return /^\d+$/.test(value) && value.length >= ACCOUNT_ID_MIN_DIGITS;
}

/**
 * Resolves the best Instagram identity for display from the two columns.
 * Returns null when neither field holds anything usable.
 */
export function resolveInstagram(
  instagramUserId?: string | null,
  instagramUsername?: string | null
): InstagramIdentity | null {
  const username = instagramUsername?.trim().replace(/^@/, '') || '';
  const userId = instagramUserId?.trim().replace(/^@/, '') || '';

  // A real handle always wins.
  const handle = username || (userId && !isAccountId(userId) ? userId : '');

  if (handle) {
    return {
      handle,
      url: handle.startsWith('http') ? handle : `https://instagram.com/${handle}`,
    };
  }

  // Only the numeric account ID is available — show it, but never as a link.
  if (userId) {
    return { accountId: userId };
  }

  return null;
}
