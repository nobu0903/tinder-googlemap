/** HttpOnly cookie holding ADMIN_SECRET after unlock (never exposed to JS). */
export const ADMIN_COOKIE_NAME = "vl_admin";

/**
 * Local dev unlock entry (not linked from the public app).
 * Production does not serve this path or `/admin`.
 */
export const ADMIN_UNLOCK_PATH = "/ohyeswaitaminutemisterpostman";
