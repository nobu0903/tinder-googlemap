"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { safeInternalRedirect } from "@/lib/auth/safe-redirect";
import { supabase } from "@/lib/supabase/client";

interface AuthRedirectOptions {
  /** Path to open after email confirmation (relative, e.g. /?theme=...) */
  next?: string;
}

interface UseAuthReturn {
  user: User | null;
  session: Session | null;
  accessToken: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    options?: AuthRedirectOptions,
  ) => Promise<{ error: string | null }>;
  resendConfirmation: (
    email: string,
    options?: AuthRedirectOptions,
  ) => Promise<{ error: string | null }>;
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

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, options?: AuthRedirectOptions) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: buildConfirmRedirectUrl(options?.next) },
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  const resendConfirmation = useCallback(
    async (email: string, options?: AuthRedirectOptions) => {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: buildConfirmRedirectUrl(options?.next),
        },
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    user: session?.user ?? null,
    session,
    accessToken: session?.access_token ?? null,
    isLoading,
    signIn,
    signUp,
    resendConfirmation,
    signOut,
  };
}
