import type { Metadata } from "next";
import { MobileShell } from "@/components/layout/mobile-shell";
import { FeedbackForm } from "@/components/feedback/feedback-form";
import { FeedbackPageCopy } from "@/components/feedback/feedback-page-copy";

export const metadata: Metadata = {
  title: "フィードバック — メシどこ",
  description: "メシどこの改善のためのフィードバックを送れます。",
};

export default function FeedbackPage() {
  return (
    <MobileShell>
      <div className="flex min-h-dvh flex-col px-6 pb-12 pt-10">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-bold tracking-[0.18em] text-electric-chilli">
            FEEDBACK
          </p>
          <FeedbackPageCopy />
        </div>
        <FeedbackForm />
      </div>
    </MobileShell>
  );
}
