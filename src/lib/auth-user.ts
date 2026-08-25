import { headers } from "next/headers";

import { allowedEmails } from "@/lib/allowed-users";
import { TRAINROUTE_USER_EMAIL_HEADER } from "@/lib/auth-header";
import { isAuthBypassEnabled } from "@/lib/dev-auth";

/**
 * ログイン中の利用者のメールアドレスを返す。未ログイン・許可外なら null。
 *
 * Supabase のセッション検証は proxy.ts が済ませ、結果をヘッダーで渡してくる。ここで
 * auth.getUser() を呼び直すと、1リクエストにつき Supabase への往復が2回入ってしまう。
 * proxy.ts の matcher が外れているパス（静的アセット等）からは呼べないことに注意する。
 */
export async function requireUserEmail(): Promise<string | null> {
  // 開発用の認証バイパス（DISABLE_AUTH=true のときのみ。本番では無効）。
  if (isAuthBypassEnabled()) {
    return allowedEmails()[0] ?? null;
  }

  return (await headers()).get(TRAINROUTE_USER_EMAIL_HEADER);
}
