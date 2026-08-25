/**
 * ログインを許可するメールアドレス。
 *
 * `ALLOWED_EMAIL` はカンマ区切りで複数書けるが、現状の利用者は1人。
 * **リポジトリは公開しているため、既定値としてアドレスを埋め込まないこと。**
 * 未設定なら空配列を返し、誰もログインできない状態にする（設定漏れが
 * 「誰でもログインできる」に化けるのを防ぐ）。
 */
export function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAIL ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedEmails().includes(email.toLowerCase());
}
