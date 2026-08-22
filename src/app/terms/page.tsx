import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "利用規約 — メシどこ",
  description: "メシどこの利用規約です。",
};

const UPDATED = "2026年8月1日";
const CONTACT = "kareta09badominton@gmail.com";

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-midnight text-text-primary">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/lp"
          className="text-xs text-stealth transition-colors hover:text-text-muted"
        >
          ← メシどこ LP
        </Link>
        <h1 className="mt-6 text-2xl font-bold tracking-wide">利用規約</h1>
        <p className="mt-2 text-xs text-text-muted">最終更新日: {UPDATED}</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-text-muted">
          <Section title="1. 適用">
            本利用規約（以下「本規約」）は、「メシどこ」（以下「本サービス」）の利用条件を定めるものです。ユーザーは本規約に同意のうえ本サービスを利用するものとします。
          </Section>

          <Section title="2. サービス内容">
            本サービスは、位置情報等に基づき飲食店等のスポットをスワイプ形式で紹介するウェブアプリケーションです。掲載情報の正確性・完全性・最新性を保証するものではありません。店舗の営業状況・料金等は必ずご自身でご確認ください。
          </Section>

          <Section title="3. アカウント">
            一部機能の利用にはアカウント登録が必要です。登録情報は正確に管理し、第三者に利用させないでください。不正利用が確認された場合、アカウントの停止等の措置を行うことがあります。
          </Section>

          <Section title="4. 禁止事項">
            ユーザーは、以下の行為をしてはなりません。
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>法令または公序良俗に反する行為</li>
              <li>本サービスまたは第三者の権利を侵害する行為</li>
              <li>不正アクセス、過度な負荷、スクレイピング等</li>
              <li>広告・決済システムを不正に操作する行為</li>
              <li>運営が不適切と判断する行為</li>
            </ul>
          </Section>

          <Section title="5. 料金・無料枠">
            本サービスの基本機能は無料で提供される場合があります。無料スワイプ回数等の制限は、アプリ内表示および運営の定めに従います。有料プラン（Pro等）を提供する場合、内容・料金・決済方法は別途案内します。
          </Section>

          <Section title="6. 知的財産">
            本サービスに関するコンテンツ、商標、プログラム等の権利は、運営または正当な権利者に帰属します。無断での複製・改変・再配布を禁じます。
          </Section>

          <Section title="7. 免責">
            本サービスの利用により生じた損害について、運営に故意または重過失がある場合を除き、責任を負いません。外部 API（地図・店舗情報・広告等）の障害・仕様変更により機能が制限されることがあります。
          </Section>

          <Section title="8. 規約の変更">
            運営は必要に応じて本規約を変更できます。変更後の規約は本サービス上に掲載した時点から効力を生じます。
          </Section>

          <Section title="9. 準拠法・管轄">
            本規約は日本法に準拠します。本サービスに関する紛争については、東京簡易裁判所または東京地方裁判所を第一審の専属的合意管轄裁判所とします。
          </Section>

          <Section title="10. お問い合わせ">
            本規約に関するお問い合わせ:{" "}
            <a
              href={`mailto:${CONTACT}`}
              className="text-electric-chilli underline underline-offset-2"
            >
              {CONTACT}
            </a>
            <br />
            運営: メシどこ運営
          </Section>
        </div>

        <p className="mt-12 text-center text-[11px] text-stealth">
          <Link href="/privacy" className="underline underline-offset-2">
            プライバシーポリシー
          </Link>
          {" · "}
          <Link href="/" className="underline underline-offset-2">
            アプリを開く
          </Link>
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-text-primary">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
