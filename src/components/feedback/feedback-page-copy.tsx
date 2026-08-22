"use client";

import { useLang } from "@/lib/i18n/context";

export function FeedbackPageCopy() {
  const { t } = useLang();
  return (
    <>
      <h1 className="mt-2 text-2xl font-black tracking-tight text-text-primary">
        {t("feedback.title")}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">
        {t("feedback.desc")}
      </p>
    </>
  );
}
