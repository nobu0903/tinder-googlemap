"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AREA_GEM_BANDS,
  type AreaProfile,
  type FeedAlgorithmConfig,
  withoutAreaBandOverrides,
} from "@/lib/feed/config";
import type { FeedEngineResult } from "@/lib/feed/engine";
import {
  formatGoogleMapsCoordinates,
  parseGoogleMapsCoordinates,
} from "@/lib/geo/coordinates";
import { adminFetch, ADMIN_SECRET_KEY } from "@/lib/admin/client";
import { AdminSwipePanel } from "@/components/admin/admin-swipe-panel";

const LOCATION_PRESETS = [
  { label: "渋谷", lat: 35.658034, lng: 139.701636 },
  { label: "新宿", lat: 35.693825, lng: 139.703356 },
  { label: "博多", lat: 33.590355, lng: 130.401716 },
  { label: "梅田", lat: 34.702485, lng: 135.495951 },
] as const;

function poolBadge(pool: string) {
  const colors: Record<string, string> = {
    classic: "bg-amber-900/50 text-amber-300",
    vibe: "bg-emerald-900/50 text-emerald-300",
    none: "bg-neutral-800 text-neutral-400",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${colors[pool] ?? colors.none}`}
    >
      {pool}
    </span>
  );
}

function slotBadge(slot: string) {
  const colors: Record<string, string> = {
    classic: "text-amber-400",
    vibe: "text-emerald-400",
    fill: "text-neutral-500",
  };
  return (
    <span className={`text-[10px] font-mono ${colors[slot] ?? ""}`}>{slot}</span>
  );
}

function areaProfileBadge(profile: AreaProfile) {
  const colors: Record<AreaProfile, string> = {
    tourist: "bg-rose-900/50 text-rose-300 border-rose-800/60",
    urban: "bg-sky-900/50 text-sky-300 border-sky-800/60",
    local: "bg-neutral-800 text-neutral-300 border-neutral-700",
  };
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors[profile]}`}
    >
      {profile}
    </span>
  );
}

