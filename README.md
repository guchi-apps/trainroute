# trainroute

通勤経路を登録しておき、駅すぱあとの経路検索へ一手で飛ぶための個人用アプリ。
あわせて、同一VPS上で動く [AIDE](https://github.com/guchi-apps/aide) や
[DaySpan](https://github.com/guchi-apps/dayspan) へ、登録内容と2地点間の経路を渡す
サーバー間参照用APIを提供する（**交通系の外部APIのキーはこのアプリへ集約している**）。

- 本番: https://trainroute.gucchii.com （ログインは許可したアカウントのみ）
- 経緯: [guchi-apps/aide#33](https://github.com/guchi-apps/aide/issues/33)

## できること

- 駅名で駅を探して、出発駅・経由駅・到着駅を登録する
- 経路が使う路線（事業者つき）を登録する
- 登録した経路から「駅すぱあと for Web」の検索結果を開く
- AIDE から `/api/internal/routes` で登録内容を読む（[仕様](docs/internal-api.md)）
- DaySpan・AIDE から `/api/internal/route-transit` で2地点間の公共交通の経路（所要時間・乗換回数・
  運賃）を読む（[仕様](docs/internal-api.md)）

## できないこと（と、その理由）

**登録した通勤経路の所要時間・運賃を、画面に表示しません。** 駅すぱあと API のフリープランは、
経路探索の結果を「駅すぱあと for Web」のURLとして返す仕様で、運賃や所要時間のJSONは返しません。
数値を自前で組み立てると必ずずれるため、画面はリンクを作るところまでを担当します。

所要時間を数値で返すのは、**サーバー間参照用API の `/api/internal/route-transit` だけ**です。
こちらは駅すぱあとではなく NAVITIME API（RapidAPI経由）から取っており、座標で受けて
ドアtoドアで探索します。**無料枠が月500回のハードリミット**のため、呼ばれたときだけ問い合わせ、
画面からは呼びません。返るのは平均待ち時間による探索結果で、**時刻表上の特定の列車ではありません**。

**運行情報（遅延）を扱いません。** 当初は ODPT（公共交通オープンデータセンター）から取る計画
でしたが、ODPT は首都圏の事業者が中心で、**阪急電鉄・大阪メトロ・JR西日本のデータを持っていません**
（2026-08-25 時点、データカタログの検索でいずれも0件）。代替の取得元は未定です。検討した選択肢は
[`src/lib/transit/index.ts`](src/lib/transit/index.ts) に書いてあります。

APIが「運行情報なし」を返すとき、それは**平常運転ではなく「分からない」**を意味します。

## 技術構成

| レイヤー | 採用 |
|---|---|
| フレームワーク | Next.js 16（App Router）+ TypeScript |
| スタイリング | Tailwind CSS v4 |
| DB | MariaDB（`app_trainroute`）+ Prisma |
| 認証 | Supabase Auth（Google）+ 許可アドレスのリスト |
| 外部API | [駅すぱあと API フリープラン](https://docs.ekispert.com/v1/le/)（駅・路線の検索とURL生成）<br>[NAVITIME API](https://api-sdk.navitime.co.jp/api/specs/api_guide/route_transit.html)（RapidAPI経由。2地点間の経路探索） |
| 本番 | VPS上のPM2（ポート 3112）、Apache がリバースプロキシ |

## 開発

```bash
cp .env.local.example .env.local   # 各自の値を書く
npm install
npm run dev
```

DBを用意する場合:

```bash
mysql -u root -p -e "CREATE DATABASE app_trainroute DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
npm run db:migrate:dev
```

駅すぱあと・NAVITIME のアクセスキーが無くてもアプリは起動します（駅検索と
`/api/internal/route-transit` だけが 503 を返します）。

Supabase は他アプリと共有のプロジェクトを使います。**本番URLの Redirect URLs への登録は不要です**
（本番サブドメインはワイルドカードで登録済み）。ローカルで OAuth を通す場合だけ、Supabase の
Authentication > URL Configuration > Redirect URLs に `http://localhost:3000/auth/callback` が
含まれているか確認してください。GUI の無い環境では `DISABLE_AUTH=true` でログインを迂回できます
（`NODE_ENV=production` では常に無効）。

### 検証

```bash
npm run lint
npm run typecheck
npm run build:ci
```

## シークレットの扱い

**このリポジトリは公開しています。実際のキーやメールアドレスは一切含まれていません。**

本番の値は 1Password（`apps/trainroute`）が正で、GitHub Secrets へは
[`scripts/sync-github-secrets.sh`](scripts/sync-github-secrets.sh) で同期します。
どの値をどこから取るかの対応表は [`.github/secrets-manifest.tsv`](.github/secrets-manifest.tsv)
にあります。

駅すぱあと API のアクセスキーは**ドメイン単位の契約**（登録ドメインは `trainroute.gucchii.com`）
のため、他のアプリへは配りません。ブラウザにも渡さず、サーバー側の中継エンドポイントだけが使います。

## ライセンス

個人利用のためのアプリで、ライセンスは設定していません。
