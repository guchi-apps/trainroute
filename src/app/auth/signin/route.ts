import { NextResponse, type NextRequest } from "next/server";

import { getRequestOrigin, safeNextPath } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";

/**
 * Google ログインを開始する。
 *
 * ログインはクライアントJSのハイドレーションが完了していなくても動く必要があるため、
 * ブラウザ側で signInWithOAuth を呼ばず、サーバーで認可URLを組み立ててリダイレクトする
 * （ログイン画面のボタンは素のリンク）。PKCEの検証値は Supabase のサーバークライアントが
 * Cookie へ書き、/auth/callback が読む。
 */
export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      // ここではリダイレクトせずURLだけ受け取り、こちらで 302 を返す。
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    console.error("[trainroute] Google ログインの開始に失敗:", error?.message ?? "URLが返らなかった");
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  return NextResponse.redirect(data.url);
}
