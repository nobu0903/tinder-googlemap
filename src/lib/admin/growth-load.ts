// Server-only. The service-role client must not be imported from a client component.
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  buildGrowthReport,
  FEEDBACK_PREVIEW_LIMIT,
  type FeedbackPreview,
  type GrowthReport,
  type SignupStamp,
  type SwipeStamp,
} from "@/lib/admin/growth";

const PAGE_SIZE = 1000;
/** One request stops here and sets `truncated`, instead of scanning without a ceiling. */
const MAX_PAGES = 10;
/** Reuse one read for 10 minutes. A new database read is limited to once per window. */
const REPORT_CACHE_MS = 10 * 60 * 1000;

export class GrowthRefreshLimitedError extends Error {
  readonly retryAfterSec: number;

  constructor(retryAfterSec: number) {
    super("growth refresh limited");
    this.name = "GrowthRefreshLimitedError";
    this.retryAfterSec = retryAfterSec;
  }
}

let cachedReport: { at: number; report: GrowthReport } | null = null;
let inflight: Promise<GrowthReport> | null = null;

function sinceUtcNaive(now: Date): string {
  const start = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);
  return start.toISOString().replace(/\.\d{3}Z$/, "").replace("Z", "");
}

async function loadSignups(): Promise<{ rows: SignupStamp[]; truncated: boolean }> {
  const rows: SignupStamp[] = [];
  let truncated = false;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (error) throw new Error("Could not load registered users");
    for (const user of data.users) {
      if (user.created_at) rows.push({ createdAt: user.created_at });
    }
    const more = data.users.length === PAGE_SIZE && data.nextPage != null;
    if (!more) return { rows, truncated };
    if (page === MAX_PAGES) truncated = true;
  }

  return { rows, truncated };
}

async function loadSwipes(since: string): Promise<{ rows: SwipeStamp[]; truncated: boolean }> {
  const rows: SwipeStamp[] = [];
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabaseAdmin
      .from("swipes")
      .select("user_id, action, created_at")
      .gte("created_at", since)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error("Could not load swipes");
    const batch = data ?? [];
    for (const row of batch) {
      if (!row.user_id || !row.created_at || !row.action) continue;
      rows.push({
        userId: row.user_id,
        action: row.action,
        createdAt: row.created_at,
      });
    }
    if (batch.length < PAGE_SIZE) return { rows, truncated };
    if (page === MAX_PAGES - 1) truncated = true;
  }

  return { rows, truncated };
}

async function loadFeedbackTimes(sinceIso: string): Promise<string[]> {
  const times: string[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await supabaseAdmin
      .from("feedback")
      .select("created_at")
      .gte("created_at", sinceIso)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error("Could not load feedback");
    const batch = data ?? [];
    for (const row of batch) {
      if (row.created_at) times.push(row.created_at);
    }
    if (batch.length < PAGE_SIZE) return times;
  }

  return times;
}

async function loadRecentFeedback(): Promise<FeedbackPreview[]> {
  const { data, error } = await supabaseAdmin
    .from("feedback")
    .select("id, area, kind, message, extra, created_at")
    .order("created_at", { ascending: false })
    .limit(FEEDBACK_PREVIEW_LIMIT);
  if (error) throw new Error("Could not load recent feedback");

  return (data ?? []).map((row) => ({
    id: String(row.id),
    area: row.area,
    kind: row.kind,
    message: row.message,
    extra: row.extra,
    createdAt: row.created_at,
  }));
}

export async function loadGrowthReport(
  now = new Date(),
  beforeRefresh?: () => Promise<void>,
): Promise<GrowthReport> {
  const fresh =
    cachedReport !== null && now.getTime() - cachedReport.at < REPORT_CACHE_MS;
  if (fresh && cachedReport) return cachedReport.report;
  if (inflight) return inflight;

  inflight = (async () => {
    await beforeRefresh?.();
    const report = await readGrowthReport(now);
    cachedReport = { at: Date.now(), report };
    return report;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function readGrowthReport(now: Date): Promise<GrowthReport> {
  const sinceNaive = sinceUtcNaive(now);
  const sinceIso = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const [signups, swipes, feedbackTimes, recentFeedback] = await Promise.all([
    loadSignups(),
    loadSwipes(sinceNaive),
    loadFeedbackTimes(sinceIso),
    loadRecentFeedback(),
  ]);

  return buildGrowthReport({
    now,
    signups: signups.rows,
    swipes: swipes.rows,
    feedback: feedbackTimes.map((createdAt) => ({ createdAt })),
    recentFeedback,
    truncated: signups.truncated || swipes.truncated,
  });
}
