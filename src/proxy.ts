import { NextResponse } from "next/server";

import { auth } from "@/auth";

/**
 * 未ログインを弾く（Next.js 16 で `middleware.ts` は `proxy.ts` へ改名された）。
 *
 * **`/api/internal/*` は対象外にしてある。** あちらは同一VPS上のAIDEが
 * `Authorization: Bearer` で叩くサーバー間APIで、ブラウザのセッションを持たない。
 * 認証は `src/lib/internal-auth.ts` が別途行う（素通りではない）。
 *
 * NextAuth の `auth()` はラップした関数を返すため、規約が求める「名前付き `proxy`」ではなく
 * デフォルトエクスポートで渡す（どちらでもよいと `proxy.js` のドキュメントに明記がある）。
 */
export default auth((request) => {
  if (request.auth) return NextResponse.next();

  // 画面はログインへ送るが、APIへのリダイレクトは fetch が追ってHTMLを掴むだけなので
  // 401 を返す。呼び出し側が「未ログイン」と「壊れた応答」を取り違えないようにする。
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signInUrl = new URL("/api/auth/signin", request.nextUrl.origin);
  signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
  return NextResponse.redirect(signInUrl);
});

export const config = {
  matcher: [
    // 静的アセット・NextAuth自身・サーバー間APIを除く全部。
    "/((?!api/auth|api/internal|api/health|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)",
  ],
};
