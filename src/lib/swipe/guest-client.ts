"use client";

import { tokyoDateKey } from "@/lib/admin/growth";
import { supabase } from "@/lib/supabase/client";
import { getOrCreateGuestId } from "@/lib/swipe/guest-id";

const NOTED_KEY = "vl-guest-noted";

async function postGuest(guestId: string, accessToken?: string): Promise<boolean> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const res = await fetch("/api/swipe/guest", {
    method: "POST",
    headers,
    body: JSON.stringify({ guestId }),
  });
  return res.ok;
}

/** Ask the server to count this browser once for today. Failures stay on the next swipe. */
export function noteGuestSwipeInBrowser(): void {
  const guestId = getOrCreateGuestId();
  if (!guestId) return;
  const today = tokyoDateKey(new Date());
  try {
    if (window.localStorage.getItem(NOTED_KEY) === today) return;
  } catch {
    return;
  }

  void postGuest(guestId)
    .then(async (ok) => {
      if (!ok) return;
      try {
        window.localStorage.setItem(NOTED_KEY, today);
      } catch {
        // The mark is saved. A repeat request tomorrow still works.
      }
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) await postGuest(guestId, token);
    })
    .catch(() => {
      // The swipe itself already moved on.
    });
}

/** Attach this browser's marks to the signed-in account. */
export function attachGuestBrowser(accessToken: string): void {
  const guestId = getOrCreateGuestId();
  if (!guestId) return;
  void postGuest(guestId, accessToken).catch(() => {
    // The next signed-in visit tries again.
  });
}
