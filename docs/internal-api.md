# サーバー間参照用API（`/api/internal/*`）

同一VPS上で動く他アプリ（現状は [guchi-apps/aide](https://github.com/guchi-apps/aide)）が、
登録済みの通勤経路を参照するためのGET API。ブラウザからの利用は想定しておらず、
NextAuthのセッションではなく**共有シークレット1本**で守る。

- 経緯: guchi-apps/aide#33、guchi-apps/question#7
- 形は subscription-lists の同名ドキュメントに揃えている（AIDE側のコネクタが同じ扱いにできるため）
- 到達経路: 本アプリはVPS上で `127.0.0.1:3112`（`deploy/ecosystem.config.js` の `PORT`）で待ち受ける。
  呼び出し元も同じVPS上にいるため、**このAPIを外部公開する必要はない**

## 認証

```
Authorization: Bearer <INTERNAL_API_KEY>
```

| 状況 | 応答 |
| --- | --- |
| `INTERNAL_API_KEY` が未設定 | `503`（機能として無効。設定漏れが「認証なしの公開」に化けないようにしている） |
| ヘッダなし・キー不一致 | `401` |
| 一致 | `200` |

キーの比較は `node:crypto` の `timingSafeEqual` で定数時間で行う（`src/lib/internal-auth.ts`）。

**対象ユーザーは `ALLOWED_EMAIL`（ログインを許可するメールアドレス）で引く。** 利用者が1人だけの
前提のため、APIキーとユーザーの対応表は持っていない。`ALLOWED_EMAIL` はカンマ区切りで複数指定
できるが、このAPIは先頭のアドレスを使う。複数ユーザーを扱う必要が出た時点で対応表を導入する。

## `GET /api/internal/routes`

登録済みの通勤経路と、その経路が使う路線を返す。

### クエリパラメータ

| 名前 | 既定 | 内容 |
| --- | --- | --- |
| `includeCourseUrl` | `false` | `true` にすると各経路の「駅すぱあと for Web」URLを生成して添える |

> **既定では `courseUrl` を生成しない。** 生成は駅すぱあとAPIへの呼び出しを伴い、
> フリープランには回数の上限がある。URLが要るときだけ `true` を渡すこと。
> 生成に失敗した経路は、その経路だけ `courseUrl` が `null` になる（全体は落とさない）。

### レスポンス

```jsonc
{
  "generatedAt": "2026-08-25T20:00:00.000Z",
  "routes": [
    {
      "id": "ckxxx",
      "name": "通勤",
      "origin": { "code": "22671", "name": "出発駅" },
      "destination": { "code": "22828", "name": "到着駅" },
      "via": null,                       // 経由駅。無ければ null
      "lines": [
        { "operator": "阪急電鉄", "code": "1234", "name": "○○線" }
      ],
      "courseUrl": null                  // includeCourseUrl=true のときだけ値が入る
    }
  ],
  "serviceStatus": {
    "available": false,                  // 運行情報を返せるか
    "reason": "運行情報の取得元が未実装です。…",
    "lines": null
  }
}
```

### 運行情報（`serviceStatus`）について

**現時点では常に `available: false` / `lines: null` を返す。**

当初の計画（aide#33）はODPT（公共交通オープンデータセンター）から運行情報を取る前提だったが、
2026-08-25 に確認したところ **ODPTは阪急電鉄・大阪メトロ・JR西日本のデータを持っていない**
（データカタログの検索で「阪急」「近鉄」「JR西日本」「関西」いずれも0件）。ODPTは首都圏の事業者が
中心で、関西の路線は対象外になっている。

**`lines: null` を「平常運転」と解釈しないこと。** null は「分からない」を意味する。
遅れているのに平常と答えるほうが害が大きいため、取れないときは正直に不明を返す設計にしている。

取りうる選択肢と、実装するときの約束は `src/lib/transit/index.ts` の冒頭コメントに書いてある。
実装されると `available: true` になり、`lines` に路線ごとの状態が入る。

## 動作確認

```bash
curl -s -H "Authorization: Bearer $INTERNAL_API_KEY" \
  "http://127.0.0.1:3112/api/internal/routes" | jq .

# 経路URLも生成する
curl -s -H "Authorization: Bearer $INTERNAL_API_KEY" \
  "http://127.0.0.1:3112/api/internal/routes?includeCourseUrl=true" | jq .

# 認証エラー（401 が返る）
curl -s -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:3112/api/internal/routes"
```

ローカル開発では `.env.local` に `INTERNAL_API_KEY` を設定する（本番の値は使わない）。
ポートは `npm run dev` の `PORT`。

## 環境変数の配線

| 場所 | 設定 |
| --- | --- |
| 1Password | `apps/trainroute` の `internal-api-key` フィールド（**正**） |
| GitHub Secret | `INTERNAL_API_KEY`。`scripts/sync-github-secrets.sh --only INTERNAL_API_KEY` で1Passwordから同期する |
| 対応表 | `.github/secrets-manifest.tsv` |
| 本番 `.env` | `.github/workflows/deploy.yml` が `update_env` で書き込む |

キーを更新するときは、1Passwordの値を変えてから `sync-github-secrets.sh` を実行し、再デプロイする。
**呼び出し元（AIDE）側の値も同時に更新しないと連携が止まる。**
