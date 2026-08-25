import { NextResponse, type NextRequest } from "next/server";

import { isAllowedEmail } from "@/lib/allowed-users";
import { getRequestOrigin, safeNextPath } from "@/lib/request-origin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const origin = getRequestOrigin(request);
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[trainroute] セッションの取得に失敗:", error?.message ?? "ユーザーが返らなかった");
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // **Supabase プロジェクトを他アプリと共用している。** Supabase でログインできることと
  // このアプリを使ってよいことは別に判定する。許可外のアカウントはセッションごと破棄する。
  if (!isAllowedEmail(data.user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_allowed`);
  }

  // 経路は `CommuteRoute.userEmail` で引くため、このアプリ側にユーザーレコードは作らない。
  return NextResponse.redirect(`${origin}${next}`);
}
