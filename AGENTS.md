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
| 認証 | NextAuth v5（Google）+ `ALLOWED_EMAIL` |
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
| `00.qa-answered` | 質問への回答のみ完了（`00.check-user` と常に併用） |
| `11.local` | ローカル（VSCode等）で対応中。付いている間は無人実行を起動しない |
| `21.plan-required` | 実装前に計画を提示し承認を得る |
| `22.merge-confirm-required` | 内容によらず、developへのマージ前に必ず `00.check-user` を付ける |
| `23.preview-required` | PR作成前に開発サーバーでの画面確認を必須にする |
| `24.screenshot-required` | PR作成前にスクリーンショット取得を必須にする |

## バージョンと更新履歴

**実装エージェントは `package.json` の `version` を触らない。** バージョンの bump は
`release-develop-to-main.yml` がリリース時にまとめて行う。`npm version` 系のコマンドも実行しない。

## 自動マージ不可カテゴリ

以下に該当する変更は自動マージせず `00.check-user` を付与してユーザーの確認を待つ。

- 認証・認可（`src/auth.ts`・`src/proxy.ts`・`src/lib/internal-auth.ts`・`src/lib/allowed-users.ts`）
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
<!-- END:multi-agent-rules -->
