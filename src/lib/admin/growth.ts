/** Admin growth counts. Days are Asia/Tokyo calendar dates. */

export const GROWTH_WINDOW_DAYS = 30;
export const GROWTH_WEEK_DAYS = 7;
export const FEEDBACK_PREVIEW_LIMIT = 20;
const TOKYO = "Asia/Tokyo";

export interface LikeRatio {
  likes: number;
  swipes: number;
  /** likes / swipes. Null when that window has no swipes. */
  ratio: number | null;
}

export interface GrowthDay {
  /** YYYY-MM-DD in Asia/Tokyo */
  date: string;
  signups: number;
  swipers: number;
  swipes: number;
  likes: number;
}

export interface FeedbackPreview {
  id: string;
  area: string;
  kind: string;
  message: string;
  extra: string | null;
  createdAt: string;
}

export interface GrowthReport {
  timezone: "Asia/Tokyo";
  today: string;
  signups: { today: number; days7: number; days30: number; total: number };
  swipers: { today: number; days7: number; days30: number };
  likes: { today: LikeRatio; days7: LikeRatio; days30: LikeRatio };
  /** Oldest day first, including today. Empty days stay in the list. */
  days: GrowthDay[];
  feedback: {
    today: number;
    days7: number;
    days30: number;
    recent: FeedbackPreview[];
  };
  /** True when a query stopped at its safety cap, so a count may be short. */
  truncated: boolean;
}

export interface SignupStamp {
  createdAt: string;
}

export interface SwipeStamp {
  userId: string;
  action: string;
  createdAt: string;
}

export interface FeedbackStamp {
  createdAt: string;
}

export function tokyoDateKey(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Calendar shift of a YYYY-MM-DD key. The key is a date, not a moment. */
export function addDateDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Parse a DB timestamp. Values without a zone are UTC.
 * `swipes.created_at` is `timestamp without time zone`; Supabase stores UTC.
 */
export function parseStoredInstant(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const normalized = hasZone ? trimmed : `${trimmed.replace(" ", "T")}Z`;
  const instant = new Date(normalized);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function ratio(likes: number, swipes: number): LikeRatio {
  return {
    likes,
    swipes,
    ratio: swipes === 0 ? null : likes / swipes,
  };
}

function inWindow(date: string, start: string, today: string): boolean {
  return date >= start && date <= today;
}

export function buildGrowthReport(input: {
  signups: SignupStamp[];
  swipes: SwipeStamp[];
  feedback: FeedbackStamp[];
  recentFeedback: FeedbackPreview[];
  now?: Date;
  truncated?: boolean;
}): GrowthReport {
  const now = input.now ?? new Date();
  const today = tokyoDateKey(now);
  const start30 = addDateDays(today, -(GROWTH_WINDOW_DAYS - 1));
  const start7 = addDateDays(today, -(GROWTH_WEEK_DAYS - 1));
  const dayKeys = Array.from({ length: GROWTH_WINDOW_DAYS }, (_, index) =>
    addDateDays(start30, index),
  );

  const days = new Map<string, GrowthDay>(
    dayKeys.map((date) => [date, { date, signups: 0, swipers: 0, swipes: 0, likes: 0 }]),
  );
  const swipersByDay = new Map<string, Set<string>>(
    dayKeys.map((date) => [date, new Set()]),
  );
  const swipers7 = new Set<string>();
  const swipers30 = new Set<string>();

  let signupsToday = 0;
  let signups7 = 0;
  let signups30 = 0;
  let signupsTotal = 0;

  for (const signup of input.signups) {
    const instant = parseStoredInstant(signup.createdAt);
    if (!instant) continue;
    signupsTotal += 1;
    const date = tokyoDateKey(instant);
    if (!inWindow(date, start30, today)) continue;
    signups30 += 1;
    if (inWindow(date, start7, today)) signups7 += 1;
    if (date === today) signupsToday += 1;
    const bucket = days.get(date);
    if (bucket) bucket.signups += 1;
  }

  let likesToday = 0;
  let swipesToday = 0;
  let likes7 = 0;
  let swipes7 = 0;
  let likes30 = 0;
  let swipes30 = 0;

  for (const swipe of input.swipes) {
    const instant = parseStoredInstant(swipe.createdAt);
    if (!instant || !swipe.userId) continue;
    const date = tokyoDateKey(instant);
    if (!inWindow(date, start30, today)) continue;
    const liked = swipe.action === "like";
    swipes30 += 1;
    if (liked) likes30 += 1;
    swipers30.add(swipe.userId);
    if (inWindow(date, start7, today)) {
      swipes7 += 1;
      if (liked) likes7 += 1;
      swipers7.add(swipe.userId);
    }
    if (date === today) {
      swipesToday += 1;
      if (liked) likesToday += 1;
    }
    const bucket = days.get(date);
    const people = swipersByDay.get(date);
    if (bucket && people) {
      bucket.swipes += 1;
      if (liked) bucket.likes += 1;
      people.add(swipe.userId);
    }
  }

  for (const [date, people] of swipersByDay) {
    const bucket = days.get(date);
    if (bucket) bucket.swipers = people.size;
  }

  let feedbackToday = 0;
  let feedback7 = 0;
  let feedback30 = 0;
  for (const row of input.feedback) {
    const instant = parseStoredInstant(row.createdAt);
    if (!instant) continue;
    const date = tokyoDateKey(instant);
    if (!inWindow(date, start30, today)) continue;
    feedback30 += 1;
    if (inWindow(date, start7, today)) feedback7 += 1;
    if (date === today) feedbackToday += 1;
  }

  return {
    timezone: "Asia/Tokyo",
    today,
    signups: {
      today: signupsToday,
      days7: signups7,
      days30: signups30,
      total: signupsTotal,
    },
    swipers: {
      today: swipersByDay.get(today)?.size ?? 0,
      days7: swipers7.size,
      days30: swipers30.size,
    },
    likes: {
      today: ratio(likesToday, swipesToday),
      days7: ratio(likes7, swipes7),
      days30: ratio(likes30, swipes30),
    },
    days: dayKeys.map((date) => days.get(date) ?? { date, signups: 0, swipers: 0, swipes: 0, likes: 0 }),
    feedback: {
      today: feedbackToday,
      days7: feedback7,
      days30: feedback30,
      recent: input.recentFeedback.slice(0, FEEDBACK_PREVIEW_LIMIT),
    },
    truncated: input.truncated === true,
  };
}

export function formatLikePercent(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${Math.round(ratio * 100)}%`;
}
