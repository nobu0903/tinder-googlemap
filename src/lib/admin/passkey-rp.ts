/** Vercel sends meshidoko.com to www. The passkey records the page that created it. */
const PRODUCTION_ORIGIN = "https://www.meshidoko.com";

export function adminPasskeyRelyingParty(env: {
  NODE_ENV?: string;
  ADMIN_PASSKEY_ORIGIN?: string;
} = process.env): { rpID: string; origin: string } {
  const configured = env.ADMIN_PASSKEY_ORIGIN?.trim();
  const origin =
    configured ||
    (env.NODE_ENV === "production"
      ? PRODUCTION_ORIGIN
      : "http://localhost:3000");
  return { rpID: new URL(origin).hostname, origin };
}
