"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { safeInternalRedirect } from "@/lib/auth/safe-redirect";
import { supabase } from "@/lib/supabase/client";

interface UseAuthReturn {
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  isLoading: boolean;
  signInWithGoogle: (next?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

function buildConfirmRedirectUrl(next?: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const safeNext = safeInternalRedirect(next, "/");
  const url = new URL("/auth/confirm", window.location.origin);
  if (safeNext !== "/") {
    url.searchParams.set("next", safeNext);
  }
  return url.toString();
}

export function useAuth(): UseAuthReturn {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setIsLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async (next?: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildConfirmRedirectUrl(next),
      },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    user: session?.user ?? null,
    session,
    accessToken: session?.access_token ?? null,
    isLoading,
    signInWithGoogle,
    signOut,
  };
}
