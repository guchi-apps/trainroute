import type { NextRequest } from "next/server";

/**
 * このリクエストを受け取ったオリジンを返す。
 *
 * 開発サーバーは複数の経路（localhost・LANのsslip.ioホスト名など）から到達する。
 * `request.url` の origin はブラウザが実際に使ったホストを反映しないことがあるため、
 * Host ヘッダーから組み立てる。OAuthのリダイレクト先はここで組み立てた値を使う。
 *
 * 本番は Apache のリバースプロキシ配下に置くため、VirtualHost 側で
 * `ProxyPreserveHost On` と `RequestHeader set X-Forwarded-Proto "https"` が要る。
 */
export function getRequestOrigin(request: NextRequest): string {
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";

  if (host && !host.startsWith("0.0.0.0")) {
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

/** ログイン後の戻り先として安全に使えるパスか（オープンリダイレクト対策）。 */
export function safeNextPath(value: string | null, fallback = "/"): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return fallback;
}
