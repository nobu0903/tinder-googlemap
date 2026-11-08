const STORAGE_KEY = "vl-guest-id";

const GUEST_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isGuestId(value: string): boolean {
  return GUEST_ID_RE.test(value);
}

/** A random id that stays in this browser. Clearing site data starts a new person. */
export function getOrCreateGuestId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && isGuestId(existing)) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return null;
  }
}
