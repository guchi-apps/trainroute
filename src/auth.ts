import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { isAllowedEmail } from "@/lib/allowed-users";

/**
 * ログイン認証（NextAuth v5 / Google）。
 *
 * **セッションは JWT で持ち、DB にユーザーを作らない。** 利用者は1人で、その1人は
 * `ALLOWED_EMAIL` で特定できるため、アダプタとユーザーテーブルを持つ価値がない。
 * 複数人で使う必要が出た時点で `@auth/prisma-adapter` を入れる。
 *
 * **リポジトリは公開しているため、許可アドレスをここに書かないこと。** 判定は
 * 環境変数（`src/lib/allowed-users.ts`）に閉じている。
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    /**
     * Google で認証できた「だけ」では通さない。誰でも Google アカウントは作れるため、
     * ここで許可リストと突き合わせる。未設定なら誰も通らない（`allowedEmails` 参照）。
     */
    signIn({ profile }) {
      return isAllowedEmail(profile?.email);
    },
  },
});
