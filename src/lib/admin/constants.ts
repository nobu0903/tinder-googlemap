/** HttpOnly cookie holding ADMIN_SECRET after unlock (never exposed to JS). */
export const ADMIN_COOKIE_NAME = "vl_admin";

/**
 * Production-only unlock entry (not linked from the public app).
 * Bookmark this; `/admin` itself 404s without a valid session cookie.
 */
export const ADMIN_UNLOCK_PATH = "/ohyeswaitaminutemisterpostman";
