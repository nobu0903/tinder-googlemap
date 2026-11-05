# Admin アクセスの仕組み（フローチャート）

一般ユーザー向けアプリとは別に、**あなた専用の管理画面**を守るための流れです。

## 登場人物（用語）

| 名前 | 意味 |
|------|------|
| `ADMIN_SECRET` | `.env.local` / Vercel に置く秘密の文字列。サーバーだけが知る |
| Cookie `vl_admin` | Unlock 成功後にブラウザへ付く HttpOnly Cookie（JS からは読めない） |
| `/admin` | 管理画面本体 |
| `/ohyeswaitaminutemisterpostman` | 本番用の Unlock 入口（公開ナビには出さない。ブックマーク用） |
| `/api/admin/session` | ログイン状態の確認・Unlock・ログアウト用 API |
| Middleware | 本番で「Cookie なしなら `/admin` を 404」にする門番 |
| API の `verifyAdminRequest` | 各 admin API の本当の鍵チェック（Middleware より重要） |

---

## 全体像（なにを守っているか）

```mermaid
flowchart TB
  subgraph public [一般ユーザー]
    U[アプリ / スワイプなど]
  end

  subgraph gate [門番]
    MW[Middleware<br/>本番のみ厳格]
    APIAUTH[各 /api/admin/* の<br/>ADMIN_SECRET 検証]
  end

  subgraph admin [あなた専用]
    UNLOCK["/ohyeswaitaminutemisterpostman<br/>Unlock 画面"]
    PAGE["/admin<br/>管理画面"]
    APIS["/api/admin/*<br/>キャッシュ・分析など"]
  end

  U -.->|URL を知っていても| MW
  MW -->|Cookie なし → 404| X[Not Found]
  MW -->|Cookie あり| PAGE
  UNLOCK -->|正しい ADMIN_SECRET| COOKIE[Cookie vl_admin を付与]
  COOKIE --> PAGE
  PAGE --> APIS
  APIS --> APIAUTH
  APIAUTH -->|不一致 → 拒否| Y[拒否]
```

**ポイント:** Middleware は「画面を隠す」役。データ操作の本当の守りは **API 側の秘密検証**です。

---

## ローカル開発（development）

Middleware は素通りします。管理クッキーは、Unlock 画面で `ADMIN_SECRET` を入れたときだけ付きます。開いただけでは付きません。

```mermaid
flowchart TD
  A[ブラウザで /admin を開く] --> B[Middleware: 開発なので通過]
  B --> C[Admin 画面が GET /api/admin/session]
  C --> D{署名付き Cookie がある?}
  D -->|ある| F[管理画面を表示]
  D -->|ない| G[Unlock 画面へ]
  G --> H[POST で ADMIN_SECRET を送る]
  H --> F
```

秘密を空にして `ALLOW_INSECURE_ADMIN=1` にした開発だけ、パスワードなしで開きます。

**あなたがやること:** `npm run dev` → `http://localhost:3000/admin` → 表示された Unlock で `.env.local` の `ADMIN_SECRET` を入れる。

---

## 本番（production）— 初回 / Cookie 切れ

`/admin` を直接開いても **404** になります。Unlock 用 URL から入ります。

```mermaid
flowchart TD
  A["ブックマークした<br/>/ohyeswaitaminutemisterpostman を開く"] --> B[Unlock 画面で ADMIN_SECRET を入力]
  B --> C[POST /api/admin/session]
  C --> D{入力 == サーバーの ADMIN_SECRET ?}
  D -->|いいえ| E[エラー表示<br/>Invalid password]
  D -->|はい| F[HttpOnly Cookie vl_admin を付与]
  F --> G[リダイレクト → /admin]
  G --> H[Middleware: Cookie あり → 通過]
  H --> I[管理画面を表示]
```

**あなたがやること:**

1. Vercel に `ADMIN_SECRET` を設定する  
2. `https://あなたのドメイン/ohyeswaitaminutemisterpostman` をブックマーク  
3. そこで秘密を入力 → `/admin` へ  

Cookie は約 **30 日**有効です。切れたら同じ Unlock URL から入り直します。

---

## 本番 — 一般ユーザーが `/admin` を開いた場合

```mermaid
flowchart TD
  A[誰かが /admin や /api/admin/cache にアクセス] --> B[Middleware]
  B --> C{Cookie vl_admin が正しい？}
  C -->|いいえ| D[404 Not Found<br/>存在しないように見える]
  C -->|はい| E[中へ進む<br/>さらに API でも再検証]
```

Unlock 画面は公開ナビに出ていません。URL を知らなければたどり着きにくいです（加えて秘密が必要）。

---

## Middleware が通す / 弾くもの（本番）

```mermaid
flowchart TD
  R[リクエスト] --> M{パスは？}
  M -->|/api/admin/session| OK1[常に通過<br/>Unlock のため]
  M -->|/admin など| C1{Cookie OK?}
  M -->|その他 /api/admin/*| C2{Cookie OK?}
  M -->|上記以外| OK2[対象外・通過]
  C1 -->|Yes| OK3[通過]
  C1 -->|No| F1[404]
  C2 -->|Yes| OK4[通過]
  C2 -->|No| F2[404 JSON]
```

開発時はこの図の前に「全部通過」があります。

---

## 二重の守り（なぜ Middleware だけでは足りないか）

```mermaid
flowchart LR
  A[ブラウザ] --> B[Middleware<br/>門の見た目]
  B --> C[ページ / API]
  C --> D[verifyAdminRequest<br/>本当の鍵]
  D --> E[DB・Google API 操作]

  B -.- X[バイパスされても]
  D -.- Y[ここで止められる前提]
```

| 層 | 役割 |
|----|------|
| Middleware | 本番で未ログインを 404 にして存在感を消す |
| `/api/admin/*` の検証 | 実際の操作を拒否する本丸 |
| Unlock URL の秘匿 | 入口をナビに出さない |
| `ADMIN_SECRET` | 知っている人だけが Cookie を得られる |

---

## よくある疑問

**Q. `/admin` が 404 なのにどうやって入る？**  
A. 本番は Unlock URL（`/ohyeswaitaminutemisterpostman`）だけが入口です。

**Q. ローカルで Unlock URL は必要？**  
A. `/admin` を開くと Unlock へ移ります。そこで `ADMIN_SECRET` を入れます。開いただけでは入れません。

**Q. Save や Access の秘密入力は？**  
A. 廃止済み。秘密は env のみ。本番の入力は Unlock 画面だけです。

**Q. 「アルゴリズム設定を本番に反映」は何？**  
A. 認証とは無関係。フィード設定を本番 `/api/swipe` に保存するボタンです。

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| `src/middleware.ts` | 本番の門番 |
| `src/lib/admin/auth.ts` | Cookie / 秘密の検証 |
| `src/lib/admin/constants.ts` | Cookie 名・Unlock パス |
| `src/app/api/admin/session/route.ts` | ログイン API |
| `src/app/ohyeswaitaminutemisterpostman/page.tsx` | Unlock 画面 |
| `src/app/admin/page.tsx` | 管理画面 |
| `.env.local` の `ADMIN_SECRET` | ローカル用の秘密 |
