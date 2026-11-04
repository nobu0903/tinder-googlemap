"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import { safeInternalRedirect } from "@/lib/auth/safe-redirect";

function ConfirmContent() {
  const router = useRouter();
  const params = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    // Guard against React Strict Mode double-invoke
    if (ran.current) return;
    ran.current = true;

    const code = params.get("code");
    const next = safeInternalRedirect(params.get("next"), "/");

    if (!code) {
      router.replace("/login?error=confirmation_failed");
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        router.replace("/login?error=confirmation_failed");
      } else {
        router.replace(next);
      }
    });
  }, [router, params]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-midnight px-6 text-center">
      <div className="size-10 animate-spin rounded-full border-2 border-surface-raised border-t-electric-chilli" />
      <p className="text-sm text-text-muted">ログインしています…</p>
    </div>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-midnight">
          <div className="size-10 animate-spin rounded-full border-2 border-surface-raised border-t-electric-chilli" />
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
