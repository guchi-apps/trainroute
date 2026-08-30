import type { Metadata, Viewport } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "trainroute",
  description: "通勤経路を登録して、駅すぱあとの経路検索へ一手で飛ぶための個人用アプリ",
  // ホーム画面から開いたときに全画面で立ち上げる。`display: standalone` は
  // manifest にも書いてあるが、iOSはこちらのメタタグしか見ない。
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "経路",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // ブラウザの上下の帯の色。アプリの地の色（globals.css の --background）と同じにして、
  // 画面が帯の下まで続いて見えるようにする。manifest の theme_color は1色しか持てないため、
  // ライト・ダークの出し分けはこちらで行う。
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-base font-semibold tracking-tight">
              trainroute
            </Link>
            {/*
              ログアウトはフォームのPOST。クライアントJSのハイドレーション前でも押せる必要があり、
              GETにするとリンクの先読みで意図せずログアウトさせられるため。
              未ログインでもこのヘッダーは出るが、押しても /login へ戻るだけで害はない。
            */}
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-xs text-muted hover:text-foreground">
                ログアウト
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
