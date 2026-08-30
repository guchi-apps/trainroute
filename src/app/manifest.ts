import type { MetadataRoute } from "next";

/**
 * ホーム画面へ追加するための manifest。`/manifest.webmanifest` として配信される。
 *
 * 静的な `app/manifest.json` ではなくこのファイルにしているのは、配信パスを
 * `src/proxy.ts` の `matcher` が除外している `manifest.webmanifest` に合わせるため
 * （`manifest.json` だと `/manifest.json` になり、除外に入らない）。除外の外で配ると
 * 未ログイン時にログイン画面のHTMLが返り、MIMEタイプ違いでインストールに失敗する。
 *
 * 同じ理由でアイコンも `public/icons/`（＝`/icons/...`）に置いている。Next.js の
 * `app/icon.png` 規約は `/icon.png` で配信され、除外に入らないため使わない。
 *
 * オフライン対応（Service Worker）は入れていない。表示する内容はDBと駅すぱあとAPIに
 * 依存していて圏外で開けても見るものがなく、更新が古い画面で止まる副作用のほうが大きい。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "trainroute",
    // ホーム画面のラベルは10文字ほどで切れるため、短い日本語にする。
    short_name: "経路",
    description: "通勤経路を登録して、駅すぱあとの経路検索へ一手で飛ぶための個人用アプリ",
    lang: "ja",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // iOSは apple-touch-startup-image が無いとき、この色とアイコンから起動画面を作る。
    // 1色しか持てないので、ライト時のアプリの地の色（globals.css の --background）に合わせる。
    background_color: "#f7f8fa",
    theme_color: "#f7f8fa",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
