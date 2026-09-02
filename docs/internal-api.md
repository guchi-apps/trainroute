# サーバー間参照用API（`/api/internal/*`）

同一VPS上で動く他アプリ（[guchi-apps/aide](https://github.com/guchi-apps/aide)・
[guchi-apps/dayspan](https://github.com/guchi-apps/dayspan)）が、登録済みの通勤経路と
2地点間の経路を参照するためのGET API。ブラウザからの利用は想定しておらず、
Supabase のセッションではなく**共有シークレット1本**で守る。

| エンドポイント | 内容 | 外部APIを叩くか |
| --- | --- | --- |
| [`GET /api/internal/routes`](#get-apiinternalroutes) | 登録済みの通勤経路と路線 | `includeCourseUrl=true` のときだけ（駅すぱあと） |
| [`GET /api/internal/route-transit`](#get-apiinternalroute-transit) | 2地点間の公共交通の経路（所要時間・乗換・運賃） | 毎回（NAVITIME。**無料枠は月500回**） |

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

## `GET /api/internal/route-transit`

2地点間の公共交通の経路を返す。取得元は **NAVITIME API**（RapidAPI経由。トータルナビの
`route_transit`）で、**駅すぱあととは別の契約**。

- 経緯: guchi-apps/trainroute#13、guchi-apps/dayspan#422
- 呼び出し元: DaySpan（`src/services/trainroute/client.ts`）、AIDE（guchi-apps/aide#33）
- **交通系の外部APIのキーは trainroute へ集約する。** NAVITIMEを実際に叩くのはこのアプリだけで、
  キーを他アプリへ配らない

> **呼ばれたときだけ問い合わせる。** 無料枠は**月500回のハードリミット**で、先読みや定期取得を
> 入れると数日で枠が消える。既存の `courseUrl` と同じ扱い。

### クエリパラメータ

| 名前 | 必須 | 既定 | 内容 |
| --- | --- | --- | --- |
| `startLat` / `startLon` | ✔ | — | 出発地の座標（10進度・WGS84） |
| `goalLat` / `goalLon` | ✔ | — | 目的地の座標（10進度・WGS84） |
| `startName` / `goalName` | | — | 表示用の名前。**探索には使わない**（受け取るだけ） |
| `goalTime` | | — | 到着時刻（ISO 8601）。`startTime` とは排他 |
| `startTime` | | 現在時刻 | 出発時刻（ISO 8601）。`goalTime` とは排他 |
| `limit` | | `3` | 返す経路の数。上限 `5`（超えたぶんは切り詰める） |

**座標で受けるのは、トータルナビがドアtoドア（最寄り駅までの徒歩を含む）で探索するため。**
出発地・目的地が駅である必要が無く、「自宅」に対して駅を選ばせる手順が要らない。

### レスポンス

```jsonc
{
  "generatedAt": "2026-08-27T00:40:00.000Z",
  "routes": [
    {
      "minutes": 42,                     // 総所要時間（徒歩を含む）
      "departAt": "2026-08-27T09:18:00+09:00",
      "arriveAt": "2026-08-27T10:00:00+09:00",
      "transitCount": 1,                 // 乗換回数
      "walkMinutes": 12,                 // 徒歩の合計
      "lines": ["○○線", "△△線"],        // 乗車順
      "boardStation": "○○",             // 最初に乗る駅。分からなければ null
      "alightStation": "△△",            // 最後に降りる駅。分からなければ null
      "fare": { "ticket": 320, "ic": 315 } // 読めなければ null
    }
  ],
  "attribution": {
    "provider": "NAVITIME",
    "termsUrl": "https://api-sdk.navitime.co.jp/api/specs/description/rapid_tou.html"
  }
}
```

**並び順はNAVITIMEが返した順のまま**（`order=time`＝所要時間の短い順）。どれを使うかは
trainroute でも呼び出し元でも決めず、画面で利用者に選ばせる。

`walkMinutes` と `boardStation` / `alightStation` は、**渡した座標から想定と違う駅が選ばれた
ときに利用者が気付くため**に添えている。呼び出し元は候補の各行にこれを出す。

`attribution` はNAVITIMEの利用規約が求める提供元の明示。呼び出し元は `provider` と `termsUrl` を
そのまま画面へ出すため、**提供元を替えてもあちらのコードは変えなくてよい**。

### エラー

| 状況 | 応答 |
| --- | --- |
| 座標が無い・範囲外、`goalTime` と `startTime` の同時指定 | `400` |
| `INTERNAL_API_KEY` 不一致・ヘッダなし | `401` |
| `NAVITIME_API_KEY` が未設定 | `503`（機能として無効） |
| 無料枠を使い切った（NAVITIMEが `429`） | `429` |
| NAVITIMEが応答しない・エラーを返した | `502` |

**呼び出し元は 4xx / 5xx・応答なし・JSONでない本文をすべて「分からなかった」として扱い、
AIの見積もりへ落とす**（DaySpanの場合）。枠切れは失敗ではなく「今月はもう取れない」なので、
502 に混ぜずに `429` で区別している。

経路が1本も見つからなかった場合は `200` と `routes: []`。これは「取れなかった」ではなく
「その条件では公共交通で行けない」を意味する。

### NAVITIME側の制約（設計の前提）

- **`train_data` の既定は `average`（平均待ち時間を用いた探索）。** `timetable`（電車時刻表データ）は
  オプション契約が必要で、APIマーケットでは利用できない。**返るのは時刻表上の特定の列車ではない。**
  画面に出すときは「特定の列車の時刻ではありません」と添える
- **応答をキャッシュへ保存してはいけない。** RapidAPI経由の利用規約 第5条第5項が
  「本サービスを通じて当社から提供を受けたデータをキャッシュ等に保存してはならない」と定めている
  （2026-09-02 確認）。DBにも Next.js の fetch キャッシュにも載せないこと
- 運賃は `unit_{料金区分ID}` の形で複数返る。`unit_0` がきっぷの大人運賃、`unit_48` がIC運賃で、
  `unit_128` 以降は通勤定期の値段（1回の移動の運賃ではない）

## 動作確認

```bash
curl -s -H "Authorization: Bearer $INTERNAL_API_KEY" \
  "http://127.0.0.1:3112/api/internal/routes" | jq .

# 経路URLも生成する
curl -s -H "Authorization: Bearer $INTERNAL_API_KEY" \
  "http://127.0.0.1:3112/api/internal/routes?includeCourseUrl=true" | jq .

# 認証エラー（401 が返る）
curl -s -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:3112/api/internal/routes"

# 経路探索。**1回叩くごとにNAVITIMEの無料枠（月500回）を1消費する。**
curl -s -H "Authorization: Bearer $INTERNAL_API_KEY" \
  "http://127.0.0.1:3112/api/internal/route-transit?startLat=35.681&startLon=139.767&goalLat=35.658&goalLon=139.701&limit=3" | jq .

# 枠を使わずに配線だけ確かめる（座標が無いので 400 が返る。認証と経路の存在は確認できる）
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $INTERNAL_API_KEY" \
  "http://127.0.0.1:3112/api/internal/route-transit"
```

ローカル開発では `.env.local` に `INTERNAL_API_KEY` を設定する（本番の値は使わない）。
ポートは `npm run dev` の `PORT`。

## 環境変数の配線

### `INTERNAL_API_KEY`

このキーは**どこかから発行されるものではなく、こちらで生成する共有シークレット**。

```bash
openssl rand -base64 32
```

比較は `timingSafeEqual` なので長さ・文字種の制約はない。`scripts/update-env-file.sh` は値を
ダブルクォートで囲んで `\` `"` 改行をエスケープするため、base64 の `+ / =` はそのまま通る。

#### 同じ値を両側へ登録する

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

### `NAVITIME_API_KEY`

経路探索（`/api/internal/route-transit`）の取得元のアクセスキー。**こちらで生成するものではなく、
RapidAPI（NAVITIME Route (totalnavi)）で発行する**。

| | |
| --- | --- |
| 1Password | `op://apps/trainroute/navitime-api-key`（**正**） |
| GitHub Secret | `NAVITIME_API_KEY` |
| 対応表 | `.github/secrets-manifest.tsv` |
| 本番 `.env` | `.github/workflows/deploy.yml` が `update_env` で書き込む |

**未設定でもアプリは起動する。** `/api/internal/route-transit` だけが 503 を返し、他の機能と
`/api/internal/routes` は動く。

**このキーを他アプリへ配らない。** 交通系の外部APIの窓口を trainroute に1つ置く方針のため、
DaySpanもAIDEも `INTERNAL_API_KEY` でこのアプリを叩く。
