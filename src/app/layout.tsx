import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GuestSwipeLink } from "@/components/auth/guest-swipe-link";
import { LanguageProvider } from "@/lib/i18n/context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://meshidoko.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "メシどこ — スワイプで次のご飯を決める",
    template: "%s | メシどこ",
  },
  description:
    "いま居る場所の近くから、スワイプでお店を見つけよう。メシどこ公式。",
  applicationName: "メシどこ",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: SITE_URL,
    siteName: "メシどこ",
    title: "メシどこ — スワイプで次のご飯を決める",
    description:
      "いま居る場所の近くから、スワイプでお店を見つけよう。",
    images: [{ url: "/lp/asset_00.png", width: 180, height: 179, alt: "メシどこ" }],
  },
  twitter: {
    card: "summary",
    title: "メシどこ — スワイプで次のご飯を決める",
    description:
      "いま居る場所の近くから、スワイプでお店を見つけよう。",
    images: ["/lp/asset_00.png"],
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/favicon.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7033724399303363"
          crossOrigin="anonymous"
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <LanguageProvider>
          <GuestSwipeLink />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
