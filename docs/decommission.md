# trainroute の撤去手順

**このアプリは廃止する。** 本書は停止・撤去の順序と実機コマンドの正本で、作業は複数リポジトリ・
複数日にまたがる。起点は [#40](https://github.com/guchi-apps/trainroute/issues/40)。

リポジトリはアーカイブ（読み取り専用化）して残すため、**アーカイブ後もこの文書は読める。**
撤去の途中で中断したときは、下の「完了の確認」で今どこまで進んだかを判定できる。

## なぜ削除してよいと判断したか（2026-09-07 時点の調査）

「使っていない」のは画面だけではない。**サーバー間参照用APIから実際にデータを取れている
利用者も、調査時点でゼロだった。**

| 依存元 | 実態 | 削除の影響 |
|---|---|---|
| AIDE `src/core/views/briefing.ts:103,232` | `transit` セクションは `pendingSection`（＝コネクタ未実装）。AIDE 側の `.env.example`・`secrets-manifest.tsv` にも trainroute 関連の変数が無い | なし |
| DaySpan `src/services/trainroute/client.ts` | 本番へ配線済み（`TRAINROUTE_TOKEN`）だが、呼び先の `/api/internal/route-transit`・`/api/internal/transit-quota` は **trainroute に存在しない**（#13・#14 が未実装のまま）。DaySpan は取得失敗を投げず、AIの見積もりへ落ちる設計 | なし |
| DaySpan `docs/spec.md §29` | 「**画面からはこの経路検索を呼ばなくなった**（電車はYahoo!乗換案内から取り込む）」と明記されている | 構想ごと不要 |
| 実装済みの `GET /api/internal/routes` | 呼び出し元は AIDE の予定だったが、上のとおり未実装 | なし |

このため #13（2地点間の経路API）・#14（利用枠API）・#31（NAVITIMEキーの発行）は、
**NAVITIMEの窓口を trainroute に置く構想ごと取り下げる。**

## 撤去の順序

**順序を入れ替えないこと。** 特に 1 と 4 は、逆にすると DaySpan のシークレット同期が壊れる
（DaySpan の `.github/secrets-manifest.tsv` が `op://apps/trainroute/internal-api-key` を参照して
いるため、1Password のアイテムを先に消すと DaySpan のデプロイが値を引けなくなる）。

1. **DaySpan の後片付け** — `src/services/trainroute/`・`src/lib/transit-quota.ts`・
   `TRAINROUTE_TOKEN`（`.github/secrets-manifest.tsv`・`.env.local.example`）を外す
2. **AIDE の後片付け** — `briefing.ts` の `transit` から trainroute を出典として外す
3. **VPS 実機からの撤去** — 下の「VPS での作業」
4. **シークレットの後片付け** — 1Password `apps/trainroute` と GitHub Secrets
5. **台帳の更新** — `guchi-apps/vps` の README、`guchi-apps/issue-deck`、`guchi-apps/docs`
6. **リポジトリのアーカイブ** — 最後に行う

## VPS での作業

**エージェントは実行できない。** サブPCに VPS への SSH 鍵が無く、`a2dissite`・`certbot`・
`DROP DATABASE` はいずれも sudo か DB の管理権限を要する。

### `scripts/apply.sh` は削除を反映しない

`guchi-apps/vps` の `scripts/apply.sh` は `apache/sites-available/*.conf` を**リポジトリ側から
実機へコピーするだけ**で（`scripts/apply.sh:45`）、リポジトリから消したファイルの `a2dissite`・
削除は行わない。**vhost をリポジトリから消しても、実機ではサイトが生きたまま残る。**
実機での `a2dissite` と削除を、リポジトリの変更とは別に必ず行うこと。

逆に、実機だけ消してリポジトリに残すと `apply.sh` が次回のデプロイで復活させる。
**両方消す。**

### 手順

`<TARGET_DIR>` は GitHub Secret `TARGET_DIR`（＝VPS上のデプロイ先）の値に読み替える。

```bash
# 1) PM2 から外す（dump.pm2 からも消すため pm2 save まで行う）
pm2 delete trainroute
pm2 save

# 2) DB のダンプを控えてから落とす
mysqldump -u root -p app_trainroute > ~/app_trainroute-$(date +%Y%m%d).sql
mysql -u root -p -e "DROP DATABASE app_trainroute;"

# 3) Apache のサイトを無効化して設定を消す
sudo a2dissite trainroute.gucchii.com trainroute.gucchii.com-le-ssl
sudo rm -f /etc/apache2/sites-available/trainroute.gucchii.com.conf \
           /etc/apache2/sites-available/trainroute.gucchii.com-le-ssl.conf
sudo apache2ctl configtest && sudo systemctl reload apache2

# 4) Let's Encrypt の証明書を削除する
#    残したままドメインを畳むと、更新のたびに certbot が失敗して通知が鳴り続ける。
sudo certbot delete --cert-name trainroute.gucchii.com

# 5) デプロイ先ディレクトリを消す（.env に実シークレットが入っている）
rm -rf "<TARGET_DIR>"
```

そのうえで **VPS の管理画面から `trainroute` の DNS レコード（A）を削除**する。
DNSを先に消すと 4 の `certbot delete` の前に更新が失敗しうるため、順序はこのままにする。

## シークレットの後片付け

DaySpan 側の `TRAINROUTE_TOKEN` を外した**後で**行う。

- 1Password（ブラウザ・デスクトップアプリ）で `apps` ボールトの `trainroute` アイテムを削除する。
  `allowed-email`・`auth-url`・`db-name`・`ekispert-access-key`・`internal-api-key`・`target-dir`
  の6フィールドが入っている
- GitHub Secrets はリポジトリをアーカイブしても消えないため、明示的に削除する

  ```bash
  for k in DB_NAME TARGET_DIR ALLOWED_EMAIL EKISPERT_ACCESS_KEY INTERNAL_API_KEY; do
    gh secret delete "$k" --repo guchi-apps/trainroute
  done
  gh variable delete AUTH_URL --repo guchi-apps/trainroute
  ```

- **Supabase 側に消すものは無い。** プロジェクトは他アプリと共有で、Redirect URLs は本番
  サブドメインをワイルドカードで登録済み（`guchi-apps/docs` の `knowledge/supabase.md`）
- **駅すぱあと API の契約は残す**（2026-09-07 のユーザー判断）。フリープランで費用が発生しない
  ため。ただし契約ドメインが `trainroute.gucchii.com` のまま残るので、**このキーを他アプリへ
  流用することはできない**（契約はドメイン単位）

## 台帳の更新

| リポジトリ | 消すもの |
|---|---|
| `guchi-apps/vps` | `apache/sites-available/trainroute.gucchii.com{,-le-ssl}.conf`、README のアプリ一覧の行、ポートの空き（3112 を空きへ戻す） |
| `guchi-apps/issue-deck` | `scripts/local-repo-ports.conf` の行、`docs/supported-repositories.md` の対応リポジトリの行 |
| `guchi-apps/docs` | `standards/tech-stack.md`・`inventory/1password-apps.md` の trainroute の行 |

外形監視（Uptime Kuma / UptimeRobot）に `trainroute.gucchii.com` のモニターがあれば、
**サイトを止める前に**外す。止めてから外すと、その間ダウン通知が鳴り続ける。
モニターの設定は Render 上の Uptime Kuma の画面で行う（ops-dashboard は読むだけ）。

## 完了の確認

```bash
# 公開が止まっていること（接続できない、または他ドメインの応答になる）
curl -sS -o /dev/null -w '%{http_code}\n' -m 10 https://trainroute.gucchii.com/ || echo "到達不可（期待どおり）"

# DNS が引けないこと
dig +short trainroute.gucchii.com A   # 何も出なければ完了

# PM2 に残っていないこと（VPS 上で実行）
pm2 describe trainroute >/dev/null 2>&1 && echo "まだ残っている" || echo "ok"

# DB が残っていないこと（VPS 上で実行）
mysql -u root -p -e "SHOW DATABASES LIKE 'app_trainroute';" | grep -q app_trainroute && echo "まだ残っている" || echo "ok"
```

## リポジトリのアーカイブ

**最後に行う。** アーカイブすると Issue・PR・Actions がすべて読み取り専用になり、
撤去作業の消し込みができなくなる。

```bash
gh repo archive guchi-apps/trainroute
```

削除ではなくアーカイブにしたのは、DaySpan・AIDE・`guchi-apps/docs` のコメントやドキュメントから
このリポジトリへのリンクが多数張られており、**消すとそれらが全て 404 になるため**。
判断の記録（駅すぱあとフリープランの制約、ODPTが関西の事業者を持たないこと、NAVITIMEの
選定経緯）も、次に交通系のアプリを作るときの出発点として残す価値がある。
