import { Noto_Sans_JP, Zen_Kaku_Gothic_New } from "next/font/google";
import type { Metadata } from "next";

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-lp-body",
  display: "swap",
});

const zenKaku = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["500", "700", "900"],
  variable: "--font-lp-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "メシどこ — スワイプで次のご飯を決める",
  description:
    "いま居る場所の近くから、スワイプでお店を見つけよう。メシどこのランディングページ。",
};

export default function LpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${notoSansJp.variable} ${zenKaku.variable} ${notoSansJp.className} lp-root min-h-dvh bg-[#0a0a0a] text-white antialiased`}
    >
      {children}
    </div>
  );
}
