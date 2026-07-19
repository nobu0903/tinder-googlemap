import Link from "next/link";

export default function ProPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-midnight px-6 text-center">
      <p className="text-sm font-bold tracking-[0.18em] text-electric-chilli">
        VIBELOOP PRO
      </p>
      <h1 className="mt-4 text-2xl font-black tracking-tight text-text-primary">
        Unlimited swipes
      </h1>
      <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-text-muted">
        Pro unlocks unlimited daily swipes so you can keep exploring without the
        free-tier cap. Checkout is coming soon.
      </p>
      <Link
        href="/"
        className="mt-8 flex h-12 w-full max-w-[240px] items-center justify-center rounded-xl bg-electric-chilli text-sm font-bold text-text-primary shadow-[0_4px_20px_rgba(224,62,0,0.35)] transition-all active:scale-[0.98]"
      >
        Back to Swipe
      </Link>
    </div>
  );
}
