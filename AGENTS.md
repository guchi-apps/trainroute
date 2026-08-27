<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
# trainroute — Agent 向けガイド

通勤経路を登録して、駅すぱあとの経路検索へ一手で飛ぶための個人用アプリ。
同一VPS上の [AIDE](https://github.com/guchi-apps/aide) へサーバー間参照用APIも提供する
（guchi-apps/aide#33）。

**このリポジトリは Public。** 実シークレット・メールアドレス・自宅や勤務先が分かる駅名を、
コード・テストデータ・コミットメッセージ・PR本文に**一切書かない**。設定値はすべて
環境変数（本番は 1Password が正）とDBに置く。

## 全体像

| | |
|---|---|
| 本番URL | https://trainroute.gucchii.com |
| ポート | 3112（PM2、プロセス名 `trainroute`） |
| DB | MariaDB `app_trainroute`（Prisma） |
| 認証 | Supabase Auth（Google）+ `ALLOWED_EMAIL` |
| 外部API | 駅すぱあと API フリープラン |

## 外部APIの制約（設計の前提）

**駅すぱあと フリープランは経路の中身をJSONで返さない。** 使えるのは駅・路線・会社のマスタと
「駅すぱあと for Web」へのURL生成だけで、所要時間・運賃・ダイヤ探索・運行情報は上位プランでしか
返らない。このため画面には数値を持たせず、リンクで飛ばす作りにしている。
所要時間や運賃をアプリ内に出す要望が来たら、**実装ではなくプラン変更の相談**になる。

**アクセスキーはドメイン単位の契約で、登録ドメインは `trainroute.gucchii.com`。**
他アプリ（AIDEを含む）へ配らない。ブラウザにも出さない（`src/app/api/` の中継を必ず通す）。

**運行情報（遅延）は未実装。** 当初はODPTを使う計画だったが、ODPTは阪急電鉄・大阪メトロ・
JR西日本のデータを持たない。経緯と選択肢は `src/lib/transit/index.ts` の冒頭コメントにある。
`fetchServiceStatus` は常に null を返す。**null は「平常運転」ではなく「分からない」を意味する。**

## 認証（Supabase Auth）

**Supabase プロジェクトは他アプリと共有している。** そのため「Supabase でログインできること」と
「このアプリを使ってよいこと」は別に判定する。許可判定は `ALLOWED_EMAIL` で行い、
`/auth/callback` と `proxy.ts` の**両方**に入れてある。片方だけに寄せないこと。

- セッションの検証は `src/proxy.ts` → `src/lib/supabase/proxy-session.ts` で毎リクエスト行う
- 検証済みのアドレスは `x-trainroute-user-email` ヘッダーで後段へ渡す。proxy が必ず上書き／削除
  するため詐称は届かない。ページ・APIは `requireUserEmail()`（`src/lib/auth-user.ts`）で読む
- **ページ側で `auth.getUser()` を呼び直さない。** 毎回 Supabase へ往復するため、1リクエストで
  2回叩くと待ち時間がそのまま倍になる
- `getUser()` が通信不達・5xx・429 のときはログイン画面へ戻さず 503 を返す。有効なセッションを
  持つ利用者を、電波が悪いだけでログインし直させないため
- `/api/*` は proxy でリダイレクトせず素通しし、各ルートハンドラが 401 JSON を返す
  （HTMLのログイン画面を返すと fetch 側が解釈できない）
- GUIの無い環境で画面を確認するときは `DISABLE_AUTH=true`。**`NODE_ENV=production` では常に無効**

**`NEXT_PUBLIC_SUPABASE_*` はビルド時に焼き込まれる。実行時の `.env` では変えられない。**
`proxy.ts` も `src/lib/supabase/server.ts` も焼き込み値を使うため、Supabaseプロジェクトや
publishable keyを差し替えたときは **`.env` の更新では足りず、再デプロイ（＝再ビルド）が要る**。
`deploy.yml` の `update_env NEXT_PUBLIC_SUPABASE_*` はこの経路には効かない（実質の設定は
buildジョブへ渡している値のほう）。2026-08-26 に本番と同じ構成で実測して確認した。

**本番URLを Supabase の Redirect URLs へ登録する作業は不要。** 共有プロジェクトの Redirect URLs は
本番サブドメインをワイルドカードで登録済みで、`https://trainroute.gucchii.com/auth/callback` は
既に覆われている（`_docs` の `knowledge/supabase.md`）。ワイルドカードに含まれないホスト
（`localhost`・LAN実機確認の `sslip.io` 等）だけは個別の確認が要る。

## ブランチ

`develop` がデフォルト。`main` は本番。`main` への push でデプロイが走る。

## 開発起動

```bash
cp .env.local.example .env.local   # 各自の値を書く（実シークレットはコミットしない）
npm install
npm run dev
```

DBを作る場合:

```bash
mysql -u root -p -e "CREATE DATABASE app_trainroute DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
npm run db:migrate:dev
```

## 検証コマンド

| 目的 | コマンド |
|---|---|
| Lint | `npm run lint` |
| 型チェック | `npm run typecheck` |
| ビルド | `npm run build:ci` |
| まとめて | `npm test`（lint + typecheck） |

`npm run typecheck` は `next typegen` を先に走らせる。`LayoutProps` / `PageProps` /
`RouteContext` は Next.js が生成するグローバル型で、生成前は `tsc` が解決できないため。

## サーバー間参照用API

AIDE向けの `/api/internal/*` の仕様は [docs/internal-api.md](docs/internal-api.md) が正本。
**認証を緩めない。** `INTERNAL_API_KEY` 未設定は 503（機能として無効）で、素通りにはしない。

## 本番デプロイ

`main` への push で `.github/workflows/deploy.yml` が動き、VPS上のPM2へ反映される。
シークレットの対応表は `.github/secrets-manifest.tsv`。1Password（`apps/trainroute`）が正で、
値を変えたら `scripts/sync-github-secrets.sh` でGitHubへ同期し、再デプロイする。

<!-- BEGIN:multi-agent-rules -->
# マルチエージェント運用（GitHub Actions 無人実行）

`@claude` コメントを起点に、計画提示〜実装〜develop向けPR作成までを GitHub Actions 上で無人実行する。
ワークフローの実体は `guchi-apps/issue-deck` にあり、このリポジトリの `.github/workflows/` には
`uses:` で参照する薄い caller だけを置いている。

**GitHub Actions 上での実行は、このリポジトリをチェックアウトしたワークツリーしか参照できない。**
したがって無人実行でも守られる必要があるルールは、このファイルに明文化しておく必要がある。

設計・運用の詳細は issue-deck 側を参照する。

- 進捗管理の設計: [progress-status-architecture.md](https://github.com/guchi-apps/issue-deck/blob/main/docs/progress-status-architecture.md)
- 無人実行の挙動: [multi-agent/dispatch.md](https://github.com/guchi-apps/issue-deck/blob/main/docs/multi-agent/dispatch.md)

## ブランチ命名（上の「ブランチ」節への追加）

Issue専用ブランチは `develop` から作成し、ブランチ名は **`issue-<Issue番号>`** とする（例: `issue-32`）。
ワークフローはブランチ名から対象Issueを特定するため、**この命名規約に従わないブランチはすべて対象外**になる。

デフォルトブランチは `develop` にしておく。`issues`・`issue_comment` イベントはデフォルトブランチの
ワークフローしか起動しないため、`main` にすると `@claude` コメントに反応しなくなる。

## Issueの進捗

**進捗は GitHub Projects の Status で管理する。進捗ラベルは存在しない。**

1. `Ready` — 未着手
2. `Planning` — 計画検討中（`21.plan-required` 選択時のみ経由）
3. `Implementation` — 実装中
4. `Develop PR` — developへPR作成・マージ中
5. `Develop` — developへマージ完了（main未反映）
6. `Release` — mainへPR作成・マージ中
7. `Done` — mainへマージ完了。この時点でissueをcloseする

**`gh issue edit` で進捗を進めることはできない。** Status を書けるのは issue-deck だけで、
ワークフローは進捗報告API（`POST /api/progress`）へ報告する。ブランチのpush・PR作成・PRマージを
トリガーに自動で遷移するため、エージェントが自分で進捗を動かす必要はない。

## 条件を表すラベル（進捗とは別軸）

Status = 今どこにいるか、Label = どんな性質・条件があるか、という役割分担にしている。

| ラベル | 意味 |
|---|---|
| `00.check-user` | ユーザーの確認・指示が必要。どの段階でも併用する |
| `01.check-input` | 質問・確認への回答待ち（`00.check-user` の理由） |
| `01.check-answered` | 回答済み。読むだけで実装は再開しない（同上） |
| `01.check-blocked` | 続け方の指示待ち。エージェントは停止（同上） |
| `01.check-plan` | 計画の承認待ち（同上） |
| `01.check-merge` | PRのマージ待ち（同上） |
| `11.local` | ローカル（VSCode等）で対応中。付いている間は無人実行を起動しない |
| `21.plan-required` | 実装前に計画を提示し承認を得る |
| `22.merge-confirm-required` | 内容によらず、developへのマージ前に人間の確認を挟む |
| `23.preview-required` | PR作成前に開発サーバーでの画面確認を必須にする |
| `24.screenshot-required` | PR作成前にスクリーンショット取得を必須にする |
| `25.artifact-required` | PR作成前にアーティファクトでの視覚確認を必須にする |

ラベルの正は `gh label list --repo guchi-apps/issue-deck --limit 100`。ここが古くなったら
そちらに合わせる。

## バージョンと更新履歴

**実装エージェントは `package.json` の `version` を触らない。** バージョンの bump は
`release-develop-to-main.yml` がリリース時にまとめて行う。`npm version` 系のコマンドも実行しない。

## 自動マージ不可カテゴリ

以下に該当する変更は自動マージせず `00.check-user` を付与してユーザーの確認を待つ。

- 認証・認可（`src/proxy.ts`・`src/lib/supabase/**`・`src/lib/internal-auth.ts`・`src/lib/allowed-users.ts`・`src/lib/auth-user.ts`・`src/lib/auth-header.ts`・`src/lib/dev-auth.ts`）
- DBスキーマ変更・マイグレーション（`prisma/**`）
- 本番環境の設定（`deploy/**`）
- GitHub Actionsやデプロイ設定（`.github/workflows/**`）
- Secretsや環境変数（`.env*`・`.github/secrets-manifest.tsv`）
- 課金・決済（駅すぱあとの有償プランへの変更を含む）
- 大規模な依存関係の更新
- `develop` → `main` のマージ

## 実装エージェントの禁止事項

- `main` / `develop` への直接コミット・push
- 他Issueのブランチの編集
- 不要なforce push
- 自分が作成したPull Requestの自己マージ
- **実シークレット・個人のメールアドレス・自宅や勤務先が特定できる駅名をリポジトリへ入れること**
  （このリポジトリは Public。一度コミットすると履歴とPRから消しきれない）

## コミット・PR・コメントの書き方

- コミットメッセージ・PRタイトル・PR本文・issueコメントは**日本語**で書く
- コミットの author は `Claude Code <claude-code@example.com>` にする
- `develop` 宛のPR本文には、対応Issue・実装内容・テスト内容・確認方法・注意点を記載する。
  developマージ時点ではissueをcloseしない運用のため、`closes #番号` / `fixes #番号` は使わず
  `#番号` のみ記載する

## 依存関係の追加

新しい依存関係を追加する前には、必ずユーザーに確認を取る。無人実行では確認相手がいないため、
追加が必要だと判断した場合は追加せずに作業を止め、`00.check-user` を付与したうえで
なぜ必要かをIssueコメントで相談する。

## 全アプリ共通の共有知識（`.shared-context/`）

複数アプリで共通の知識（Git/GitHub運用・Actions上でClaude Codeを動かす際の知見・デプロイ方針など）は
このリポジトリに複製せず、共有知識リポジトリ `guchi-apps/docs` で一元管理する。

- **無人実行**: `claude-issue-dispatch.yml` が実行のたびに `.shared-context/`（共有知識）と
  `.shared-prompts/`（issue-deck側の実装プロンプト）をワークツリーへcheckoutする。
  checkoutに失敗した場合は共有知識なしでそのまま作業を進めてよい
- **ローカル実行**: `~/apps/_docs`（cloneしてある場合のみ）
- **どちらも `.gitignore` 済みで、このリポジトリの管理対象ではない**（guchi-apps/issue-deck#1151）。
  入れ忘れるとLintが管理外のファイルを検査し、`git add -A` で巻き込んでコミットされる

読む順序は `CLAUDE.md`（索引）→ 自分の役割の `agent-rules/` → 必要なときだけ `knowledge/`・
`standards/`・`guides/`。最初から全部読む必要はない。

**内容が矛盾する場合は、具体的で近いものを優先する。** Issue本文・コメントの明示的な指示 →
このファイル → このリポジトリの `docs/` → `.shared-context/` の順。共有知識は「他のアプリでは
こうしている」という既定値であり、trainroute固有のルールを上書きしない。

### 書き込みの禁止と知見の残し方

- **`.shared-context/` 配下は読み取り専用として扱う。** 編集・`git add`・コミットは一切行わない
- 実装中に得た非自明な知見は、次の2つを**両方**行って残す（目安3件まで）
  - 実装PRに同梱して、このリポジトリの `docs/` または `AGENTS.md` へ書く
  - 同じ内容を「知見メモ」コメント（先頭に `<!-- knowledge-candidate -->`）としてIssueへ投稿する
- **共有知識へ格上げすべきかどうかは判定しない**（guchi-apps/issue-deck#2029）。判定と共有知識への
  反映は `guchi-apps/docs` 側の格上げ判定エージェントがフリート全体の知見メモをまとめて行う。
  判定を待つ必要は無く、実装はそのまま進めてよい
- **シークレットの実値・個人のメールアドレス・自宅や勤務先が特定できる駅名・一時的な障害情報は、
  `docs/` にも知見メモにも書かない**（このリポジトリは Public）

## 共有ワークフローの参照タグ

`.github/workflows/` の薄いcaller 10本（`claude-issue-dispatch`・`issue-labels`・
`claude-review-develop`・`claude-conflict-resolve`・`claude-ci-fix`・`claude-pr-repair`・
`release-develop-to-main`・`version-tag-check`・`deploy-retry`・`sync-secrets`）は、
issue-deck の `reusable-*.yml` を `@workflows/vN` のタグ固定で参照している。

- **`reusable-*.yml` とプロンプトはこのリポジトリへコピーしない。** issue-deck側の1つを共有する
- **`uses:` のタグと `prompts-ref` は必ず同じ値にする。** 片方だけ上げると、新しいワークフローで
  古いプロンプトが動く
- **タグは10本まとめて上げる。** 上げ忘れても何も起きないため、ばらけると気づけない
- **`on:`（トリガー定義）はcaller側にしか無い。** issue-deck側で新しいイベントを使うジョブが
  増えても、このリポジトリのcallerに同じイベントを書き足すまでそのジョブは一度も走らない。
  タグを上げるときは、上げ先のタグのcaller（issue-deckの `.github/workflows/` 配下の同名ファイル）と
  `on:` を突き合わせる
- 一括更新のPRは issue-deck の画面（設定＞フリート運用＞共有ワークフローのバージョン）から作れる。
  `.github/scripts/signaly-notify.sh` も同じパネルの「共有スクリプト」から配られるため、
  **こちらで独自に書き換えない**（配布で上書きされる）
<!-- END:multi-agent-rules -->
