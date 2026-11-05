"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/client";
import {
  formatLikePercent,
  type GrowthReport,
  type LikeRatio,
} from "@/lib/admin/growth";

function Count({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-neutral-800 bg-neutral-950/60 px-3 py-2">
      <p className="text-[10px] tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 font-mono text-lg text-neutral-100">{value}</p>
    </div>
  );
}

function likeLabel(ratio: LikeRatio): string {
  const percent = formatLikePercent(ratio.ratio);
  if (ratio.swipes === 0) return percent;
  return `${percent}（${ratio.likes}/${ratio.swipes}）`;
}

function tokyoLabel(iso: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return iso;
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

export function AdminGrowthPanel() {
  const [report, setReport] = useState<GrowthReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = (await adminFetch("/api/admin/growth")) as GrowthReport;
        if (!cancelled) setReport(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "利用者数の取得に失敗しました");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        利用者
      </h2>
      <p className="mt-1 text-[11px] leading-relaxed text-neutral-500">
        日の区切りは日本時間です。登録は Google
        ログインした人です。スワイプした人数と、いいねの割合は、その日に新しく記録されたスワイプです。同じ店へのやり直しは、最初の日のままです。
      </p>

      {error && (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
      {!error && !report && (
        <p className="mt-3 animate-pulse text-sm text-neutral-500">読み込み中…</p>
      )}

      {report && (
        <div className="mt-4 space-y-5">
          {report.truncated && (
            <p className="text-xs text-amber-300">
              件数が多いため、一部を数え切れていません。表示より実際は多いことがあります。
            </p>
          )}

          <div>
            <h3 className="mb-2 text-xs text-neutral-300">登録者数</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Count label="今日" value={report.signups.today} />
              <Count label="7日" value={report.signups.days7} />
              <Count label="30日" value={report.signups.days30} />
              <Count label="累計" value={report.signups.total} />
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs text-neutral-300">スワイプした人数</h3>
            <div className="grid grid-cols-3 gap-2">
              <Count label="今日" value={report.swipers.today} />
              <Count label="7日" value={report.swipers.days7} />
              <Count label="30日" value={report.swipers.days30} />
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-xs text-neutral-300">いいねの割合</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Count label="今日" value={likeLabel(report.likes.today)} />
              <Count label="7日" value={likeLabel(report.likes.days7)} />
              <Count label="30日" value={likeLabel(report.likes.days30)} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <caption className="mb-2 text-left text-xs text-neutral-300">
                日ごとの本数
              </caption>
              <thead className="text-neutral-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">日付</th>
                  <th className="py-1 pr-3 font-medium">登録</th>
                  <th className="py-1 pr-3 font-medium">スワイプした人</th>
                  <th className="py-1 font-medium">いいね</th>
                </tr>
              </thead>
              <tbody>
                {[...report.days].reverse().map((day) => (
                  <tr key={day.date} className="border-t border-neutral-800/80">
                    <td className="py-1.5 pr-3 font-mono text-neutral-300">
                      {day.date}
                      {day.date === report.today ? " 今日" : ""}
                    </td>
                    <td className="py-1.5 pr-3 font-mono">{day.signups}</td>
                    <td className="py-1.5 pr-3 font-mono">{day.swipers}</td>
                    <td className="py-1.5 font-mono text-neutral-300">
                      {day.swipes === 0
                        ? "—"
                        : `${formatLikePercent(day.likes / day.swipes)}（${day.likes}/${day.swipes}）`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-xs text-neutral-300">フィードバック</h3>
            <p className="mt-1 text-[11px] text-neutral-500">
              今日 {report.feedback.today} 件 · 7日 {report.feedback.days7} 件 · 30日{" "}
              {report.feedback.days30} 件
            </p>
            {report.feedback.recent.length === 0 ? (
              <p className="mt-2 text-xs text-neutral-500">まだ届いていません。</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {report.feedback.recent.map((item) => (
                  <li
                    key={item.id}
                    className="rounded border border-neutral-800 bg-neutral-950/40 px-3 py-2"
                  >
                    <p className="text-[10px] text-neutral-500">
                      {tokyoLabel(item.createdAt)} · {item.area} · {item.kind}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-neutral-200">
                      {item.message}
                    </p>
                    {item.extra && (
                      <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-400">
                        {item.extra}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
