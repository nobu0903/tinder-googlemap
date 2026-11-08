/** HttpOnly cookie holding ADMIN_SECRET after unlock (never exposed to JS). */
export const ADMIN_COOKIE_NAME = "vl_admin";

/**
 * Unlock entry, not linked from the public app.
 * Production also requires ?k=ADMIN_UNLOCK_KEY or the page is a 404.
 */
export const ADMIN_UNLOCK_PATH = "/ohyeswaitaminutemisterpostman";

/** One WebAuthn assertion. This is not a session and is not x-admin-secret. */
export const ADMIN_PASSKEY_HEADER = "x-admin-passkey";
