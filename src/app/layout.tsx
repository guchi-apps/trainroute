import type { Metadata, Viewport } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "trainroute",
  description: "通勤経路を登録して、駅すぱあとの経路検索へ一手で飛ぶための個人用アプリ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
