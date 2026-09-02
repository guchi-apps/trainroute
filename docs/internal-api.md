# サーバー間参照用API（`/api/internal/*`）

同一VPS上で動く他アプリ（現状は [guchi-apps/aide](https://github.com/guchi-apps/aide)）が、
登録済みの通勤経路を参照するためのGET API。ブラウザからの利用は想定しておらず、
Supabase のセッションではなく**共有シークレット1本**で守る。

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

## `GET /api/internal/transit-quota`

経路検索に使う外部APIの利用枠（残り回数）を返す。DaySpan が移動の入力画面に「残り○回」を出す
ために使う（guchi-apps/dayspan#423）。

### レスポンス

```jsonc
{
  "generatedAt": "2026-08-27T12:40:00.000Z",
  "providers": [
    {
      "key": "navitime",          // 提供元の識別子。呼び出し側はこの値で分岐しない
      "label": "NAVITIME",        // 画面に出す名前
      "limit": 500,               // 枠の上限。分からなければ null
      "remaining": 463,           // 残り回数（必須）
      "resetAt": "2026-09-03T00:00:00.000Z",  // 枠が戻る日時。分からなければ null
      "updatedAt": "2026-08-27T12:40:00.000Z", // 最後に残数を見た時刻
      "source": "provider"        // provider=提供元が返した実数 / local=自前カウントの概算
    }
  ]
}
```

**配列の先頭が、経路検索に実際に使う提供元。** 呼び出し側の入力画面は先頭の1件を出す。
順序は `src/lib/transit/quota.ts` の `PROVIDERS` の並びで決まる（DBの取得順ではない）。

### `providers: []` を返す場合

`404` や `503` にはせず、空配列を返す。呼び出し側はこれを「出す数字が無い」として、
残り回数の区画ごと画面に出さない。

| 状況 | 理由 |
| --- | --- |
| `NAVITIME_API_KEY` が未設定 | 経路検索を使っていない。古い残数を出しても意味が無い |
| まだ一度も経路検索を呼んでいない | 記録が無い |
| `resetAt` を過ぎている | 枠は戻っているのに古い残数を出すと「使い切った」と誤解させる |

最後の1つは、次に経路検索を呼んだ時点で新しい残数が入って復活する。
**間違った数字を出すより「分からない」を返すほうがよい**という、`serviceStatus` と同じ考え方。

### 残数をどこから取っているか

**このAPIは外部APIを叩かない。** 残りを確かめる操作そのものが枠を消費するため、
保存済みの値を返すだけにしてある。

正は **RapidAPI が応答に付けるヘッダー**（[Response Headers](https://docs.rapidapi.com/docs/response-headers)）。

| ヘッダー | 保存先 |
| --- | --- |
| `x-ratelimit-requests-limit` | `TransitApiQuota.quotaLimit` |
| `x-ratelimit-requests-remaining` | `TransitApiQuota.remaining` |
| `x-ratelimit-requests-reset`（**残り秒数**） | `TransitApiQuota.resetAt`（保存時に日時へ直す） |

経路検索の実装（#13）は、外部APIを呼ぶたびに `recordRapidApiQuota()` へ応答の `headers` を
渡すこと。DBには1提供元1行を上書きし、履歴は持たない。

- **残数ヘッダーが読めない応答では何も書かない。** 前回の値を残すほうが、0やnullで上書きして
  「使い切った」ように見せるより害が小さい
- **枠が戻るのは暦の月末ではなく契約日からの請求サイクル。** 月初でリセットする実装にすると
  実際の枠とずれるため、`resetAt` はヘッダーの値だけを根拠にする（こちらで計算しない）
- 提供元が残数ヘッダーを返さない経路（SBI の API Hub 等）を選んだ場合は、自分の呼び出しを
  数えて `saveTransitQuota({ source: "local" })` で書く。呼び出し側は「概算」と分かる形で出す

駅すぱあとの枠は返していない。フリープランは応答に残数を返さず `local` でしか出せないため。
必要になったら `PROVIDERS` へ足す（レスポンスの形は複数の提供元をそのまま並べられる）。

## 動作確認

```bash
curl -s -H "Authorization: Bearer $INTERNAL_API_KEY" \
  "http://127.0.0.1:3112/api/internal/routes" | jq .

# 経路URLも生成する
curl -s -H "Authorization: Bearer $INTERNAL_API_KEY" \
  "http://127.0.0.1:3112/api/internal/routes?includeCourseUrl=true" | jq .

# 経路検索APIの利用枠
curl -s -H "Authorization: Bearer $INTERNAL_API_KEY" \
  "http://127.0.0.1:3112/api/internal/transit-quota" | jq .

# 認証エラー（401 が返る）
curl -s -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:3112/api/internal/routes"
```

ローカル開発では `.env.local` に `INTERNAL_API_KEY` を設定する（本番の値は使わない）。
ポートは `npm run dev` の `PORT`。

## 環境変数の配線

このキーは**どこかから発行されるものではなく、こちらで生成する共有シークレット**。

```bash
openssl rand -base64 32
```

比較は `timingSafeEqual` なので長さ・文字種の制約はない。`scripts/update-env-file.sh` は値を
ダブルクォートで囲んで `\` `"` 改行をエスケープするため、base64 の `+ / =` はそのまま通る。

### 同じ値を両側へ登録する

**片方だけ登録しても連携しない。** AIDE側は既存の `subscriptions-token` と同じ形で持つ。

| | trainroute（受ける側） | AIDE（叩く側） |
| --- | --- | --- |
| 1Password | `op://apps/trainroute/internal-api-key`（**正**） | `op://apps/aide/trainroute-token` |
| GitHub Secret | `INTERNAL_API_KEY` | `AIDE_TRAINROUTE_TOKEN` |
| 対応表 | `.github/secrets-manifest.tsv` | AIDEの `.github/secrets-manifest.tsv` |
| 本番 `.env` | `.github/workflows/deploy.yml` が `update_env` で書き込む | 同左（AIDE側） |

AIDE側のコネクタは未実装のため（guchi-apps/aide#33）、AIDE側の登録は実装時で間に合う。

キーを更新するときは、1Passwordの値を変えてから `sync-github-secrets.sh` を実行し、再デプロイする。
**このとき両側を同時に更新すること。** 片方だけ変えると 401 で連携が止まる。
