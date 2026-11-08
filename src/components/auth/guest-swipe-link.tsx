"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/hooks/use-auth";
import { attachGuestBrowser } from "@/lib/swipe/guest-client";

/** When a browser signs in, its earlier swipe days count as that account. */
export function GuestSwipeLink() {
  const { accessToken } = useAuth();

  useEffect(() => {
    if (!accessToken) return;
    attachGuestBrowser(accessToken);
  }, [accessToken]);

  return null;
}