export function AdminScreen() {
  const [secret, setSecret] = useState("");
  const [coordinates, setCoordinates] = useState(
    formatGoogleMapsCoordinates(35.658034, 139.701636),
  );
  const [config, setConfig] = useState<FeedAlgorithmConfig | null>(null);
  const [configForm, setConfigForm] = useState<Partial<FeedAlgorithmConfig>>({});
  const [cacheStats, setCacheStats] = useState<{
    totalSpots: number;
    freshSpots: number;
    lastUpdated: string | null;
  } | null>(null);
  const [preview, setPreview] = useState<FeedEngineResult | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [swipeSession, setSwipeSession] = useState<{
    lat: number;
    lng: number;
    coordinatesLabel: string;
    config: Partial<FeedAlgorithmConfig>;
  } | null>(null);

  const loadConfig = useCallback(async () => {
    const data = await adminFetch("/api/admin/config");
    setConfig(data.config);
    setConfigForm(data.config);
  }, []);

  const loadCache = useCallback(async () => {
    const data = await adminFetch("/api/admin/cache");
    setCacheStats(data);
  }, []);

  const init = useCallback(async () => {
    try {
      await Promise.all([loadConfig(), loadCache()]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    }
  }, [loadConfig, loadCache]);

  useEffect(() => {
    const saved = sessionStorage.getItem(ADMIN_SECRET_KEY);
    if (saved) setSecret(saved);
  }, []);

  useEffect(() => {
    if (secret || process.env.NODE_ENV === "development") {
      init();
    }
  }, [secret, init]);

  const saveSecret = () => {
    sessionStorage.setItem(ADMIN_SECRET_KEY, secret);
    setStatus("Secret saved.");
    init();
  };

  const resolveCoordinates = (): { lat: number; lng: number } => {
    const parsed = parseGoogleMapsCoordinates(coordinates);
    if (!parsed) {
      throw new Error(
        'Invalid coordinates. Use Google Maps format, e.g. 35°39\'28.9"N 139°42\'05.9"E',
      );
    }
    return parsed;
  };

  const runAnalyze = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const { lat, lng } = resolveCoordinates();
      const data = await adminFetch("/api/admin/feed-analyze", {
        method: "POST",
        body: JSON.stringify({
          lat,
          lng,
          // Bands are auto from area status; only slots / vibeMin etc. apply.
          config: withoutAreaBandOverrides(configForm),
        }),
      });
      setPreview(data);
      const cache = data.meta.cacheInRadius;
      const density = data.meta.areaDensity;
      setStatus(
        `DB 分析: area=${data.meta.areaProfile}` +
          (density
            ? ` (≥1000:${density.countGte1000} / ≥2000:${density.countGte2000} @ ${density.probedRadiusM / 1000}km)`
            : "") +
          ` · ${data.meta.mix.vibeInFeed} vibe / ${data.meta.mix.classicInFeed} classic · キャッシュ ${cache?.fresh ?? 0} fresh / ${cache?.total ?? 0} total · API 0回`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analyze failed");
    } finally {
      setLoading(false);
    }
  };

  const runIngest = async (mode: "light" | "deep") => {
    const label = mode === "light" ? "軽量 ingest（約1 API）" : "深掘り ingest（約8–13 API）";
    if (!confirm(`${label} を実行します。続行しますか？`)) return;

    setLoading(true);
    setError(null);
    try {
      const { lat, lng } = resolveCoordinates();
      const data = await adminFetch("/api/admin/cache", {
        method: "POST",
        body: JSON.stringify({ lat, lng, radiusKm: 5, mode }),
      });
      setStatus(
        `Ingested ${data.ingested} spots (${data.spotsInRadius} in 5km). API: nearby ${data.apiCalls?.nearbySearch ?? 0}, text ${data.apiCalls?.textSearch ?? 0}, details ${data.apiCalls?.placeDetails ?? 0}.`,
      );
      await loadCache();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingest failed");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch("/api/admin/config", {
        method: "POST",
        body: JSON.stringify(configForm),
      });
      setConfig(data.config);
      setConfigForm(data.config);
      setStatus("Algorithm config saved (affects live /api/swipe).");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const resetConfig = async () => {
    const data = await adminFetch("/api/admin/config", {
      method: "POST",
      body: JSON.stringify({ reset: true }),
    });
    setConfig(data.config);
    setConfigForm(data.config);
    setStatus("Config reset to defaults.");
  };

  const startSwipe = () => {
    setError(null);
    try {
      const { lat, lng } = resolveCoordinates();
      setSwipeSession({
        lat,
        lng,
        coordinatesLabel: coordinates,
        config: withoutAreaBandOverrides(configForm),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid coordinates");
    }
  };

  const clearCache = async () => {
    if (!confirm("全店舗キャッシュを削除します。全ユーザーのデータが消えます。続行しますか？")) return;
    if (!confirm("本当に削除しますか？この操作は取り消せません。")) return;
    setLoading(true);
    setError(null);
    try {
      await adminFetch("/api/admin/cache", { method: "DELETE" });
      setPreview(null);
      setStatus("Cache cleared.");
      await loadCache();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-neutral-200">
      <header className="border-b border-neutral-800 px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <h1 className="text-sm font-semibold tracking-widest text-neutral-400">
              VIBELOOP ADMIN
            </h1>
            <p className="mt-0.5 text-xs text-neutral-600">設定検証 &amp; スワイププレビュー</p>
          </div>
          <Link
            href="/"
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            ← Back to app
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8">
        {/* Auth */}
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Access
          </h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              Admin secret (ADMIN_SECRET env)
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="w-48 rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 font-mono text-sm text-neutral-200"
                placeholder="dev: leave empty"
              />
            </label>
            <button
              type="button"
              onClick={saveSecret}
              className="rounded bg-neutral-800 px-3 py-1.5 text-xs hover:bg-neutral-700"
            >
              Save
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {/* Settings info */}
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 text-xs text-neutral-400">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            どの設定が効いているか
          </h2>
          <ul className="list-inside list-disc space-y-1 leading-relaxed">
            <li>
              <strong className="text-neutral-300">エリア帯</strong>
              ：DB 分析・スワイプともキャッシュ密度で local / urban / tourist
              を自動判定し、レビュー帯を切り替える
            </li>
            <li>
              <strong className="text-neutral-300">メイン</strong>
              ：「この設定でスワイプ」＝本番同等（キャッシュ優先・軽量 API）
            </li>
            <li>
              <strong className="text-neutral-300">DB 分析</strong>
              ：Google API 0回。自動帯＋キャッシュ済みデータのミックス確認
            </li>
            <li>
              <strong className="text-neutral-300">データ投入</strong>
              ：新エリアのみ（高度な操作）。軽量≈1 API / 深掘り≈8–13 API
            </li>
            <li>
              <strong className="text-neutral-300">本番スワイプ (/api/swipe)</strong>
              ：Save config のスロット比など ＋ リクエスト時の自動帯
            </li>
          </ul>
          {config && (
            <p className="mt-3 font-mono text-[10px] text-neutral-600">
              本番に保存済み: vibeMin {config.vibeMinReviews} · 比率{" "}
              {config.classicSlotsPerCycle}:{config.vibeSlotsPerCycle} ·
              （Classic/Vibe 上限はエリア自動）
            </p>
          )}
        </section>

        {status && (
          <div className="rounded border border-emerald-900/40 bg-emerald-950/30 px-4 py-2 text-xs text-emerald-400">
            {status}
          </div>
        )}

        {/* Location */}
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Location
          </h2>
          <div className="flex flex-wrap gap-2">
            {LOCATION_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setCoordinates(formatGoogleMapsCoordinates(p.lat, p.lng));
                }}
                className="rounded border border-neutral-700 px-2.5 py-1 text-xs hover:border-neutral-500"
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="mt-3 flex flex-col gap-1 text-xs text-neutral-500">
            Coordinates (Google Maps format)
            <input
              value={coordinates}
              onChange={(e) => setCoordinates(e.target.value)}
              placeholder={'35°39\'28.9"N 139°42\'05.9"E'}
              className="w-full max-w-xl rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 font-mono text-sm text-neutral-200"
            />
          </label>
          <p className="mt-1.5 text-[10px] text-neutral-600">
            Paste from Google Maps, e.g. 47°29&apos;40.3&quot;N 19°04&apos;33.6&quot;E
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={startSwipe}
              className="rounded bg-electric-chilli px-4 py-2 text-xs font-semibold text-white hover:bg-chilli-deep disabled:opacity-50"
            >
              この設定でスワイプ
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={runAnalyze}
              className="rounded border border-emerald-800 bg-emerald-950/40 px-4 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-900/40 disabled:opacity-50"
            >
              {loading ? "Running…" : "DB 分析（API 0回）"}
            </button>
          </div>
        </section>

        {/* Summary */}
        {preview && (
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Feed analysis
            </h2>
            {preview.meta.pools.vibeAfterFilter === 0 && (
              <p className="mb-3 rounded border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
                Vibe 候補が 0 件です。DB にレビュー{" "}
                {preview.meta.config.vibeMinReviews}–
                {preview.meta.config.vibeMaxReviews} の店がありません。
                高度な操作から「軽量 ingest」または「深掘り ingest」を試してください。
              </p>
            )}
            {preview.meta.cacheInRadius && (
              <p className="mb-3 font-mono text-[10px] text-neutral-500">
                エリア内キャッシュ: {preview.meta.cacheInRadius.fresh} fresh /{" "}
                {preview.meta.cacheInRadius.total} total · Vibe{" "}
                {preview.meta.cacheInRadius.vibe} 件
              </p>
            )}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                Area status
              </span>
              {areaProfileBadge(preview.meta.areaProfile)}
              {preview.meta.areaDensity && (
                <span className="font-mono text-[10px] text-neutral-500">
                  ≥1000: {preview.meta.areaDensity.countGte1000} · ≥2000:{" "}
                  {preview.meta.areaDensity.countGte2000} · probed{" "}
                  {preview.meta.areaDensity.probedRadiusM / 1000} km
                </span>
              )}
            </div>
            <p className="mb-3 font-mono text-[10px] text-neutral-600">
              自動帯 ({preview.meta.areaProfile}): Classic{" "}
              {preview.meta.config.classicMinReviews}–
              {preview.meta.config.classicMaxReviews} · Vibe{" "}
              {preview.meta.config.vibeMinReviews}–
              {preview.meta.config.vibeMaxReviews} · スロット比率{" "}
              {preview.meta.config.classicSlotsPerCycle}:
              {preview.meta.config.vibeSlotsPerCycle}
            </p>
            <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Area profile"
                value={preview.meta.areaProfile}
              />
              <Stat label="Radius" value={`${preview.meta.radiusKm} km`} />
              <Stat
                label="Eligible in radius"
                value={String(preview.meta.eligibleAtRadius)}
              />
              <Stat
                label="Mix (classic / vibe / fill)"
                value={`${preview.meta.mix.classicInFeed} / ${preview.meta.mix.vibeInFeed} / ${preview.meta.mix.fillInFeed}`}
              />
              <Stat
                label="Total time"
                value={`${preview.meta.timingMs.total}ms`}
              />
              <Stat
                label="Classic pool"
                value={`${preview.meta.pools.classicAfterFilter} (raw ${preview.meta.pools.classicCandidates})`}
              />
              <Stat
                label="Vibe pool"
                value={`${preview.meta.pools.vibeAfterFilter} (raw ${preview.meta.pools.vibeCandidates})`}
              />
              <Stat
                label="Excluded (chain / hotel)"
                value={`${preview.meta.excluded.chain} / ${preview.meta.excluded.hotelName}`}
              />
              <Stat
                label="API timing"
                value={`ingest ${preview.meta.timingMs.ingest}ms · hydrate ${preview.meta.timingMs.hydrate}ms`}
              />
              <Stat
                label="Google API calls"
                value={
                  preview.meta.ingestProfile === "analyze"
                    ? "0（DB のみ）"
                    : `nearby ${preview.meta.apiCalls.nearbySearch} · text ${preview.meta.apiCalls.textSearch} · details ${preview.meta.apiCalls.placeDetails}`
                }
              />
              <Stat
                label="Ingest profile"
                value={preview.meta.ingestProfile}
              />
            </div>
          </section>
        )}

        {/* Feed table */}
        {preview && (
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Feed preview ({preview.debugSpots.length} spots)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-500">
                    <th className="py-2 pr-3 font-medium">#</th>
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Pool</th>
                    <th className="py-2 pr-3 font-medium">Slot</th>
                    <th className="py-2 pr-3 font-medium">Reviews</th>
                    <th className="py-2 pr-3 font-medium">Rating</th>
                    <th className="py-2 font-medium">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.debugSpots.map((row, i) => (
                    <tr
                      key={row.spotId}
                      className="border-b border-neutral-800/60 hover:bg-neutral-800/30"
                    >
                      <td className="py-2 pr-3 font-mono text-neutral-600">{i + 1}</td>
                      <td className="py-2 pr-3 max-w-[200px] truncate">{row.name}</td>
                      <td className="py-2 pr-3">{poolBadge(row.pool)}</td>
                      <td className="py-2 pr-3">{slotBadge(row.slotSource)}</td>
                      <td className="py-2 pr-3 font-mono">{row.reviewCount ?? "—"}</td>
                      <td className="py-2 pr-3 font-mono">{row.rating ?? "—"}</td>
                      <td className="py-2 font-mono text-neutral-500">
                        {row.primaryType ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Excluded samples */}
        {preview && preview.excludedSamples.length > 0 && (
          <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Excluded samples
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-500">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Reviews</th>
                    <th className="py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.excludedSamples.map((row, i) => (
                    <tr key={i} className="border-b border-neutral-800/60">
                      <td className="py-2 pr-3 max-w-[180px] truncate">{row.name}</td>
                      <td className="py-2 pr-3 font-mono">{row.reviewCount ?? "—"}</td>
                      <td className="py-2 text-red-400/90">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Algorithm config */}
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Algorithm config
          </h2>
          {config && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ConfigField
                label="Vibe min reviews (noise floor)"
                value={configForm.vibeMinReviews}
                onChange={(v) =>
                  setConfigForm((f) => ({ ...f, vibeMinReviews: Number(v) }))
                }
              />
              <ConfigField
                label="Mega-famous threshold"
                value={configForm.classicMegaReviewThreshold}
                onChange={(v) =>
                  setConfigForm((f) => ({
                    ...f,
                    classicMegaReviewThreshold: Number(v),
                  }))
                }
              />
              <ConfigField
                label="Classic slots / cycle"
                value={configForm.classicSlotsPerCycle}
                onChange={(v) =>
                  setConfigForm((f) => ({ ...f, classicSlotsPerCycle: Number(v) }))
                }
              />
              <ConfigField
                label="Vibe slots / cycle"
                value={configForm.vibeSlotsPerCycle}
                onChange={(v) =>
                  setConfigForm((f) => ({ ...f, vibeSlotsPerCycle: Number(v) }))
                }
              />
              <ConfigField
                label="Min eligible spots"
                value={configForm.minEligibleSpots}
                onChange={(v) =>
                  setConfigForm((f) => ({ ...f, minEligibleSpots: Number(v) }))
                }
              />
              <ConfigField
                label="Feed batch size"
                value={configForm.feedBatchSize}
                onChange={(v) =>
                  setConfigForm((f) => ({ ...f, feedBatchSize: Number(v) }))
                }
              />
            </div>
          )}
          <div className="mt-4 rounded border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-[10px] text-neutral-500">
            <p className="mb-1 font-semibold uppercase tracking-wider text-neutral-400">
              Auto area bands（テスト時は自動適用・フォームでは上書き不可）
            </p>
            <ul className="space-y-0.5 font-mono">
              {(Object.keys(AREA_GEM_BANDS) as AreaProfile[]).map((key) => {
                const band = AREA_GEM_BANDS[key];
                return (
                  <li key={key}>
                    {key}: vibe {configForm.vibeMinReviews ?? 60}–
                    {band.vibeMaxReviews} · classic {band.classicMinReviews}–
                    {band.classicMaxReviews}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={saveConfig}
              className="rounded bg-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-600 disabled:opacity-50"
            >
              Save config
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={resetConfig}
              className="rounded border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800 disabled:opacity-50"
            >
              Reset defaults
            </button>
          </div>
          <p className="mt-2 text-[10px] text-neutral-600">
            DB 分析・スワイプはエリア密度を自動判定して帯を決めます。スロット比などはフォームが即反映。本番に反映するには Save config。
          </p>
        </section>

        {/* Advanced — ingest & cache */}
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <button
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            className="flex w-full items-center justify-between text-left text-xs font-semibold uppercase tracking-wider text-neutral-500"
          >
            高度な操作（データ投入・キャッシュ）
            <span className="font-mono text-neutral-600">{advancedOpen ? "▲" : "▼"}</span>
          </button>
          {advancedOpen && (
            <div className="mt-4 space-y-4">
              {cacheStats && (
                <div className="flex flex-wrap gap-4 text-xs">
                  <span>
                    全体 Total:{" "}
                    <strong className="font-mono">{cacheStats.totalSpots}</strong>
                  </span>
                  <span>
                    Fresh (14d):{" "}
                    <strong className="font-mono">{cacheStats.freshSpots}</strong>
                  </span>
                  <span className="text-neutral-500">
                    最終更新:{" "}
                    {cacheStats.lastUpdated
                      ? new Date(cacheStats.lastUpdated).toLocaleString("ja-JP")
                      : "—"}
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => runIngest("light")}
                  className="rounded border border-neutral-600 px-3 py-1.5 text-xs hover:bg-neutral-800 disabled:opacity-50"
                >
                  軽量 ingest（約1 API）
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => runIngest("deep")}
                  className="rounded border border-amber-900/60 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-950/30 disabled:opacity-50"
                >
                  深掘り ingest（約8–13 API）
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={loadCache}
                  className="rounded border border-neutral-600 px-3 py-1.5 text-xs hover:bg-neutral-800 disabled:opacity-50"
                >
                  統計を更新
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={clearCache}
                  className="rounded border border-red-900/60 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/40 disabled:opacity-50"
                >
                  Clear all cache
                </button>
              </div>
              <p className="text-[10px] text-neutral-600">
                新エリアの初回のみ ingest が必要です。同じエリアは DB
                キャッシュを全アカウントで共有します。
              </p>
            </div>
          )}
        </section>
      </main>

      {swipeSession && (
        <AdminSwipePanel
          lat={swipeSession.lat}
          lng={swipeSession.lng}
          coordinatesLabel={swipeSession.coordinatesLabel}
          config={swipeSession.config}
          onClose={() => setSwipeSession(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/50 px-3 py-2">
      <div className="text-[10px] text-neutral-600">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-neutral-200">{value}</div>
    </div>
  );
}

function ConfigField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-[10px] text-neutral-500">
      {label}
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 font-mono text-sm text-neutral-200"
      />
    </label>
  );
}
