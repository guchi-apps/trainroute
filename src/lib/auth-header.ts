/**
 * proxy.ts が検証した利用者のメールアドレスを、後段のページ・ルートハンドラへ渡すためのヘッダー。
 *
 * proxy.ts は matcher に一致するすべてのリクエストでこの値を必ず上書きし、未ログイン
 * または許可外のアドレスなら削除する。そのためクライアントが同名のヘッダーを詐称して
 * 送ってきても、後段には届かない。
 *
 * このアプリはデータを `CommuteRoute.userEmail` で持つため、ユーザーIDではなく
 * メールアドレスを渡している（利用者が1人でユーザーテーブルを持たないため）。
 */
export const TRAINROUTE_USER_EMAIL_HEADER = "x-trainroute-user-email";
