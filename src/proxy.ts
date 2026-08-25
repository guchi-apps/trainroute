import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy-session";

/**
 * Supabase のセッションを更新し、未ログインを弾く
 * （Next.js 16 で `middleware.ts` は `proxy.ts` へ改名された）。
 *
 * 判定の中身は `src/lib/supabase/proxy-session.ts`。
 */
export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|apple-icon).*)"],
};
