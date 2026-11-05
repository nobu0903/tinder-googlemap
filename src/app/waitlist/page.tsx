import type { Metadata } from "next";
import { MobileShell } from "@/components/layout/mobile-shell";
import { WaitlistForm } from "@/components/waitlist/waitlist-form";
import { WaitlistPageCopy } from "@/components/waitlist/waitlist-page-copy";

export const metadata: Metadata = {
  title: "モバイル版ウェイトリスト — メシどこ",
  description:
    "メシどこのモバイルアプリ（iOS / Android）公開時にメールでお知らせします。",
  robots: { index: false, follow: false },
};

export default function WaitlistPage() {
  return (
    <MobileShell>
      <div className="flex min-h-dvh flex-col px-6 pb-10 pt-10">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-bold tracking-[0.18em] text-electric-chilli">
            COMING SOON
          </p>
          <WaitlistPageCopy />
        </div>

        <WaitlistForm />
      </div>
    </MobileShell>
  );
}
