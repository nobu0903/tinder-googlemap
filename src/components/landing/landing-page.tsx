"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Lock, MapPin, Navigation, Smartphone } from "lucide-react";
import { LP_ICONS, LP_PHOTOS, LP_SCREENS } from "@/lib/landing/assets";
import { cn } from "@/lib/utils";

const ACCENT = "#DC7A2E";

const NAV = [
  { href: "#features", label: "特徴" },
  { href: "#how", label: "使い方" },
  { href: "#pricing", label: "料金" },
  { href: "#faq", label: "FAQ" },
] as const;

const FAQ_ITEMS = [
  {
    q: "無料でどこまで使えますか？",
    a: "無料プランでは1日あたり10スワイプまで使えます。翌日0時に回数がリセットされます。",
  },
  {
    q: "アカウントは必要ですか？",
    a: "通常のスワイプはアカウントなしでも始められます。テーマ探索やコレクションの保存にはサインインが必要です。",
  },
  {
    q: "どの地域で使えますか？",
    a: "日本全国のエリアに対応しています。GPSの現在地、または都道府県・市区町村から探せます。",
  },
  {
    q: "位置情報はなぜ必要ですか？",
    a: "いま居る場所の近くのお店を表示するために使います。手動でエリアを選ぶこともできます。",
  },
  {
    q: "広告は出ますか？",
    a: "無料プランのフィード内にスポンサー枠が表示されることがあります。",
  },
  {
    q: "Proはいつ公開されますか？",
    a: "現在準備中です。公開準備が整い次第お知らせします。",
  },
] as const;

export function LandingPage() {
  return (
    <>
      <LpHeader />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <LpFooter />
    </>
  );
}

function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SectionHeading({
  title,
  lead,
}: {
  title: string;
  lead?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="lp-display text-3xl font-bold tracking-wide text-white sm:text-4xl">
        {title}
      </h2>
      {lead ? (
        <p className="mt-4 text-sm leading-relaxed text-white/50 sm:text-[15px]">
          {lead}
        </p>
      ) : null}
    </div>
  );
}

function PhoneFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] border border-white/12 bg-black shadow-[0_32px_64px_rgba(0,0,0,0.55)] ring-1 ring-white/5",
        className,
      )}
    >
      <div className="absolute left-1/2 top-2.5 z-10 h-1 w-12 -translate-x-1/2 rounded-full bg-white/15" />
      {children}
    </div>
  );
}

function LpHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/lp" className="flex items-center gap-2.5">
          <Image
            src={LP_ICONS.logo}
            alt=""
            width={36}
            height={36}
            className="size-9 rounded-[10px] bg-white object-contain p-0.5"
          />
          <span className="lp-display text-[15px] font-bold tracking-[0.04em]" style={{ color: ACCENT }}>
            メシどこ
          </span>
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[13px] text-white/55 transition-colors hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hidden h-10 items-center rounded-full px-5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 sm:inline-flex"
            style={{ backgroundColor: ACCENT }}
          >
            今すぐ試す
          </Link>
          <button
            type="button"
            className="flex size-10 items-center justify-center rounded-xl border border-white/10 text-white md:hidden"
            aria-label="メニュー"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="text-lg leading-none">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/[0.06] px-5 py-5 md:hidden">
          <div className="flex flex-col gap-4">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-white/70"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/"
              className="mt-1 flex h-11 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: ACCENT }}
              onClick={() => setOpen(false)}
            >
              今すぐ試す
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden px-5 pb-28 pt-16 sm:px-8 sm:pt-20 lg:pb-36 lg:pt-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,_rgba(220,122,46,0.18),_transparent_60%)]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div className="lp-fade-in">
          <p
            className="lp-display text-5xl font-black tracking-[0.04em] sm:text-6xl lg:text-[4.5rem]"
            style={{ color: ACCENT }}
          >
            メシどこ
          </p>
          <h1 className="lp-display mt-5 text-[1.65rem] font-bold leading-[1.35] text-white sm:text-3xl lg:text-[2.15rem]">
            スワイプで次のご飯を決める
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/55">
            いま居る場所の近くから、気分に合うお店をサクッと見つけよう。
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-12 items-center gap-2 rounded-full px-8 text-sm font-bold text-white shadow-[0_10px_32px_rgba(220,122,46,0.35)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{ backgroundColor: ACCENT }}
            >
              今すぐ試す
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/explore"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-7 text-sm font-medium text-white/75 transition-colors hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
            >
              テーマを見る
            </Link>
          </div>

          <p className="mt-6 text-[12px] tracking-wide text-white/35">
            アカウント不要ですぐ試せます
          </p>
        </div>

        <div className="lp-fade-in-delay relative mx-auto w-full max-w-[300px] sm:max-w-[320px]">
          <div
            aria-hidden
            className="absolute -inset-8 rounded-full opacity-40 blur-3xl"
            style={{ backgroundColor: ACCENT }}
          />
          <div className="lp-float relative">
            <PhoneFrame className="aspect-[9/19] w-full">
              <Image
                src={LP_SCREENS.swipe}
                alt="メシどこのスワイプ画面"
                fill
                priority
                className="object-cover object-top"
                sizes="320px"
              />
            </PhoneFrame>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: LP_ICONS.iconPin,
      title: "近くをスワイプ",
      desc: "GPSやエリア選択で、いまの場所の近くからお店を探せます。",
      photo: LP_PHOTOS.street,
      alt: "夜の飲食店",
    },
    {
      icon: LP_ICONS.iconSmile,
      title: "気分で探す",
      desc: "デート・1,000円以下・穴場など、テーマからサクッと絞り込めます。",
      photo: LP_PHOTOS.pasta,
      alt: "料理のイメージ",
    },
    {
      icon: LP_ICONS.iconHeart,
      title: "いいねを残す",
      desc: "気になった店はコレクションに保存。あとから見返せます。",
      photo: LP_PHOTOS.interior,
      alt: "レストランの店内",
    },
  ] as const;

  return (
    <section id="features" className="scroll-mt-24 px-5 py-28 sm:px-8">
      <Reveal>
        <SectionHeading
          title="何ができるか"
          lead="探す・決める・残す。メシどこの基本はこれだけ。"
        />
      </Reveal>

      <div className="mx-auto mt-16 grid max-w-6xl gap-8 md:grid-cols-3">
        {features.map((f, i) => (
          <Reveal key={f.title}>
            <article
              className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-white/[0.02] transition-colors hover:border-white/12 hover:bg-white/[0.035]"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <div className="relative aspect-[5/3] overflow-hidden">
                <Image
                  src={f.photo}
                  alt={f.alt}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent opacity-80" />
              </div>
              <div className="flex flex-1 flex-col px-6 pb-7 pt-5">
                <div className="mb-3 flex items-center gap-2.5">
                  <Image
                    src={f.icon}
                    alt=""
                    width={28}
                    height={28}
                    className="size-7 object-contain"
                  />
                  <h3 className="lp-display text-lg font-bold text-white">
                    {f.title}
                  </h3>
                </div>
                <p className="text-[13px] leading-relaxed text-white/50">
                  {f.desc}
                </p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function LocationStepPreview() {
  const areas = ["東京都", "大阪府", "福岡県", "北海道"] as const;

  return (
    <div className="flex h-full flex-col bg-[#141312] px-3.5 pb-4 pt-8">
      <div className="mb-4 flex flex-col items-center gap-2">
        <div
          className="flex size-11 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--lp-accent-soft)" }}
        >
          <MapPin className="size-5" style={{ color: ACCENT }} strokeWidth={2} />
        </div>
        <p className="text-[11px] font-semibold text-white/90">エリアを選ぶ</p>
      </div>

      <div
        className="mb-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-[11px] font-bold text-white"
        style={{ backgroundColor: ACCENT }}
      >
        <Navigation className="size-3.5" strokeWidth={2.5} />
        現在地を使う
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        {areas.map((area, i) => (
          <div
            key={area}
            className={cn(
              "flex h-8 items-center rounded-lg px-3 text-[10px] font-medium",
              i === 0 ? "bg-white/10 text-white" : "bg-white/[0.04] text-white/50",
            )}
            style={
              i === 0
                ? { border: `1px solid ${ACCENT}` }
                : { border: "1px solid transparent" }
            }
          >
            {area}
          </div>
        ))}
      </div>
    </div>
  );
}

function HowSection() {
  const steps = [
    {
      n: "01",
      title: "場所を決める",
      desc: "現在地、または都道府県・市区町村を選ぶ",
      content: <LocationStepPreview />,
    },
    {
      n: "02",
      title: "スワイプする",
      desc: "気になる店はハート、違う店はスキップ",
      content: (
        <Image
          src={LP_SCREENS.swipe}
          alt="スワイプ画面"
          fill
          className="object-cover object-top"
          sizes="220px"
        />
      ),
    },
    {
      n: "03",
      title: "行きたい店を保存する",
      desc: "いいねした店はコレクションに残る",
      content: (
        <Image
          src={LP_SCREENS.collection}
          alt="コレクション画面"
          fill
          className="object-cover object-top"
          sizes="220px"
        />
      ),
    },
  ] as const;

  return (
    <section
      id="how"
      className="scroll-mt-24 border-y border-white/[0.04] bg-[#0e0e0e] px-5 py-28 sm:px-8"
    >
      <Reveal>
        <SectionHeading
          title="使い方はカンタン 3ステップ"
          lead="場所を選んで、スワイプして、気になる店を残す。"
        />
      </Reveal>

      <div className="mx-auto mt-16 grid max-w-5xl gap-12 md:grid-cols-3 md:gap-8">
        {steps.map((step, i) => (
          <Reveal key={step.n}>
            <div className="flex flex-col items-center text-center">
              <div className="flex items-baseline gap-2">
                <span
                  className="lp-display text-2xl font-black tabular-nums"
                  style={{ color: ACCENT }}
                >
                  {step.n}
                </span>
                {i < steps.length - 1 ? (
                  <span
                    className="hidden text-lg text-white/20 md:inline"
                    aria-hidden
                  >
                    —
                  </span>
                ) : null}
              </div>
              <h3 className="lp-display mt-3 text-base font-bold text-white">
                {step.title}
              </h3>
              <p className="mt-2 max-w-[220px] text-[12px] leading-relaxed text-white/45">
                {step.desc}
              </p>
              <PhoneFrame className="relative mt-8 aspect-[9/19] w-[68%] max-w-[200px]">
                {step.content}
              </PhoneFrame>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="scroll-mt-24 px-5 py-28 sm:px-8">
      <Reveal>
        <SectionHeading
          title="無料で始められる"
          lead="まずは無料プランで。もっと使いたくなったら Pro へ。"
        />
      </Reveal>

      <div className="mx-auto mt-16 grid max-w-3xl gap-5 sm:grid-cols-2">
        <Reveal>
          <div className="flex h-full flex-col rounded-[1.75rem] border border-white/[0.08] bg-white/[0.025] p-8">
            <span
              className="inline-flex w-fit rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-white"
              style={{ backgroundColor: ACCENT }}
            >
              FREE
            </span>
            <h3 className="lp-display mt-5 text-xl font-bold">無料プラン</h3>
            <p className="mt-2 text-sm text-white/50">1日10スワイプまで</p>
            <div className="mt-10 flex flex-1 items-center justify-center py-4">
              <div
                className="relative flex size-24 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--lp-accent-soft)" }}
              >
                <Smartphone
                  className="size-11"
                  style={{ color: ACCENT }}
                  strokeWidth={1.4}
                  aria-hidden
                />
                <span
                  className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full text-sm font-black text-white"
                  style={{ backgroundColor: ACCENT }}
                >
                  10
                </span>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div
            className="flex h-full flex-col rounded-[1.75rem] border bg-white/[0.025] p-8"
            style={{ borderColor: `${ACCENT}88` }}
          >
            <span
              className="inline-flex w-fit rounded-full border px-3 py-1 text-[10px] font-bold tracking-[0.14em]"
              style={{ borderColor: ACCENT, color: ACCENT }}
            >
              COMING SOON
            </span>
            <h3 className="lp-display mt-5 text-xl font-bold">
              Pro{" "}
              <span className="text-sm font-semibold" style={{ color: ACCENT }}>
                （準備中）
              </span>
            </h3>
            <p className="mt-2 text-sm text-white/50">
              スワイプ無制限でもっと自由に探せる
            </p>
            <div className="mt-10 flex flex-1 items-center justify-center py-4">
              <div
                className="flex size-24 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--lp-accent-soft)" }}
              >
                <Lock
                  className="size-11"
                  style={{ color: ACCENT }}
                  strokeWidth={1.4}
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      <p className="mt-8 text-center text-[11px] text-white/30">
        ※ スワイプ回数は毎日0時にリセットされます。
      </p>
    </section>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-white/[0.04] bg-[#0e0e0e] px-5 py-28 sm:px-8"
    >
      <Reveal>
        <SectionHeading title="よくある質問" lead="気になる点をまとめました。" />
      </Reveal>

      <div className="mx-auto mt-14 max-w-2xl space-y-2">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <Reveal key={item.q}>
              <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-5 py-4 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="flex-1 text-[14px] font-semibold text-white/90">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-white/35 transition-transform duration-300",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="border-t border-white/[0.05] px-5 pb-4 pt-3 text-[13px] leading-relaxed text-white/45">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden px-5 py-32 sm:px-8">
      <Image
        src={LP_PHOTOS.cafe}
        alt=""
        fill
        className="object-cover opacity-25"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/80 to-[#0a0a0a]" />

      <Reveal>
        <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <p className="lp-display text-2xl font-bold leading-snug tracking-wide text-white sm:text-3xl">
            スワイプで、最高の一皿に出会おう。
          </p>
          <Link
            href="/"
            className="mt-10 inline-flex h-12 items-center gap-2 rounded-full px-10 text-sm font-bold text-white shadow-[0_10px_32px_rgba(220,122,46,0.35)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundColor: ACCENT }}
          >
            今すぐ試す
            <span aria-hidden>→</span>
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function LpFooter() {
  return (
    <footer className="border-t border-white/[0.05] px-5 py-12 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Image
            src={LP_ICONS.logo}
            alt=""
            width={28}
            height={28}
            className="size-7 rounded-lg bg-white object-contain p-0.5"
          />
          <span className="lp-display text-sm font-bold" style={{ color: ACCENT }}>
            メシどこ
          </span>
        </div>

        <ul className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[11px] text-white/28">
          <li>
            <span className="cursor-default" title="準備中">
              プライバシーポリシー
            </span>
          </li>
          <li>
            <span className="cursor-default" title="準備中">
              利用規約
            </span>
          </li>
          <li>
            <span className="cursor-default" title="準備中">
              お問い合わせ
            </span>
          </li>
        </ul>

        <p className="text-[10px] tracking-wide text-white/22">
          © {new Date().getFullYear()} MESHIDOKO
        </p>
      </div>
    </footer>
  );
}
