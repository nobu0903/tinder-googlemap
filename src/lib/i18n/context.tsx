"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { translations, type Lang } from "./translations";
import { supabase } from "@/lib/supabase/client";

const STORAGE_KEY = "vibeloop_lang";

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ja" || stored === "en") return stored;
    const browserLang = navigator.language.toLowerCase();
    return browserLang.startsWith("ja") ? "ja" : "en";
  } catch {
    return "ja";
  }
}

type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`,
  );
}

/** Resolve a dot-separated key against a translation object. */
function resolve(obj: unknown, parts: string[]): unknown {
  let cur = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Vars) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "ja",
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ja");

  useEffect(() => {
    setLangState(detectLang());
  }, []);

  // Keep <html lang="…"> in sync
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore (private browsing)
    }
    // Sync to Supabase user metadata (fire-and-forget)
    supabase.auth
      .updateUser({ data: { lang: next } })
      .catch(() => {});
  }, []);

  const t = useCallback(
    (key: string, vars?: Vars): string => {
      const parts = key.split(".");
      let value = resolve(translations[lang], parts);
      if (typeof value !== "string") {
        // Fallback to English
        value = resolve(translations.en, parts);
      }
      if (typeof value !== "string") return key;
      return interpolate(value, vars);
    },
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
