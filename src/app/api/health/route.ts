/**
 * 死活確認。**認証を通さない**（`src/proxy.ts` の matcher から除外している）。
 *
 * デプロイ直後の起動待ちと、外形監視（Uptime Kuma）の両方から叩かれる。
 * DBには触れない。DBが落ちていてもプロセスが生きていることは分かるようにしておき、
 * DBの異常は別の手段で見る。
 */
export function GET() {
  return Response.json({ status: "ok" });
}
