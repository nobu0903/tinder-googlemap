import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー — メシどこ",
  description: "メシどこのプライバシーポリシーです。",
};

const UPDATED = "2026年8月1日";
const CONTACT = "kareta09badominton@gmail.com";

export default function PrivacyPage() {
  return (
    <LegalShell title="プライバシーポリシー" updated={UPDATED}>
      <Section title="1. はじめに">
        「メシどこ」（以下「本サービス」）は、本サービスの利用にあたり取得する情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。
      </Section>

      <Section title="2. 取得する情報">
        <ul className="list-disc space-y-1 pl-5">
          <li>アカウント登録時のメールアドレスおよび認証に必要な情報</li>
          <li>位置情報（許可した場合、またはエリア選択により指定した位置）</li>
          <li>スワイプ・いいね・設定などの利用履歴</li>
          <li>端末・ブラウザ情報、IPアドレス、Cookie等の技術情報</li>
          <li>お問い合わせ時に送信される内容</li>
        </ul>
      </Section>

      <Section title="3. 利用目的">
        <ul className="list-disc space-y-1 pl-5">
          <li>本サービスの提供・維持・改善</li>
          <li>周辺店舗の検索・表示、おすすめの生成</li>
          <li>本人確認、不正利用の防止</li>
          <li>お問い合わせへの対応</li>
          <li>広告配信（Google AdSense等）および利用状況の分析</li>
        </ul>
      </Section>

      <Section title="4. 第三者提供">
        法令に基づく場合を除き、ご本人の同意なく個人情報を第三者に提供しません。ただし、以下の外部サービスに必要な範囲で情報が処理されることがあります。
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Supabase（認証・データベース）</li>
          <li>Google（Places API、AdSense、アクセス解析に類する処理）</li>
          <li>ホスティング事業者（Vercel等）</li>
        </ul>
      </Section>

      <Section title="5. Cookie・広告">
        本サービスでは Cookie や類似技術を使用することがあります。また Google AdSense 等の広告サービスを利用する場合、当該事業者が Cookie 等を用いて興味・関心に基づく広告を表示することがあります。ブラウザ設定により Cookie を無効化できますが、一部機能が利用できなくなる場合があります。
      </Section>

      <Section title="6. 保管・安全管理">
        取得した情報は、漏えい・滅失・毀損の防止のため、合理的な安全管理措置を講じます。保管期間は利用目的の達成に必要な期間とし、不要となった情報は適切な方法で削除または匿名化します。
      </Section>

      <Section title="7. 開示等の請求">
        ご自身の個人情報の開示・訂正・削除等をご希望の場合は、下記連絡先までご連絡ください。本人確認のうえ、合理的な範囲で対応します。
      </Section>

      <Section title="8. 改定">
        本ポリシーは必要に応じて改定することがあります。重要な変更がある場合は、本サービス上でお知らせします。
      </Section>

      <Section title="9. お問い合わせ">
        本ポリシーに関するお問い合わせ:{" "}
        <a
          href={`mailto:${CONTACT}`}
          className="text-electric-chilli underline underline-offset-2"
        >
          {CONTACT}
        </a>
        <br />
        運営: メシどこ運営
      </Section>
    </LegalShell>
  );
}

function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-midnight text-text-primary">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/lp"
          className="text-xs text-stealth transition-colors hover:text-text-muted"
        >
          ← メシどこ LP
        </Link>
        <h1 className="mt-6 text-2xl font-bold tracking-wide">{title}</h1>
        <p className="mt-2 text-xs text-text-muted">最終更新日: {updated}</p>
        <div className="mt-8 space-y-8 text-sm leading-relaxed text-text-muted">
          {children}
        </div>
        <p className="mt-12 text-center text-[11px] text-stealth">
          <Link href="/terms" className="underline underline-offset-2">
            利用規約
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
